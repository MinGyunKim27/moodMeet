export interface ExpressionResult {
  valence: number    // -1 (부정) ~ +1 (긍정)
  arousal: number    //  0 (차분) ~  1 (격양)
  confidence: number //  0 ~ 1
  timestamp: number  // performance.now()
}

export interface IExpressionModel {
  readonly id: string
  readonly version: string
  load(): Promise<void>
  infer(frame: ImageBitmap | HTMLVideoElement): Promise<ExpressionResult | null>
  dispose(): void
}
