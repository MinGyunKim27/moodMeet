import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type MeetingListItem } from '../lib/api'
import { getDeviceId } from '../lib/device'

function statusLabel(status: string) {
  switch (status) {
    case 'scheduled': return { text: '예정', cls: 'text-blue-400 border-blue-800' }
    case 'live':      return { text: '진행 중', cls: 'text-green-400 border-green-800' }
    case 'ended':     return { text: '종료', cls: 'text-neutral-500 border-neutral-700' }
    case 'archived':  return { text: '보관', cls: 'text-neutral-600 border-neutral-800' }
    default:          return { text: status, cls: 'text-neutral-400 border-neutral-700' }
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function MyMeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const deviceId = getDeviceId()
    api.getMyMeetings(deviceId)
      .then(setMeetings)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-neutral-950 p-4">
      <div className="max-w-xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">내 미팅 기록</h1>
            <p className="text-xs text-neutral-500 mt-0.5">이 기기에서 호스팅한 미팅 목록</p>
          </div>
          <Link
            to="/"
            className="text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-600"
          >
            홈으로
          </Link>
        </div>

        {loading && (
          <div className="text-center py-12">
            <p className="text-neutral-500 text-sm">불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && meetings.length === 0 && (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-sm">아직 미팅 기록이 없어요</p>
            <Link
              to="/"
              className="inline-block mt-4 text-sm text-white bg-neutral-800 hover:bg-neutral-700 transition-colors px-4 py-2 rounded-lg"
            >
              첫 미팅 만들기
            </Link>
          </div>
        )}

        <ul className="space-y-3">
          {meetings.map((m) => {
            const { text, cls } = statusLabel(m.status)
            return (
              <li
                key={m.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {m.title ?? '(제목 없음)'}
                    </p>
                    <p className="text-neutral-500 text-xs font-mono mt-0.5 truncate">{m.id}</p>
                    <p className="text-neutral-600 text-xs mt-1">
                      {formatDate(m.startedAt ?? m.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${cls}`}>
                      {text}
                    </span>
                    <div className="flex gap-2">
                      {m.status === 'live' && (
                        <Link
                          to={`/meeting/${m.id}`}
                          className="text-xs text-green-400 hover:text-green-300 transition-colors"
                        >
                          참여
                        </Link>
                      )}
                      <Link
                        to={`/meeting/${m.id}/summary`}
                        className="text-xs text-neutral-400 hover:text-white transition-colors"
                      >
                        회의록
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
