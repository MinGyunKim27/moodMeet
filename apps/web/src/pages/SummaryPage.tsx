import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type SummaryData, type UtteranceItem, type MoodSeriesPoint } from '../lib/api'

type Tab = 'summary' | 'transcript' | 'mood'

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

// valence(0~1) → 색상: 0=빨강, 0.5=노랑, 1=초록
function valenceColor(v: number): string {
  const clamped = Math.max(0, Math.min(1, v))
  if (clamped >= 0.5) {
    // 0.5~1 → 노랑→초록
    const t = (clamped - 0.5) * 2
    const r = Math.round(255 * (1 - t))
    const g = Math.round(200 + 55 * t)
    return `rgb(${r},${g},60)`
  } else {
    // 0~0.5 → 빨강→노랑
    const t = clamped * 2
    const r = 230
    const g = Math.round(80 * t)
    return `rgb(${r},${g},60)`
  }
}

interface MoodChartProps {
  series: MoodSeriesPoint[]
}

function MoodChart({ series }: MoodChartProps) {
  if (series.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500 text-sm">무드 데이터가 없습니다</p>
        <p className="text-neutral-600 text-xs mt-1">회의 중 표정 분석이 활성화된 경우에만 기록됩니다</p>
      </div>
    )
  }

  const W = 560
  const H = 140
  const PAD = { top: 16, right: 16, bottom: 28, left: 36 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const minTs = new Date(series[0]!.bucketTs).getTime()
  const maxTs = new Date(series[series.length - 1]!.bucketTs).getTime()
  const tRange = maxTs - minTs || 1

  const toX = (ts: string) =>
    PAD.left + ((new Date(ts).getTime() - minTs) / tRange) * innerW
  const toY = (v: number) =>
    PAD.top + (1 - Math.max(0, Math.min(1, v))) * innerH

  // polyline points
  const valencePoints = series.map((p) => `${toX(p.bucketTs)},${toY(p.valence)}`).join(' ')
  const arousalPoints = series.map((p) => `${toX(p.bucketTs)},${toY(p.arousal)}`).join(' ')

  // 평균 valence
  const avgValence = series.reduce((s, p) => s + p.valence, 0) / series.length

  // 시간 축 레이블 (최대 4개)
  const labelCount = Math.min(4, series.length)
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / (labelCount - 1 || 1)) * (series.length - 1)),
  )

  return (
    <div>
      {/* 평균 감정 뱃지 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-neutral-500">회의 평균 무드</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: valenceColor(avgValence) + '33', color: valenceColor(avgValence) }}
        >
          {avgValence >= 0.65 ? '긍정적' : avgValence >= 0.45 ? '중립' : '부정적'}
          {' '}({(avgValence * 100).toFixed(0)}%)
        </span>
        <span className="text-xs text-neutral-600">{series.length}개 버킷</span>
      </div>

      {/* SVG 차트 */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, display: 'block' }}
          aria-label="회의 중 무드 변화 그래프"
        >
          {/* 배경 구역 — 긍정(상)/부정(하) */}
          <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH / 2}
            fill="rgba(74,222,128,0.04)" />
          <rect x={PAD.left} y={PAD.top + innerH / 2} width={innerW} height={innerH / 2}
            fill="rgba(248,113,113,0.04)" />

          {/* 중립선 */}
          <line
            x1={PAD.left} y1={PAD.top + innerH / 2}
            x2={PAD.left + innerW} y2={PAD.top + innerH / 2}
            stroke="#404040" strokeWidth={1} strokeDasharray="4 3"
          />

          {/* Y 축 레이블 */}
          <text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" fill="#525252" fontSize={9}>긍정</text>
          <text x={PAD.left - 4} y={PAD.top + innerH / 2 + 4} textAnchor="end" fill="#525252" fontSize={9}>중립</text>
          <text x={PAD.left - 4} y={PAD.top + innerH + 2} textAnchor="end" fill="#525252" fontSize={9}>부정</text>

          {/* Arousal 선 (보조, 흐릿하게) */}
          <polyline
            points={arousalPoints}
            fill="none"
            stroke="#525252"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />

          {/* Valence 선 (메인) */}
          <polyline
            points={valencePoints}
            fill="none"
            stroke={valenceColor(avgValence)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* 데이터 포인트 원 */}
          {series.map((p, i) => (
            <circle
              key={i}
              cx={toX(p.bucketTs)}
              cy={toY(p.valence)}
              r={series.length > 30 ? 1.5 : 3}
              fill={valenceColor(p.valence)}
            />
          ))}

          {/* X 축 시간 레이블 */}
          {labelIndices.map((idx) => {
            const p = series[idx]!
            return (
              <text
                key={idx}
                x={toX(p.bucketTs)}
                y={H - 4}
                textAnchor="middle"
                fill="#525252"
                fontSize={9}
              >
                {new Date(p.bucketTs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </text>
            )
          })}
        </svg>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-0.5 rounded" style={{ backgroundColor: valenceColor(avgValence) }} />
          <span className="text-xs text-neutral-500">감정 (valence)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-0.5 rounded bg-neutral-600 opacity-50" />
          <span className="text-xs text-neutral-600">각성도 (arousal)</span>
        </div>
      </div>
    </div>
  )
}

export function SummaryPage() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const [tab, setTab] = useState<Tab>('summary')
  const [data, setData] = useState<SummaryData | null>(null)
  const [utterances, setUtterances] = useState<UtteranceItem[]>([])
  const [moodSeries, setMoodSeries] = useState<MoodSeriesPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!meetingId) return
    setLoading(true)
    Promise.all([
      api.getSummary(meetingId),
      api.getUtterances(meetingId),
      api.getMoodSeries(meetingId),
    ])
      .then(([summary, utts, moods]) => {
        setData(summary)
        setUtterances(utts)
        setMoodSeries(moods)
      })
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
              <button
                onClick={() => setTab('mood')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${tab === 'mood' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                무드 흐름 {moodSeries.length > 0 && <span className="ml-1 text-xs text-neutral-500">({moodSeries.length})</span>}
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

            {/* 무드 흐름 탭 */}
            {tab === 'mood' && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <MoodChart series={moodSeries} />
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
