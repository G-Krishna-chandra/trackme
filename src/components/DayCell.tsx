import { memo } from 'react'
import type { Level } from '../types'
import { cellColor } from '../lib/colors'
import { CELL } from '../lib/grid'
import { formatShort } from '../lib/date'

interface DayCellProps {
  date: string
  level: Level
  /** Raw value, or null when there is no entry for this date. */
  value: number | null
  unit: string
  color: string
  isFuture: boolean
  isToday: boolean
  isSelected: boolean
  onEnter: (date: string, rect: DOMRect) => void
  onLeave: () => void
  onSelect: (date: string, rect: DOMRect) => void
}

function DayCellImpl({
  date,
  level,
  value,
  unit,
  color,
  isFuture,
  isToday,
  isSelected,
  onEnter,
  onLeave,
  onSelect,
}: DayCellProps) {
  const base = {
    width: CELL,
    height: CELL,
    borderRadius: 2,
  } as const

  // Future days complete the 7-row rectangle but aren't interactive.
  if (isFuture) {
    return (
      <div
        aria-hidden
        style={{ ...base, backgroundColor: cellColor(color, 0), opacity: 0.4 }}
      />
    )
  }

  const label =
    value && value > 0
      ? `${formatShort(date)}: ${value} ${unit}`
      : `${formatShort(date)}: nothing logged`

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onMouseEnter={(e) => onEnter(date, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onLeave}
      onClick={(e) => onSelect(date, e.currentTarget.getBoundingClientRect())}
      style={{
        ...base,
        backgroundColor: cellColor(color, level),
        boxShadow:
          isToday || isSelected
            ? 'inset 0 0 0 1px rgba(31,35,40,0.65)'
            : 'inset 0 0 0 1px rgba(27,31,35,0.06)',
        cursor: 'pointer',
      }}
    />
  )
}

export const DayCell = memo(DayCellImpl)
