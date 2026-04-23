import type { IExpressionModel, ExpressionResult } from './types'

/** 웹캠 없이 ML 파이프라인을 테스트할 때 사용 */
export class DummyModel implements IExpressionModel {
  readonly id = 'dummy'
  readonly version = '0.0.1'
  private _t = 0

  async load(): Promise<void> {
    await new Promise((r) => setTimeout(r, 300)) // 로딩 시뮬레이션
  }

  async infer(_frame: ImageBitmap | HTMLVideoElement): Promise<ExpressionResult> {
    this._t += 0.05
    // sin파로 자연스럽게 오르내리는 더미 값
    const valence = Math.sin(this._t) * 0.8
    const arousal = (Math.sin(this._t * 1.3) + 1) / 2
    return { valence, arousal, confidence: 0.85, timestamp: performance.now() }
  }

  dispose(): void {
    this._t = 0
  }
}
