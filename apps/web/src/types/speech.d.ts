// Web Speech API — TypeScript DOM lib에 생성자 선언이 없는 부분을 보완
interface Window {
  SpeechRecognition: typeof SpeechRecognition | undefined
  webkitSpeechRecognition: typeof SpeechRecognition | undefined
}

declare class SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
  start(): void
  stop(): void
}

declare class SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

declare class SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}
