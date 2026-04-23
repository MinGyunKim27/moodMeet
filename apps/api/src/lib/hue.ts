/** valence(-1~1) → hue(0~120) */
export function moodToHue(valence: number): number {
  return Math.round(((valence + 1) / 2) * 120)
}
