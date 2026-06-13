import type { Entry } from '../types'
import { addDays, startOfWeek, todayISO } from './date'

/** Index entries by ISO date for O(1) lookup. One entry per (habit, date). */
export function indexByDate(entries: Entry[]): Map<string, Entry> {
  const m = new Map<string, Entry>()
  for (const e of entries) m.set(e.date, e)
  return m
}

/** A day "counts" toward streaks/windows only if the habit was actually done. */
function active(map: Map<string, Entry>, iso: string): boolean {
  const e = map.get(iso)
  return !!e && e.value > 0
}

/**
 * Consecutive active days counting back from today.
 *
 * Today-not-yet-logged does NOT break the streak (today is still open); only a
 * fully-elapsed zero/missing day breaks it. So an unlogged today simply starts
 * the count from yesterday.
 */
export function currentStreak(
  map: Map<string, Entry>,
  today = todayISO(),
): number {
  let streak = 0
  let d = today
  if (active(map, d)) {
    streak++
  }
  // Whether or not today was active, walk backwards from yesterday.
  d = addDays(d, -1)
  while (active(map, d)) {
    streak++
    d = addDays(d, -1)
  }
  return streak
}

/** Longest run of consecutive active days anywhere in the history. */
export function longestStreak(entries: Entry[], today = todayISO()): number {
  const actives = entries.filter((e) => e.value > 0).map((e) => e.date)
  if (actives.length === 0) return 0
  const map = indexByDate(entries)
  actives.sort()
  let longest = 0
  let run = 0
  let d = actives[0]
  while (d <= today) {
    if (active(map, d)) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
    d = addDays(d, 1)
  }
  return longest
}

/** Sum of all raw values (active days only). */
export function totalValue(entries: Entry[]): number {
  return entries.reduce((sum, e) => sum + (e.value > 0 ? e.value : 0), 0)
}

/** Sum of values from the start of this week (Sunday) through today. */
export function valueThisWeek(
  map: Map<string, Entry>,
  today = todayISO(),
): number {
  let total = 0
  let d = startOfWeek(today)
  while (d <= today) {
    const e = map.get(d)
    if (e && e.value > 0) total += e.value
    d = addDays(d, 1)
  }
  return total
}

export interface WeekTotal {
  weekStart: string
  total: number
}

/**
 * Raw weekly totals from the first active week through the current week, for
 * the absolute long-run sparkline. Deliberately separate from the self-relative
 * colored grid.
 */
export function weeklyTotals(entries: Entry[], today = todayISO()): WeekTotal[] {
  const actives = entries.filter((e) => e.value > 0).map((e) => e.date)
  if (actives.length === 0) return []
  const map = indexByDate(entries)
  actives.sort()
  const out: WeekTotal[] = []
  let w = startOfWeek(actives[0])
  const end = startOfWeek(today)
  while (w <= end) {
    let total = 0
    for (let i = 0; i < 7; i++) {
      const e = map.get(addDays(w, i))
      if (e && e.value > 0) total += e.value
    }
    out.push({ weekStart: w, total })
    w = addDays(w, 7)
  }
  return out
}
