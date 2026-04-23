import type { ExpressionResult } from './types'

// face-api.js FaceExpressions 타입
export interface FaceExpressions {
  neutral: number
  happy: number
  sad: number
  angry: number
  fearful: number
  disgusted: number
  surprised: number
}

/**
 * Russell's circumplex model 근사 변환
 * ML Benchmark 문서 §7.2 기준
 */
export function normalize(expr: FaceExpressions): ExpressionResult {
  const { happy, surprised, angry, sad, disgusted, fearful } = expr

  const rawValence = happy + 0.3 * surprised - angry - sad - disgusted - 0.5 * fearful
  const rawArousal = angry + fearful + surprised + 0.5 * happy

  const valence = Math.max(-1, Math.min(1, rawValence))
  const arousal = Math.max(0, Math.min(1, rawArousal))

  // 가장 높은 감정 확률을 confidence로
  const values = Object.values(expr) as number[]
  const confidence = Math.max(...values)

  return { valence, arousal, confidence, timestamp: performance.now() }
}
