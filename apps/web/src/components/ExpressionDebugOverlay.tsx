import type { ExpressionResult } from '../ml/types'

interface Props {
  result: ExpressionResult | null
  status: 'idle' | 'loading' | 'running' | 'error'
  error?: string | null
}

export function ExpressionDebugOverlay({ result, status, error }: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-50 min-w-[200px] rounded-xl bg-black/80 backdrop-blur p-4 text-xs font-mono text-white border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <StatusDot status={status} />
        <span className="font-semibold text-white/70 uppercase tracking-wider">ML Debug</span>
      </div>

      {status === 'loading' && <p className="text-yellow-400">모델 로드 중...</p>}
      {status === 'error' && <p className="text-red-400">{error ?? '오류'}</p>}

      {result ? (
        <div className="space-y-2">
          <ScoreBar label="Valence" value={result.valence} min={-1} max={1} color={valenceColor(result.valence)} />
          <ScoreBar label="Arousal" value={result.arousal} min={0} max={1} color="oklch(0.7 0.2 260)" />
          <div className="flex justify-between text-white/50 pt-1 border-t border-white/10">
            <span>conf</span>
            <span>{(result.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      ) : (
        status === 'running' && (
          <p className="text-white/40">얼굴 감지 대기 중...</p>
        )
      )}
    </div>
  )
}

function ScoreBar({ label, value, min, max, color }: {
  label: string; value: number; min: number; max: number; color: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const display = value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2)

  return (
    <div>
      <div className="flex justify-between mb-1 text-white/60">
        <span>{label}</span>
        <span style={{ color }}>{display}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'running' ? 'bg-green-400' :
    status === 'loading' ? 'bg-yellow-400 animate-pulse' :
    status === 'error'   ? 'bg-red-400' :
                           'bg-white/20'
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
}

function valenceColor(v: number) {
  if (v > 0.2) return 'oklch(0.75 0.2 145)'  // 초록
  if (v < -0.2) return 'oklch(0.65 0.25 25)'  // 빨강
  return 'oklch(0.8 0.1 90)'                  // 노랑 (중립)
}
