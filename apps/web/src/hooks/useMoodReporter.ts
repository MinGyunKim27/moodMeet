import { useEffect, useRef, useCallback } from 'react'
import type { AggregatedMood } from '../ml/LocalAggregator'

const WS_BASE = import.meta.env['VITE_WS_URL']
  ?? (import.meta.env['VITE_API_URL']
    ? import.meta.env['VITE_API_URL'].replace('https://', 'wss://').replace('http://', 'ws://') + '/api/mood'
    : 'ws://localhost:4000/api/mood')
const REPORT_INTERVAL_MS = 5000

export function useMoodReporter(
  meetingId: string | null,
  participantId: string | null,
  getMood: () => AggregatedMood | null,
  isSpeaking: boolean,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onMoodUpdate = useRef<((mood: { valence: number; arousal: number; hue: number }) => void) | null>(null)
  // isSpeaking을 ref로 관리 → WebSocket 재연결 없이 최신값 사용
  const isSpeakingRef = useRef(isSpeaking)
  useEffect(() => { isSpeakingRef.current = isSpeaking }, [isSpeaking])

  const setOnMoodUpdate = useCallback(
    (cb: (mood: { valence: number; arousal: number; hue: number }) => void) => {
      onMoodUpdate.current = cb
    },
    [],
  )

  useEffect(() => {
    if (!meetingId || !participantId) return

    const url = `${WS_BASE}/${meetingId}?participantId=${participantId}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as {
          type: string; valence: number; arousal: number; hue: number
        }
        if (data.type === 'mood_update' && onMoodUpdate.current) {
          onMoodUpdate.current(data)
        }
      } catch { /* ignore */ }
    }

    // 5초마다 로컬 집계 결과 WS로 송신
    timerRef.current = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      const mood = getMood()
      if (!mood) return
      ws.send(JSON.stringify({
        participantId,
        valenceAvg: mood.valence,
        arousalAvg: mood.arousal,
        samples: mood.sampleCount,
        isSpeaking: isSpeakingRef.current, // ref로 최신값 사용
      }))
    }, REPORT_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      ws.close()
    }
  // isSpeaking 제거 → STT 토글해도 WS 재연결 안 함
  }, [meetingId, participantId, getMood])

  return { setOnMoodUpdate }
}
