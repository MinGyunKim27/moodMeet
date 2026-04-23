import type { ExpressionResult } from './types'

const WINDOW_MS = 5000 // 5초 버킷
const MAX_SAMPLES = 50  // 10fps × 5s

export interface AggregatedMood {
  valence: number  // -1 ~ 1
  arousal: number  //  0 ~ 1
  sampleCount: number
  bucketTs: number // performance.now()
}

export class LocalAggregator {
  private _samples: ExpressionResult[] = []
  private _lastFlushTs = 0

  push(result: ExpressionResult): AggregatedMood | null {
    this._samples.push(result)

    // 최대 50개만 유지 (오래된 것부터 제거)
    if (this._samples.length > MAX_SAMPLES) {
      this._samples.shift()
    }

    const now = performance.now()
    if (now - this._lastFlushTs < WINDOW_MS) return null

    // 5초 경과 → flush
    this._lastFlushTs = now
    return this._flush()
  }

  /** 현재 샘플로 즉시 집계 (UI 실시간 표시용) */
  current(): AggregatedMood | null {
    if (this._samples.length === 0) return null
    return this._aggregate(this._samples)
  }

  private _flush(): AggregatedMood | null {
    if (this._samples.length === 0) return null
    const result = this._aggregate(this._samples)
    this._samples = []
    return result
  }

  private _aggregate(samples: ExpressionResult[]): AggregatedMood {
    const n = samples.length
    const valence = samples.reduce((s, r) => s + r.valence, 0) / n
    const arousal = samples.reduce((s, r) => s + r.arousal, 0) / n
    return { valence, arousal, sampleCount: n, bucketTs: performance.now() }
  }

  reset() {
    this._samples = []
    this._lastFlushTs = 0
  }
}
