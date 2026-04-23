import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeviceSettings } from '../hooks/useDeviceSettings'

export function SettingsPage() {
  const { settings, setSettings, cameras, mics, permissionGranted, enumerateDevices } =
    useDeviceSettings()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  // 선택된 카메라로 미리보기
  useEffect(() => {
    if (!permissionGranted) return
    const cameraId = settings.cameraId || cameras[0]?.deviceId
    if (!cameraId) return

    // 기존 스트림 정리
    streamRef.current?.getTracks().forEach((t) => t.stop())

    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: { exact: cameraId } } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => null)
        }
      })
      .catch(() => null)

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [settings.cameraId, cameras, permissionGranted])

  // 선택된 마이크로 오디오 레벨 측정
  useEffect(() => {
    if (!permissionGranted) return
    const micId = settings.micId || mics[0]?.deviceId
    if (!micId) return

    let audioCtx: AudioContext | null = null
    let micStream: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: { exact: micId } } })
      .then((stream) => {
        micStream = stream
        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser

        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(buf)
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length
          setAudioLevel(Math.min(100, avg * 2))
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      })
      .catch(() => null)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      micStream?.getTracks().forEach((t) => t.stop())
      audioCtx?.close().catch(() => null)
    }
  }, [settings.micId, mics, permissionGranted])

  const effectiveCam = settings.cameraId || cameras[0]?.deviceId || ''
  const effectiveMic = settings.micId || mics[0]?.deviceId || ''

  return (
    <main className="min-h-screen bg-neutral-950 p-4">
      <div className="max-w-lg mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-white">장치 설정</h1>
          <Link
            to="/"
            className="text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-600"
          >
            홈으로
          </Link>
        </div>

        {!permissionGranted && (
          <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-yellow-400 mb-3">카메라/마이크 접근 권한이 필요합니다</p>
            <button
              onClick={enumerateDevices}
              className="text-xs text-white bg-yellow-800 hover:bg-yellow-700 transition-colors px-3 py-1.5 rounded-lg"
            >
              권한 요청
            </button>
          </div>
        )}

        {/* 카메라 미리보기 */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">카메라</h2>
          <div className="relative w-full aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 mb-3">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {!permissionGranted && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-neutral-600 text-sm">미리보기 없음</p>
              </div>
            )}
          </div>
          <select
            value={effectiveCam}
            onChange={(e) => setSettings({ cameraId: e.target.value })}
            disabled={cameras.length === 0}
            className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
          >
            {cameras.length === 0 && <option>장치 없음</option>}
            {cameras.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* 마이크 */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">마이크</h2>

          {/* 오디오 레벨 바 */}
          <div className="w-full h-2 bg-neutral-800 rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-75"
              style={{ width: `${audioLevel}%` }}
            />
          </div>

          <select
            value={effectiveMic}
            onChange={(e) => setSettings({ micId: e.target.value })}
            disabled={mics.length === 0}
            className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
          >
            {mics.length === 0 && <option>장치 없음</option>}
            {mics.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* 저장 안내 */}
        <p className="text-xs text-neutral-600 text-center">설정은 선택 즉시 저장되며 다음 미팅에 적용됩니다</p>
      </div>
    </main>
  )
}
