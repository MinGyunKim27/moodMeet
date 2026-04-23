import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useMeetingStore } from '../store/meetingStore'
import { getDeviceId } from '../lib/device'

type Tab = 'create' | 'join'

export function HomePage() {
  const navigate = useNavigate()
  const setDisplayName = useMeetingStore((s) => s.setDisplayName)
  const setConnection = useMeetingStore((s) => s.setConnection)

  const [tab, setTab] = useState<Tab>('create')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [meetingCode, setMeetingCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const deviceId = getDeviceId()
      const { meeting, participantId, token, livekitUrl } = await api.createMeeting(name.trim(), deviceId, title.trim() || undefined)
      setDisplayName(name.trim())
      setConnection(token, livekitUrl, participantId)
      navigate(`/meeting/${meeting.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !meetingCode.trim()) return
    setLoading(true)
    setError(null)
    try {
      const deviceId = getDeviceId()
      const { token, livekitUrl, participantId } = await api.joinMeeting(meetingCode.trim(), name.trim(), deviceId)
      setDisplayName(name.trim())
      setConnection(token, livekitUrl, participantId)
      navigate(`/meeting/${meetingCode.trim()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">MoodMeet</h1>
          <p className="mt-1 text-sm text-neutral-400">표정으로 읽는 회의의 분위기</p>
          <Link
            to="/my-meetings"
            className="inline-block mt-3 text-xs text-neutral-500 hover:text-neutral-300 transition-colors underline underline-offset-2"
          >
            내 미팅 기록 보기
          </Link>
        </div>

        {/* 카드 */}
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-6">
          {/* 탭 */}
          <div className="flex rounded-lg bg-neutral-800 p-1 mb-6">
            {(['create', 'join'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null) }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  tab === t ? 'bg-white text-neutral-900' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {t === 'create' ? '미팅 만들기' : '미팅 참여'}
              </button>
            ))}
          </div>

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="이름" value={name} onChange={setName} placeholder="홍길동" required />
              <Field label="미팅 제목 (선택)" value={title} onChange={setTitle} placeholder="주간 팀 회의" />
              <SubmitButton loading={loading}>미팅 시작</SubmitButton>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <Field label="이름" value={name} onChange={setName} placeholder="홍길동" required />
              <Field label="미팅 코드" value={meetingCode} onChange={setMeetingCode} placeholder="meet_..." required />
              <SubmitButton loading={loading}>참여하기</SubmitButton>
            </form>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
          )}
        </div>

        {/* 하단 링크 */}
        <div className="mt-4 flex justify-center gap-4">
          <Link to="/settings" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
            ⚙ 장치 설정
          </Link>
          <Link to="/my-meetings" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
            내 미팅 기록
          </Link>
        </div>
      </div>
    </main>
  )
}

function Field({
  label, value, onChange, placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 text-sm"
      />
    </div>
  )
}

function SubmitButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
    >
      {loading ? '연결 중...' : children}
    </button>
  )
}
