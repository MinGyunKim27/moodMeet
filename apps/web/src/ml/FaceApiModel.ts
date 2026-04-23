import * as faceapi from '@vladmandic/face-api'
import type { IExpressionModel, ExpressionResult } from './types'
import { normalize } from './ScoreNormalizer'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,      // 기본 416보다 작게 → 더 빠름
  scoreThreshold: 0.3, // 기본 0.5보다 낮게 → 더 잘 감지
})

// 추론 전용 HTMLCanvasElement (DOM에 붙이지 않음)
let _canvas: HTMLCanvasElement | null = null
let _ctx: CanvasRenderingContext2D | null = null

function getCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_canvas) {
    _canvas = document.createElement('canvas')
    _ctx = _canvas.getContext('2d')!
  }
  if (_canvas.width !== w || _canvas.height !== h) {
    _canvas.width = w
    _canvas.height = h
  }
  return { canvas: _canvas, ctx: _ctx! }
}

export class FaceApiModel implements IExpressionModel {
  readonly id = '@vladmandic/face-api'
  readonly version = '1.7.15'
  private _loaded = false

  async load(): Promise<void> {
    if (this._loaded) return
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ])
    this._loaded = true
    console.log('[FaceApiModel] 모델 로드 완료')
  }

  async infer(frame: ImageBitmap | HTMLVideoElement): Promise<ExpressionResult | null> {
    if (!this._loaded) return null

    // HTMLVideoElement는 face-api.js에 직접 전달 가능
    let input: HTMLVideoElement | HTMLCanvasElement

    if (frame instanceof HTMLVideoElement) {
      if (!frame.videoWidth || !frame.videoHeight) return null
      input = frame
    } else {
      const { canvas, ctx } = getCanvas(frame.width, frame.height)
      ctx.drawImage(frame, 0, 0)
      input = canvas
    }

    const detection = await faceapi
      .detectSingleFace(input, DETECTOR_OPTIONS)
      .withFaceExpressions()

    if (!detection) return null

    const result = normalize(detection.expressions as Parameters<typeof normalize>[0])
    if (result.confidence < 0.5) return null

    return result
  }

  dispose(): void {
    _canvas = null
    _ctx = null
    this._loaded = false
  }
}
