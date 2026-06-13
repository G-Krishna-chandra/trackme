import type { Entry, Level } from '../types'
import { addDays } from './date'

// The core mechanic: a day's color level is ROLLING and SELF-RELATIVE. Each
// day is judged against the ~6 weeks before IT, counting only days the habit
// was actually done. Progressive improvement keeps cells dark for free, a
// normal day reads mid-tone honestly, and a few light days are forgiven by the
// window. Levels are NEVER stored — they are pure functions of the raw entries
// computed at render time, so editing a past day re-derives every dependent
// cell automatically.

/** 6 weeks of trailing context. */
export const WINDOW_DAYS = 42

/** Cold-start level for the very first active day (empty window). */
export const COLD_START_LEVEL: Level = 3

/**
 * The "top of your recent range" used as the denominator.
 *
 * v1 = max of the recent active values. This means a single huge outlier day
 * (one 400-page binge) compresses normal days for the next 42 days — accepted
 * for v1. To soften that later, swap THIS FUNCTION to the ~90th percentile of
 * the window; nothing else in the algorithm needs to change.
 */
export function windowCeiling(activeValues: number[]): number {
  return Math.max(...activeValues)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Color level 0-4 for a single entry, within one habit.
 *
 * @param date          the entry's ISO date
 * @param value         the entry's raw value (e.g. pages)
 * @param entriesByDate all of this habit's entries keyed by ISO date
 */
export function computeLevel(
  date: string,
  value: number,
  entriesByDate: Map<string, Entry>,
): Level {
  if (value <= 0) return 0

  // Prior ACTIVE days only: [date-42, date-1] with value > 0. Excluding
  // zero/no-entry days means inconsistency never darkens the scale.
  const windowValues: number[] = []
  for (let i = 1; i <= WINDOW_DAYS; i++) {
    const e = entriesByDate.get(addDays(date, -i))
    if (e && e.value > 0) windowValues.push(e.value)
  }

  if (windowValues.length === 0) return COLD_START_LEVEL

  const ceiling = windowCeiling(windowValues)
  const ratio = Math.min(value / ceiling, 1) // matching/beating recent best = full
  return clamp(Math.ceil(ratio * 4), 1, 4) as Level // any active day is >= 1
}
