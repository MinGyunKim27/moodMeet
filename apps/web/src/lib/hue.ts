/**
 * valence/arousal → HSL 색상
 * ML Benchmark §E4-S4 기준:
 *   valence +1 → hue 120 (초록)
 *   valence  0 → hue  60 (노랑)
 *   valence -1 → hue   0 (빨강)
 *   arousal 높을수록 saturation↑
 */
export function moodToHsl(valence: number, arousal: number): string {
  const hue = Math.round(((valence + 1) / 2) * 120) // 0~120
  const sat = Math.round(30 + arousal * 50)          // 30~80%
  const lit = Math.round(35 + (1 - arousal) * 15)   // 35~50%
  return `hsl(${hue}, ${sat}%, ${lit}%)`
}

export function moodLabel(valence: number): string {
  if (valence > 0.4) return '긍정적 분위기'
  if (valence < -0.4) return '부정적 분위기'
  return '중립적 분위기'
}

/** 30초 무수신 시 중립 회색 */
export const NEUTRAL_COLOR = 'hsl(0, 0%, 30%)'
