import { useCallback, useMemo, useState } from 'react'
import type { Book, Entry, Habit, Level } from '../types'
import { computeLevel } from '../lib/coloring'
import { cellColor } from '../lib/colors'
import { buildGrid, CELL, GAP, PITCH, WEEKDAY_COL } from '../lib/grid'
import { formatShort, monthShort } from '../lib/date'
import { DayCell } from './DayCell'
import { CellEditor } from './CellEditor'

interface ContributionGridProps {
  habit: Habit
  entriesByDate: Map<string, Entry>
  /** Books keyed by id, to resolve an entry's attached title for the tooltip. */
  booksById: Map<string, Book>
  /** Currently-reading book, the default attachment when editing today. */
  activeBook: Book | undefined
  currentStreak: number
  today: string
  onSetEntry: (date: string, value: number, note: string, bookId?: string) => void
  onClearEntry: (date: string) => void
  onSelectBook: (book: Book) => Book
}

interface Hover {
  date: string
  value: number | null
  /** Attached book title (preferred) or freeform note, for the detail line. */
  detail: string | undefined
  rect: DOMRect
}

interface Selection {
  date: string
  rect: DOMRect
}

// Weekday gutter labels (GitHub shows Mon/Wed/Fri). Index = row (Sun..Sat).
const WEEKDAY_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' }

export function ContributionGrid({
  habit,
  entriesByDate,
  booksById,
  activeBook,
  currentStreak,
  today,
  onSetEntry,
  onClearEntry,
  onSelectBook,
}: ContributionGridProps) {
  const { columns } = useMemo(() => buildGrid(today), [today])
  const [hover, setHover] = useState<Hover | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  // Precompute each cell's level once per data change, so transient hover/
  // selection re-renders don't re-run the rolling-window math for 371 cells.
  const levels = useMemo(() => {
    const m = new Map<string, Level>()
    for (const col of columns) {
      for (const date of col) {
        const e = entriesByDate.get(date)
        m.set(date, computeLevel(date, e ? e.value : 0, entriesByDate))
      }
    }
    return m
  }, [columns, entriesByDate])

  // Month label per column: shown when the column's first day starts a new month.
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
      const e = entriesByDate.get(date)
      const bookTitle = e?.bookId ? booksById.get(e.bookId)?.title : undefined
      setHover({
        date,
        value: e ? e.value : null,
        detail: bookTitle ?? e?.note,
        rect,
      })
    },
    [entriesByDate, booksById],
  )
  const onLeave = useCallback(() => setHover(null), [])
  const onSelect = useCallback((date: string, rect: DOMRect) => {
    setHover(null)
    setSelection({ date, rect })
  }, [])

  const selectedEntry = selection
    ? entriesByDate.get(selection.date)
    : undefined
  // Default attachment: the entry's own book, or the active book when it's today
  // (past days don't silently inherit "currently reading").
  const selectedInitialBook = selection
    ? selectedEntry?.bookId
      ? booksById.get(selectedEntry.bookId)
      : selection.date === today
        ? activeBook
        : undefined
    : undefined

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          {/* Month labels row, offset past the weekday gutter. */}
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
            {/* Weekday gutter. */}
            <div
              className="flex flex-col"
              style={{ width: WEEKDAY_COL, gap: GAP }}
            >
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

            {/* Week columns. */}
            <div className="flex" style={{ gap: GAP }}>
              {columns.map((col, c) => (
                <div key={c} className="flex flex-col" style={{ gap: GAP }}>
                  {col.map((date) => {
                    const entry = entriesByDate.get(date)
                    const level: Level = levels.get(date) ?? 0
                    return (
                      <DayCell
                        key={date}
                        date={date}
                        level={level}
                        value={entry ? entry.value : null}
                        unit={habit.unit}
                        color={habit.color}
                        isFuture={date > today}
                        isToday={date === today}
                        isSelected={selection?.date === date}
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

      {/* Legend. */}
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-[#656d76]">
        <span className="mr-1">Less</span>
        {([0, 1, 2, 3, 4] as Level[]).map((l) => (
          <span
            key={l}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 2,
              backgroundColor: cellColor(habit.color, l),
              boxShadow: 'inset 0 0 0 1px rgba(27,31,35,0.06)',
            }}
          />
        ))}
        <span className="ml-1">More</span>
      </div>

      {hover && (
        <Tooltip
          date={hover.date}
          value={hover.value}
          detail={hover.detail}
          unit={habit.unit}
          currentStreak={currentStreak}
          rect={hover.rect}
        />
      )}

      {selection && (
        <CellEditor
          date={selection.date}
          unit={habit.unit}
          entry={selectedEntry}
          initialBook={selectedInitialBook}
          rect={selection.rect}
          onSelectBook={onSelectBook}
          onSave={(date, value, note, bookId) => {
            onSetEntry(date, value, note, bookId)
            setSelection(null)
          }}
          onClear={(date) => {
            onClearEntry(date)
            setSelection(null)
          }}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  )
}

interface TooltipProps {
  date: string
  value: number | null
  /** Book title (preferred) or note, appended to the raw-value line. */
  detail: string | undefined
  unit: string
  currentStreak: number
  rect: DOMRect
}

function Tooltip({ date, value, detail, unit, currentStreak, rect }: TooltipProps) {
  const top = rect.top - 8
  const left = Math.max(
    72,
    Math.min(rect.left + rect.width / 2, window.innerWidth - 72),
  )
  const headline =
    value && value > 0
      ? `${formatShort(date)} — ${value} ${unit}`
      : `${formatShort(date)} — nothing logged`

  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-[#1f2328] px-2 py-1.5 text-center text-[11px] leading-tight text-white shadow-lg"
      style={{ top, left, maxWidth: 220 }}
    >
      <div className="font-semibold">
        {headline}
        {detail ? <span className="font-normal"> · {detail}</span> : null}
      </div>
      <div className="mt-0.5 text-[#8c959f]">
        Current streak: {currentStreak}{' '}
        {currentStreak === 1 ? 'day' : 'days'}
      </div>
    </div>
  )
}
