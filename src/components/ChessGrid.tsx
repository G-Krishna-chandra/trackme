import { useCallback, useMemo, useState } from 'react'
import type { ChessDay, Level } from '../types'
import { computeLevel } from '../lib/coloring'
import { cellColor } from '../lib/colors'
import { gamesEntriesByDate } from '../lib/chess'
import { buildGrid, CELL, GAP, PITCH, WEEKDAY_COL } from '../lib/grid'
import { formatShort, monthShort } from '../lib/date'
import { DayCell } from './DayCell'

interface ChessGridProps {
  color: string
  today: string
  days: ChessDay[]
}

interface Hover {
  headline: string
  sub: string | null
  rect: DOMRect
}

const WEEKDAY_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' }
const noop = () => {}

/** Read-only contribution grid colored by games played per day (activity).
 *  Reuses the shared geometry + coloring engine; chess is synced, not edited. */
export function ChessGrid({ color, today, days }: ChessGridProps) {
  const { columns } = useMemo(() => buildGrid(today), [today])
  const [hover, setHover] = useState<Hover | null>(null)

  const daysByDate = useMemo(() => {
    const m = new Map<string, ChessDay>()
    for (const d of days) m.set(d.date, d)
    return m
  }, [days])

  const gamesByDate = useMemo(() => gamesEntriesByDate(days), [days])

  const levels = useMemo(() => {
    const m = new Map<string, Level>()
    for (const col of columns) {
      for (const date of col) {
        const e = gamesByDate.get(date)
        m.set(date, computeLevel(date, e ? e.value : 0, gamesByDate))
      }
    }
    return m
  }, [columns, gamesByDate])

  const monthLabels = useMemo(() => {
    let prev = ''
    return columns.map((col) => {
      const m = monthShort(col[0])
      if (m !== prev) {
        prev = m
        return m
      }
      return ''
    })
  }, [columns])

  const onEnter = useCallback(
    (date: string, rect: DOMRect) => {
      const d = daysByDate.get(date)
      if (!d || d.gamesPlayed === 0) {
        setHover({ headline: `${formatShort(date)} — no games`, sub: null, rect })
        return
      }
      const rating = d.lastRating !== undefined ? ` · ${d.lastRating} after` : ''
      setHover({
        headline: `${formatShort(date)} — ${d.gamesPlayed} game${d.gamesPlayed === 1 ? '' : 's'}`,
        sub: `${d.wins}W–${d.losses}L–${d.draws}D${rating}`,
        rect,
      })
    },
    [daysByDate],
  )
  const onLeave = useCallback(() => setHover(null), [])

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          <div className="flex" style={{ marginLeft: WEEKDAY_COL }}>
            {monthLabels.map((m, c) => (
              <div
                key={c}
                className="whitespace-nowrap text-[10px] text-[#656d76]"
                style={{ width: PITCH }}
              >
                {m}
              </div>
            ))}
          </div>

          <div className="flex">
            <div className="flex flex-col" style={{ width: WEEKDAY_COL, gap: GAP }}>
              {Array.from({ length: 7 }, (_, r) => (
                <div
                  key={r}
                  className="flex items-center text-[9px] text-[#656d76]"
                  style={{ height: CELL }}
                >
                  {WEEKDAY_LABELS[r] ?? ''}
                </div>
              ))}
            </div>

            <div className="flex" style={{ gap: GAP }}>
              {columns.map((col, c) => (
                <div key={c} className="flex flex-col" style={{ gap: GAP }}>
                  {col.map((date) => {
                    const d = daysByDate.get(date)
                    return (
                      <DayCell
                        key={date}
                        date={date}
                        level={levels.get(date) ?? 0}
                        value={d ? d.gamesPlayed : null}
                        unit="games"
                        color={color}
                        isFuture={date > today}
                        isToday={date === today}
                        isSelected={false}
                        onEnter={onEnter}
                        onLeave={onLeave}
                        onSelect={noop}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-[#656d76]">
        <span className="mr-1">Less</span>
        {([0, 1, 2, 3, 4] as Level[]).map((l) => (
          <span
            key={l}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 2,
              backgroundColor: cellColor(color, l),
              boxShadow: 'inset 0 0 0 1px rgba(27,31,35,0.06)',
            }}
          />
        ))}
        <span className="ml-1">More</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-[#1f2328] px-2 py-1.5 text-center text-[11px] leading-tight text-white shadow-lg"
          style={{
            top: hover.rect.top - 8,
            left: Math.max(
              72,
              Math.min(hover.rect.left + hover.rect.width / 2, window.innerWidth - 72),
            ),
            maxWidth: 240,
          }}
        >
          <div className="font-semibold">{hover.headline}</div>
          {hover.sub ? <div className="text-[#d0d7de]">{hover.sub}</div> : null}
        </div>
      )}
    </div>
  )
}
