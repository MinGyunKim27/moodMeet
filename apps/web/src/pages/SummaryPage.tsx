import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type SummaryData, type UtteranceItem } from '../lib/api'

type Tab = 'summary' | 'transcript'

function renderMarkdown(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>(\n|$))+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function SummaryPage() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const [tab, setTab] = useState<Tab>('summary')
  const [data, setData] = useState<SummaryData | null>(null)
  const [utterances, setUtterances] = useState<UtteranceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!meetingId) return
    setLoading(true)
    Promise.all([
      api.getSummary(meetingId),
      api.getUtterances(meetingId),
    ])
      .then(([summary, utts]) => { setData(summary); setUtterances(utts) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [meetingId])

  const handleGenerate = async () => {
    if (!meetingId || generating) return
    setGenerating(true)
    setError(null)
    try {
      const result = await api.generateSummary(meetingId)
      setData(result)
      setTab('summary')
    } catch (e) {
      setError(e instanceof Error ? e.message : '요약 생성 실패')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">회의록</h1>
            <p className="text-xs text-neutral-500 font-mono mt-0.5 truncate max-w-[240px]">{meetingId}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/my-meetings" className="text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-600">목록</Link>
            <Link to="/" className="text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-600">홈</Link>
          </div>
        </div>

        {loading && (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-sm">불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-400 mb-4">{error}</div>
        )}

        {!loading && (
          <>
            {/* 탭 */}
            <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-1 mb-4">
              <button
                onClick={() => setTab('summary')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${tab === 'summary' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                AI 요약
              </button>
              <button
                onClick={() => setTab('transcript')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${tab === 'transcript' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                전체 발화 {utterances.length > 0 && <span className="ml-1 text-xs text-neutral-500">({utterances.length})</span>}
              </button>
            </div>

            {/* AI 요약 탭 */}
            {tab === 'summary' && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                {!data?.hasSummary ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-400 text-sm mb-4">아직 회의록이 없습니다</p>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="text-sm text-white bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 transition-colors px-4 py-2 rounded-lg"
                    >
                      {generating ? 'Claude가 요약 중...' : 'AI 회의록 생성'}
                    </button>
                  </div>
                ) : (
                  <>
                    {data.generatedAt && (
                      <p className="text-xs text-neutral-600 mb-4">
                        {new Date(data.generatedAt).toLocaleString('ko-KR')} 생성
                      </p>
                    )}
                    <div
                      className="prose-summary text-neutral-200 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(data.summaryMd) }}
                    />
                    <div className="mt-6 pt-4 border-t border-neutral-800 flex justify-end">
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="text-xs text-neutral-500 hover:text-white disabled:opacity-50 transition-colors"
                      >
                        {generating ? '재생성 중...' : '↺ 재생성'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 전체 발화 탭 */}
            {tab === 'transcript' && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                {utterances.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-neutral-500 text-sm">발화 기록이 없습니다</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-800">
                    {utterances.map((u, i) => (
                      <li key={i} className="px-5 py-3 flex gap-3">
                        {/* 이름 뱃지 */}
                        <div className="shrink-0 mt-0.5">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-neutral-800 text-xs font-medium text-neutral-300">
                            {u.displayName.slice(0, 1)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-xs font-medium text-neutral-300">{u.displayName}</span>
                            <span className="text-xs text-neutral-600">{formatTime(u.startedAt)}</span>
                          </div>
                          <p className="text-sm text-neutral-200 leading-relaxed">{u.transcript}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .prose-summary h2 {
          font-size: 1rem;
          font-weight: 600;
          color: #fff;
          margin: 1.25rem 0 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 1px solid #262626;
        }
        .prose-summary h3 {
          font-size: 0.875rem;
          font-weight: 600;
          color: #e5e5e5;
          margin: 1rem 0 0.375rem;
        }
        .prose-summary ul {
          list-style: disc;
          padding-left: 1.25rem;
          margin: 0.375rem 0;
        }
        .prose-summary li { margin: 0.25rem 0; color: #d4d4d4; }
        .prose-summary strong { color: #fff; font-weight: 600; }
      `}</style>
    </main>
  )
}
