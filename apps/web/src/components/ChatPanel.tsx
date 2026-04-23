import { useEffect, useRef, useState } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'

interface ChatMessage {
  id: number
  sender: string
  text: string
  isMine: boolean
  ts: Date
}

interface ChatPayload {
  type: 'chat'
  sender: string
  text: string
}

let msgIdCounter = 0

export function ChatPanel({
  open,
  onClose,
  myName,
}: {
  open: boolean
  onClose: () => void
  myName: string
}) {
  const room = useRoomContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // 수신 메시지 처리
  useEffect(() => {
    const handler = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload)) as ChatPayload
        if (data.type !== 'chat') return
        setMessages((prev) => [
          ...prev,
          { id: ++msgIdCounter, sender: data.sender, text: data.text, isMine: false, ts: new Date() },
        ])
      } catch { /* ignore */ }
    }
    room.on(RoomEvent.DataReceived, handler)
    return () => { room.off(RoomEvent.DataReceived, handler) }
  }, [room])

  // 새 메시지 오면 스크롤 아래로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    const text = input.trim()
    if (!text) return
    const payload: ChatPayload = { type: 'chat', sender: myName, text }
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(payload)),
      { reliable: true },
    )
    setMessages((prev) => [
      ...prev,
      { id: ++msgIdCounter, sender: myName, text, isMine: true, ts: new Date() },
    ])
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!open) return null

  return (
    <div className="flex flex-col w-72 h-full border-l border-neutral-800 bg-neutral-950">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-sm font-medium text-white">채팅</span>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-neutral-600 text-center mt-4">아직 메시지가 없습니다</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isMine ? 'items-end' : 'items-start'}`}>
            {!msg.isMine && (
              <span className="text-xs text-neutral-500 mb-0.5">{msg.sender}</span>
            )}
            <div
              className={`max-w-[220px] rounded-xl px-3 py-1.5 text-sm break-words ${
                msg.isMine
                  ? 'bg-white text-neutral-900 rounded-br-sm'
                  : 'bg-neutral-800 text-neutral-100 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
            <span className="text-xs text-neutral-700 mt-0.5">
              {msg.ts.getHours().toString().padStart(2, '0')}:{msg.ts.getMinutes().toString().padStart(2, '0')}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-3 py-2 border-t border-neutral-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력..."
          className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="px-3 py-1.5 rounded-lg bg-white text-neutral-900 text-sm font-medium disabled:opacity-30 hover:bg-neutral-100 transition-colors"
        >
          전송
        </button>
      </div>
    </div>
  )
}
