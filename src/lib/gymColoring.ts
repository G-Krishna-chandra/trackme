import type { GymType, Level } from '../types'
import { addDays } from './date'

// Per-type rolling self-relative coloring. Same mechanic as Reading, but a
// session is judged against recent sessions OF THE SAME TRAINING TYPE — so a
// leg day's huge tonnage never washes out a push day. "Was today hard for its
// kind." Levels are derived, never stored, so editing a past session re-derives
// every dependent same-type cell for free. There is intentionally NO streak.

/** 6 weeks of trailing context. */
export const GYM_WINDOW_DAYS = 42

/** Cold-start level for the first active session of a type (empty window). */
export const GYM_COLD_START_LEVEL: Level = 3

/**
 * "Top of your recent range" for this type. v1 = max — a lowball day can't
 * lower the bar (no sandbag incentive) and a deload ages out within weeks
 * (forgiven). Swap THIS FUNCTION to the ~90th percentile later; nothing else
 * changes.
 */
export function windowCeiling(volumes: number[]): number {
  return Math.max(...volumes)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Color level 0-4 for one session, judged only against prior ACTIVE sessions of
 * the SAME type within the trailing window.
 *
 * @param volumesByDate working volume per ISO date (precomputed)
 * @param typeByDate    training type per ISO date (precomputed)
 */
export function computeGymLevel(
  date: string,
  type: GymType,
  volume: number,
  volumesByDate: Map<string, number>,
  typeByDate: Map<string, GymType>,
): Level {
  if (volume <= 0) return 0

  const windowVolumes: number[] = []
  for (let i = 1; i <= GYM_WINDOW_DAYS; i++) {
    const d = addDays(date, -i)
    if (typeByDate.get(d) !== type) continue // same type only
    const v = volumesByDate.get(d) ?? 0
    if (v > 0) windowVolumes.push(v)
  }

  if (windowVolumes.length === 0) return GYM_COLD_START_LEVEL

  const ceiling = windowCeiling(windowVolumes)
  const ratio = Math.min(volume / ceiling, 1)
  return clamp(Math.ceil(ratio * 4), 1, 4) as Level
}
