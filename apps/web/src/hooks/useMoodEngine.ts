import { useEffect, useRef, useState, useCallback } from 'react'
import type { ExpressionResult, IExpressionModel } from '../ml/types'

type Status = 'idle' | 'loading' | 'running' | 'error'

const TARGET_FPS = 10
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS
// 저사양 기기 폴백: hardwareConcurrency < 4이면 5fps (E3-S7)
const ACTUAL_INTERVAL_MS =
  typeof navigator !== 'undefined' && navigator.hardwareConcurrency < 4
    ? 1000 / 5
    : FRAME_INTERVAL_MS

export function useMoodEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  model: IExpressionModel,
) {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<ExpressionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastInferTs = useRef(0)
  const runningRef = useRef(false)

  const start = useCallback(async () => {
    if (runningRef.current) return
    setStatus('loading')
    setError(null)

    try {
      await model.load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '모델 로드 실패')
      setStatus('error')
      return
    }

    runningRef.current = true
    setStatus('running')

    function loop(now: number) {
      if (!runningRef.current) return

      if (now - lastInferTs.current >= ACTUAL_INTERVAL_MS) {
        lastInferTs.current = now
        const video = videoRef.current
        if (video && video.readyState >= 2) {
          // 비동기 추론 — 결과가 오면 상태 업데이트
          model.infer(video).then((r) => {
            if (r) setResult(r)
          }).catch((e: unknown) => {
            console.error('[useMoodEngine] infer error:', e)
          })
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [model, videoRef])

  const stop = useCallback(() => {
    runningRef.current = false
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    model.dispose()
    setStatus('idle')
    setResult(null)
  }, [model])

  useEffect(() => {
    return () => {
      runningRef.current = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { status, result, error, start, stop }
}
