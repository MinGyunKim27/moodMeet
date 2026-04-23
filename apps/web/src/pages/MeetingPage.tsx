import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { useMeetingStore } from '../store/meetingStore'
import { api } from '../lib/api'
import { getDeviceId } from '../lib/device'
import { useDeviceSettings } from '../hooks/useDeviceSettings'
import { FaceApiModel } from '../ml/FaceApiModel'
import { LocalAggregator } from '../ml/LocalAggregator'
import type { AggregatedMood } from '../ml/LocalAggregator'
import { useMoodEngine } from '../hooks/useMoodEngine'
import { useMoodReporter } from '../hooks/useMoodReporter'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { MoodBar } from '../components/MoodBar'
import { ExpressionDebugOverlay } from '../components/ExpressionDebugOverlay'

export function MeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { token, livekitUrl, displayName, participantId, setConnection } = useMeetingStore()
  const { settings } = useDeviceSettings()

  useEffect(() => {
    if (!token && meetingId) {
      const savedName = sessionStorage.getItem('displayName') ?? displayName
      if (savedName) {
        const deviceId = getDeviceId()
        api
          .joinMeeting(meetingId, savedName, deviceId)
          .then(({ token: t, livekitUrl: url, participantId: pid }) =>
            setConnection(t, url, pid),
          )
          .catch(() => navigate('/'))
      } else {
        navigate('/')
      }
    }
  }, [token, meetingId, navigate, setConnection, displayName])

  useEffect(() => {
    if (displayName) sessionStorage.setItem('displayName', displayName)
  }, [displayName])

  if (!token || !livekitUrl || !meetingId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <p className="text-neutral-400 text-sm">연결 중...</p>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect
      video
      audio
      options={{
        ...(settings.micId ? { audioCaptureDefaults: { deviceId: settings.micId } } : {}),
        ...(settings.cameraId ? { videoCaptureDefaults: { deviceId: settings.cameraId } } : {}),
      }}
      onDisconnected={() => navigate('/')}
      data-lk-theme="default"
      style={{ height: '100dvh', background: '#0a0a0a' }}
    >
      <MeetingRoom meetingId={meetingId} participantId={participantId} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

function MeetingRoom({
  meetingId,
  participantId,
}: {
  meetingId: string
  participantId: string | null
}) {
  const navigate = useNavigate()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  // LiveKit 로컬 카메라 트랙 → 숨겨진 video 엘리먼트로 ML 추론
  const { localParticipant } = useLocalParticipant()
  const hiddenVideoRef = useRef<HTMLVideoElement>(null)
  // roomMood: 서버에서 받은 타인 평균 분위기 (본인 제외)
  const [roomMood, setRoomMood] = useState<AggregatedMood | null>(null)

  const model = useMemo(() => new FaceApiModel(), [])
  const aggregator = useMemo(() => new LocalAggregator(), [])
  const { status, result, error, start, stop } = useMoodEngine(hiddenVideoRef, model)

  // 음성 인식
  const { finalTranscripts, listening, supported, start: startSpeech, stop: stopSpeech } =
    useSpeechRecognition('ko-KR')

  // 내 mood를 서버로 전송 + 타인 평균 수신
  const getMood = useCallback(() => aggregator.current(), [aggregator])
  const { setOnMoodUpdate } = useMoodReporter(meetingId, participantId, getMood, listening)
  useEffect(() => {
    setOnMoodUpdate((m) =>
      setRoomMood({ valence: m.valence, arousal: m.arousal, sampleCount: 1, bucketTs: Date.now() }),
    )
  }, [setOnMoodUpdate])
  const sentCountRef = useRef(0)

  // 발화가 쌓이면 API로 저장
  useEffect(() => {
    if (!participantId) return
    const unsent = finalTranscripts.slice(sentCountRef.current)
    if (unsent.length === 0) return
    unsent.forEach((t) => {
      api.addUtterance(meetingId, participantId, t).catch(console.error)
    })
    sentCountRef.current = finalTranscripts.length
  }, [finalTranscripts, meetingId, participantId])

  // 회의 종료 처리
  const [ending, setEnding] = useState(false)
  const handleEndMeeting = useCallback(async () => {
    if (ending) return
    setEnding(true)
    stopSpeech()
    stop()
    try {
      await Promise.all([
        api.endMeeting(meetingId),
        api.generateSummary(meetingId),
      ])
    } catch {
      // 실패해도 요약 페이지로 이동
    }
    navigate(`/meeting/${meetingId}/summary`)
  }, [ending, meetingId, navigate, stop, stopSpeech])

  // 로컬 카메라 트랙이 생기면 숨겨진 video에 붙이고 ML 시작
  useEffect(() => {
    const camPub = localParticipant.getTrackPublication(Track.Source.Camera)
    const track = camPub?.track
    if (!track || !hiddenVideoRef.current) return

    const stream = new MediaStream([track.mediaStreamTrack])
    hiddenVideoRef.current.srcObject = stream
    hiddenVideoRef.current.play().catch(() => null)

    start()
    return () => {
      stop()
      if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localParticipant.getTrackPublication(Track.Source.Camera)?.track?.sid])

  // 추론 결과 → LocalAggregator (서버 전송용, MoodBar는 서버 브로드캐스트 사용)
  useEffect(() => {
    if (!result) return
    aggregator.push(result)
  }, [result, aggregator])

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <span className="text-white font-semibold text-sm">MoodMeet</span>
        <button
          onClick={() => navigator.clipboard.writeText(meetingId)}
          title="클릭하면 ID 복사"
          className="text-neutral-400 text-xs font-mono hover:text-white transition-colors truncate max-w-[260px]"
        >
          {meetingId}
        </button>
        <div className="flex items-center gap-2">
          {/* STT 버튼 */}
          {supported && (
            <button
              onClick={listening ? stopSpeech : startSpeech}
              title={listening ? '음성 인식 중지' : '음성 인식 시작'}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                listening
                  ? 'border-red-500 text-red-400 hover:border-red-400'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
              }`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${listening ? 'bg-red-500 animate-pulse' : 'bg-neutral-600'}`} />
              {listening ? '녹음 중' : '음성 인식'}
            </button>
          )}
          <CopyLinkButton meetingId={meetingId} />
          {/* 회의 종료 */}
          <button
            onClick={handleEndMeeting}
            disabled={ending}
            className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-800 hover:border-red-600 disabled:opacity-50"
          >
            {ending ? '종료 중...' : '회의 종료'}
          </button>
        </div>
      </header>

      {/* Mood Bar — 본인 제외 참여자 평균 분위기 */}
      <div className="px-2 pt-2">
        <MoodBar mood={roomMood} />
      </div>

      {/* 발화 미리보기 */}
      {listening && finalTranscripts.length > 0 && (
        <div className="mx-2 mt-1 px-3 py-2 bg-neutral-900 rounded-lg border border-neutral-800">
          <p className="text-xs text-neutral-500 mb-0.5">최근 발화</p>
          <p className="text-xs text-neutral-300 truncate">
            {finalTranscripts[finalTranscripts.length - 1]}
          </p>
        </div>
      )}

      {/* 비디오 타일 그리드 */}
      <div className="flex-1 overflow-hidden p-2">
        <GridLayout tracks={tracks} style={{ height: '100%' }}>
          <ParticipantTile />
        </GridLayout>
      </div>

      {/* 컨트롤 바 */}
      <div className="border-t border-neutral-800">
        <ControlBar
          controls={{ camera: true, microphone: true, screenShare: true, leave: false }}
        />
      </div>

      {/* ML 추론용 숨겨진 video (화면에 안 보임) */}
      <video ref={hiddenVideoRef} muted playsInline style={{ display: 'none' }} />

      {/* 디버그 오버레이 */}
      <ExpressionDebugOverlay result={result} status={status} error={error} />
    </div>
  )
}

function CopyLinkButton({ meetingId }: { meetingId: string }) {
  const handleCopy = async () => {
    const url = `${window.location.origin}/meeting/${meetingId}`
    await navigator.clipboard.writeText(url)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-neutral-400 hover:text-white transition-colors px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500"
    >
      링크 복사
    </button>
  )
}
