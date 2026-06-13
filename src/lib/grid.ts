import { addDays, startOfWeek, todayISO } from './date'

/** Trailing weeks shown in the grid (GitHub shows ~53). */
export const WEEKS = 53

// Pixel geometry shared by the grid, month row, and weekday gutter so they all
// line up. PITCH is the column/row stride (cell + gap).
export const CELL = 11
export const GAP = 3
export const PITCH = CELL + GAP
export const WEEKDAY_COL = 30

/**
 * Build the grid as columns of ISO dates. Columns run oldest (left) to newest
 * (right); the rightmost column is the week containing today. Each column has 7
 * rows, Sunday (top) through Saturday (bottom). Dates after today are "future".
 */
export function buildGrid(today = todayISO()): {
  columns: string[][]
  today: string
} {
  const lastSunday = startOfWeek(today)
  const firstSunday = addDays(lastSunday, -(WEEKS - 1) * 7)
  const columns: string[][] = []
  for (let c = 0; c < WEEKS; c++) {
    const weekStart = addDays(firstSunday, c * 7)
    const col: string[] = []
    for (let r = 0; r < 7; r++) col.push(addDays(weekStart, r))
    columns.push(col)
  }
  return { columns, today }
}
