import { useEffect, useRef, useState, useCallback } from 'react'

interface SpeechResult {
  transcript: string
  isFinal: boolean
}

export function useSpeechRecognition(lang = 'ko-KR') {
  const [transcript, setTranscript] = useState('')
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    setSupported(!!SR)
    if (!SR) return

    const rec = new SR()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]!
        if (result.isFinal) {
          const text = result[0]!.transcript.trim()
          if (text) setFinalTranscripts((prev) => [...prev, text])
        } else {
          interim += result[0]!.transcript
        }
      }
      setTranscript(interim)
    }

    rec.onend = () => {
      // continuous 모드에서 끊기면 자동 재시작
      if (recRef.current && listening) {
        try { rec.start() } catch { /* ignore */ }
      }
    }

    recRef.current = rec
  }, [lang])

  const start = useCallback(() => {
    if (!recRef.current || listening) return
    setListening(true)
    setFinalTranscripts([])
    setTranscript('')
    try { recRef.current.start() } catch { /* ignore */ }
  }, [listening])

  const stop = useCallback(() => {
    setListening(false)
    try { recRef.current?.stop() } catch { /* ignore */ }
  }, [])

  return { transcript, finalTranscripts, listening, supported, start, stop }
}
