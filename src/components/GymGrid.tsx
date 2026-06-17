import { useCallback, useMemo, useState } from 'react'
import type { GymExercise, GymSession, GymType, Level } from '../types'
import { computeGymLevel } from '../lib/gymColoring'
import { cellColor } from '../lib/colors'
import { buildGrid, CELL, GAP, PITCH, WEEKDAY_COL } from '../lib/grid'
import { formatShort, monthShort } from '../lib/date'
import { GYM_TYPE_LABELS, topExercise, workingVolume } from '../lib/gym'
import { DayCell } from './DayCell'
import { GymSessionForm } from './GymSessionForm'

interface GymGridProps {
  color: string
  today: string
  sessionsByDate: Map<string, GymSession>
  bodyweight: number
  weightUnit: 'kg' | 'lbs'
  rememberedNames: string[]
  onSaveSession: (
    date: string,
    type: GymType,
    exercises: GymExercise[],
    note: string,
  ) => void
  onDeleteSession: (date: string) => void
}

interface Hover {
  date: string
  headline: string
  sub: string | null
  rect: DOMRect
}

const WEEKDAY_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' }

function workingSetCount(session: GymSession): number {
  let n = 0
  for (const ex of session.exercises) for (const s of ex.sets) if (!s.warmup) n++
  return n
}

export function GymGrid({
  color,
  today,
  sessionsByDate,
  bodyweight,
  weightUnit,
  rememberedNames,
  onSaveSession,
  onDeleteSession,
}: GymGridProps) {
  const { columns } = useMemo(() => buildGrid(today), [today])
  const [hover, setHover] = useState<Hover | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Precompute per-date volume + type, then per-cell level (per-type window).
  const { volumesByDate, typeByDate } = useMemo(() => {
    const vols = new Map<string, number>()
    const types = new Map<string, GymType>()
    for (const [date, s] of sessionsByDate) {
      vols.set(date, workingVolume(s, bodyweight))
      types.set(date, s.type)
    }
    return { volumesByDate: vols, typeByDate: types }
  }, [sessionsByDate, bodyweight])

  const levels = useMemo(() => {
    const m = new Map<string, Level>()
    for (const col of columns) {
      for (const date of col) {
        const t = typeByDate.get(date)
        m.set(
          date,
          t !== undefined
            ? computeGymLevel(date, t, volumesByDate.get(date) ?? 0, volumesByDate, typeByDate)
            : 0,
        )
      }
    }
    return m
  }, [columns, volumesByDate, typeByDate])

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
      const s = sessionsByDate.get(date)
      if (!s) {
        setHover({ date, headline: `${formatShort(date)} — no session`, sub: null, rect })
        return
      }
      const vol = Math.round(workingVolume(s, bodyweight))
      const top = topExercise(s, bodyweight)
      const detail = top ?? `${workingSetCount(s)} sets`
      setHover({
        date,
        headline: `${formatShort(date)} — ${vol.toLocaleString()} ${weightUnit}`,
        sub: `${GYM_TYPE_LABELS[s.type]} · ${detail}`,
        rect,
      })
    },
    [sessionsByDate, bodyweight, weightUnit],
  )
  const onLeave = useCallback(() => setHover(null), [])
  const onSelect = useCallback((date: string, _rect: DOMRect) => {
    setHover(null)
    setSelected(date)
  }, [])

  const selectedSession = selected ? sessionsByDate.get(selected) : undefined

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
                    const vol = volumesByDate.get(date)
                    return (
                      <DayCell
                        key={date}
                        date={date}
                        level={levels.get(date) ?? 0}
                        value={vol !== undefined ? Math.round(vol) : null}
                        unit={weightUnit}
                        color={color}
                        isFuture={date > today}
                        isToday={date === today}
                        isSelected={selected === date}
                        onEnter={onEnter}
                        onLeave={onLeave}
                        onSelect={onSelect}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend. Darkness = intensity for the day's own training type. */}
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="mt-12 w-full max-w-[480px] rounded-lg border border-[#d0d7de] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <GymSessionForm
              key={selected}
              date={selected}
              initial={selectedSession}
              weightUnit={weightUnit}
              bodyweight={bodyweight}
              rememberedNames={rememberedNames}
              variant="modal"
              onSave={(date, type, exercises, note) => {
                onSaveSession(date, type, exercises, note)
                setSelected(null)
              }}
              onDelete={(date) => {
                onDeleteSession(date)
                setSelected(null)
              }}
              onCancel={() => setSelected(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
