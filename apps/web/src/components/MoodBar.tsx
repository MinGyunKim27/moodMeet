import { useEffect, useRef, useState } from 'react'
import { moodToHsl, moodLabel, NEUTRAL_COLOR } from '../lib/hue'
import type { AggregatedMood } from '../ml/LocalAggregator'

const STALE_TIMEOUT_MS = 30_000

interface Props {
  mood: AggregatedMood | null
}

export function MoodBar({ mood }: Props) {
  const [color, setColor] = useState(NEUTRAL_COLOR)
  const [label, setLabel] = useState('분위기 대기 중')
  const staleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!mood) return

    setColor(moodToHsl(mood.valence, mood.arousal))
    setLabel(moodLabel(mood.valence))

    // 30초 무수신 시 중립으로 폴백
    if (staleTimer.current) clearTimeout(staleTimer.current)
    staleTimer.current = setTimeout(() => {
      setColor(NEUTRAL_COLOR)
      setLabel('분위기 대기 중')
    }, STALE_TIMEOUT_MS)

    return () => {
      if (staleTimer.current) clearTimeout(staleTimer.current)
    }
  }, [mood])

  return (
    <div
      aria-live="polite"
      aria-label={`현재 회의 분위기: ${label}`}
      className="w-full rounded-2xl overflow-hidden"
    >
      {/* 색상 바 */}
      <div
        className="h-16 w-full transition-colors duration-1000 ease-in-out flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        <span className="text-white/80 text-sm font-medium drop-shadow">{label}</span>
      </div>

      {/* 수치 표시 */}
      {mood && (
        <div className="flex justify-between px-3 pt-2 text-xs text-neutral-500">
          <span>valence {mood.valence >= 0 ? '+' : ''}{mood.valence.toFixed(2)}</span>
          <span>arousal {mood.arousal.toFixed(2)}</span>
          <span>{mood.sampleCount} samples</span>
        </div>
      )}
    </div>
  )
}
