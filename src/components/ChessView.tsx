import { useMemo, useState } from 'react'
import { useChess } from '../store/useChess'
import { todayISO } from '../lib/date'
import { availableClasses, ratingSeries } from '../lib/chess'
import type { ChessTimeClass } from '../types'
import { ChessSync } from './ChessSync'
import { ChessStats } from './ChessStats'
import { ChessGrid } from './ChessGrid'
import { RatingLine } from './RatingLine'

const CLASS_LABELS: Record<ChessTimeClass, string> = {
  rapid: 'Rapid',
  blitz: 'Blitz',
  bullet: 'Bullet',
  daily: 'Daily',
}

export function ChessView() {
  const today = todayISO()
  const { habit, days, settings, setUsername, runSync } = useChess()
  const color = habit?.color ?? 'blue'

  const classes = useMemo(() => availableClasses(days), [days])
  const [picked, setPicked] = useState<ChessTimeClass | null>(null)

  // Selected class for the rating line: explicit pick → primary → first.
  const activeClass: ChessTimeClass | undefined =
    picked && classes.includes(picked)
      ? picked
      : settings.primaryClass && classes.includes(settings.primaryClass)
        ? settings.primaryClass
        : classes[0]

  const totals = useMemo(() => {
    let wins = 0
    let total = 0
    for (const d of days) {
      wins += d.wins
      total += d.gamesPlayed
    }
    return { wins, total }
  }, [days])

  const series = useMemo(
    () => (activeClass ? ratingSeries(days, activeClass) : []),
    [days, activeClass],
  )

  return (
    <>
      <p className="mb-4 mt-1 text-[14px] text-[#656d76]">
        {habit?.name ?? 'Chess'} · each cell is shaded by <em>games played</em>{' '}
        that day against your recent activity — staying dark means staying active,
        not winning. The rating climb is plotted separately below, since rating is
        a variance-dominated outcome, not an activity.
      </p>

      <ChessSync
        username={settings.username ?? ''}
        lastSyncedAt={settings.lastSyncedAt}
        onSetUsername={setUsername}
        onSync={runSync}
      />

      <div className="mb-6">
        <ChessStats
          currentRatings={settings.currentRatings ?? {}}
          classes={classes}
          wins={totals.wins}
          total={totals.total}
        />
      </div>

      <section className="mb-6 rounded-lg border border-[#d0d7de] bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold text-[#1f2328]">
            The last 53 weeks
          </h2>
          <span className="text-[12px] text-[#8c959f]">
            Hover a day for games · W–L–D · rating
          </span>
        </div>
        <ChessGrid color={color} today={today} days={days} />
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-[#1f2328]">
            Rating climb
          </h2>
          {classes.length > 0 ? (
            <div className="flex gap-1">
              {classes.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPicked(c)}
                  className={`rounded-md border px-2 py-0.5 text-[12px] font-medium ${
                    activeClass === c
                      ? 'border-[#218bff] bg-[#218bff] text-white'
                      : 'border-[#d0d7de] bg-white text-[#1f2328] hover:bg-[#f3f4f6]'
                  }`}
                >
                  {CLASS_LABELS[c]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <RatingLine
          points={series}
          color={color}
          label={activeClass ? CLASS_LABELS[activeClass] : 'rated'}
        />
      </section>
    </>
  )
}
