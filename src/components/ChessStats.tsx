import type { ChessTimeClass } from '../types'

interface ChessStatsProps {
  currentRatings: Partial<Record<ChessTimeClass, number>>
  /** Classes with rating data, in display order. */
  classes: ChessTimeClass[]
  wins: number
  total: number
}

const CLASS_LABELS: Record<ChessTimeClass, string> = {
  rapid: 'Rapid',
  blitz: 'Blitz',
  bullet: 'Bullet',
  daily: 'Daily',
}

export function ChessStats({ currentRatings, classes, wins, total }: ChessStatsProps) {
  const ratingClasses = classes.filter((c) => currentRatings[c] !== undefined)
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex-1 rounded-lg border border-[#d0d7de] bg-white px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#656d76]">
          Current rating
        </div>
        {ratingClasses.length === 0 ? (
          <div className="mt-1 text-[13px] text-[#8c959f]">Sync to see ratings</div>
        ) : (
          <div className="mt-1 flex flex-col gap-0.5">
            {ratingClasses.map((c) => (
              <div key={c} className="flex items-baseline justify-between text-[12px]">
                <span className="text-[#656d76]">{CLASS_LABELS[c]}</span>
                <span className="font-semibold tabular-nums text-[#1f2328]">
                  {currentRatings[c]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 rounded-lg border border-[#d0d7de] bg-white px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#656d76]">
          Win rate
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-[#1f2328]">
          {total > 0 ? `${winRate}%` : '—'}
        </div>
        <div className="text-[11px] text-[#8c959f]">
          {total > 0 ? `${wins} of ${total} rated games. ` : ''}
          Ranked win rate sits near 50% by matchmaking design — informational,
          not a target.
        </div>
      </div>
    </div>
  )
}
