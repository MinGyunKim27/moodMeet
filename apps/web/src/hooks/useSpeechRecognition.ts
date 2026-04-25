import { useEffect, useRef, useState, useCallback } from 'react'

export function useSpeechRecognition(lang = 'ko-KR') {
  const [transcript, setTranscript] = useState('')
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)
  // ref로 최신 listening 상태 유지 → onend 클로저 stale 문제 해결
  const listeningRef = useRef(false)

  useEffect(() => {
    const SR =
      window.SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition
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
      // listeningRef 로 최신값 참조 → 자동 재시작 정상 동작
      if (listeningRef.current) {
        try { rec.start() } catch { /* ignore */ }
      } else {
        setTranscript('')
      }
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // 'aborted'는 stop() 호출 시 정상 발생 → 무시
      if (e.error === 'aborted') return
      // 그 외 오류는 리스닝 상태 해제
      listeningRef.current = false
      setListening(false)
    }

    recRef.current = rec

    return () => {
      listeningRef.current = false
      rec.onend = null
      rec.onerror = null
      try { rec.abort() } catch { /* ignore */ }
    }
  }, [lang])

  const start = useCallback(() => {
    if (!recRef.current || listeningRef.current) return
    listeningRef.current = true
    setListening(true)
    setFinalTranscripts([])
    setTranscript('')
    try { recRef.current.start() } catch { /* ignore */ }
  }, [])

  const stop = useCallback(() => {
    listeningRef.current = false
    setListening(false)
    setTranscript('')
    try { recRef.current?.stop() } catch { /* ignore */ }
  }, [])

  return { transcript, finalTranscripts, listening, supported, start, stop }
}
