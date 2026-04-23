import { useEffect, useRef, useState, useMemo } from 'react'
import { FaceApiModel } from '../ml/FaceApiModel'
import { DummyModel } from '../ml/DummyModel'
import { LocalAggregator } from '../ml/LocalAggregator'
import type { AggregatedMood } from '../ml/LocalAggregator'
import { useMoodEngine } from '../hooks/useMoodEngine'
import { ExpressionDebugOverlay } from '../components/ExpressionDebugOverlay'
import { MoodBar } from '../components/MoodBar'

type ModelKind = 'faceapi' | 'dummy'

export function DemoPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [modelKind, setModelKind] = useState<ModelKind>('faceapi')
  const [camError, setCamError] = useState<string | null>(null)
  const [mood, setMood] = useState<AggregatedMood | null>(null)

  // 모델/집계기는 modelKind 바뀔 때만 새로 생성
  const model = useMemo(
    () => (modelKind === 'faceapi' ? new FaceApiModel() : new DummyModel()),
    [modelKind],
  )
  const aggregator = useMemo(() => new LocalAggregator(), [modelKind])

  const { status, result, error, start, stop } = useMoodEngine(videoRef, model)

  // 추론 결과 → 집계기에 push → MoodBar 업데이트
  useEffect(() => {
    if (!result) return
    aggregator.push(result)
    const current = aggregator.current()
    if (current) setMood(current)
  }, [result, aggregator])

  // 웹캠 스트림
  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((s) => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play().catch(() => null)
        }
      })
      .catch((e: Error) => setCamError(e.message))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  function handleModelChange(kind: ModelKind) {
    stop()
    setMood(null)
    setModelKind(kind)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ML Demo</h1>
            <p className="text-neutral-400 text-sm mt-0.5">Docker 없이 표정 분석 테스트</p>
          </div>
          <a href="/" className="text-sm text-neutral-500 hover:text-white transition-colors">← 홈</a>
        </div>

        {/* Mood Bar */}
        <div className="mb-4">
          <MoodBar mood={mood} />
        </div>

        {/* 모델 선택 */}
        <div className="flex gap-2 mb-4">
          {(['faceapi', 'dummy'] as ModelKind[]).map((k) => (
            <button
              key={k}
              onClick={() => handleModelChange(k)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                modelKind === k
                  ? 'bg-white text-neutral-900 font-medium'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {k === 'faceapi' ? 'face-api.js (실제 ML)' : 'Dummy (웹캠 없이)'}
            </button>
          ))}
        </div>

        {/* 비디오 */}
        <div className="relative rounded-2xl overflow-hidden bg-neutral-900 aspect-video">
          {camError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 text-sm gap-1">
              <span>웹캠 없음 — Dummy 모드를 사용하세요</span>
              <span className="text-xs text-neutral-600">{camError}</span>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}

          <div className="absolute top-3 left-3">
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${
              status === 'running' ? 'bg-green-500/20 text-green-400' :
              status === 'loading' ? 'bg-yellow-500/20 text-yellow-400' :
              status === 'error'   ? 'bg-red-500/20 text-red-400' :
                                     'bg-white/10 text-white/40'
            }`}>
              {status === 'running' ? '분석 중' :
               status === 'loading' ? '로딩 중...' :
               status === 'error'   ? '오류' : '대기'}
            </span>
          </div>
        </div>

        {/* 컨트롤 */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={start}
            disabled={status === 'loading' || status === 'running'}
            className="flex-1 py-2.5 rounded-lg bg-white text-neutral-900 font-semibold text-sm disabled:opacity-40 hover:bg-neutral-100 transition-colors"
          >
            분석 시작
          </button>
          <button
            onClick={stop}
            disabled={status === 'idle'}
            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-white font-semibold text-sm disabled:opacity-40 hover:bg-neutral-700 transition-colors"
          >
            중지
          </button>
        </div>

        <div className="mt-6 rounded-xl bg-neutral-900 border border-neutral-800 p-4 text-sm text-neutral-400 space-y-1.5">
          <p><span className="text-white font-medium">face-api.js</span> — 실제 얼굴 표정 → valence/arousal → 색상 변화.</p>
          <p><span className="text-white font-medium">Dummy</span> — sin파 더미. MoodBar 색상 전환 확인용.</p>
          <p className="text-neutral-600 text-xs">30초 무수신 시 중립 회색으로 자동 복귀.</p>
        </div>
      </div>

      <ExpressionDebugOverlay result={result} status={status} error={error} />
    </div>
  )
}
