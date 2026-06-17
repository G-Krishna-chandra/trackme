import type { GymExercise, GymSession, GymType } from '../types'
import { addDays, startOfWeek, todayISO } from './date'
import type { WeekTotal } from './stats'

export const GYM_TYPES: GymType[] = ['push', 'pull', 'legs', 'arms', 'other']

export const GYM_TYPE_LABELS: Record<GymType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  arms: 'Arms',
  other: 'Other',
}

/**
 * Working volume = sum over NON-warmup sets of effWeight × reps, where
 * effWeight = (bodyweight + added weight) for bodyweight moves, else the set's
 * weight. Computed at render time; never stored.
 */
export function volumeOfExercises(
  exercises: GymExercise[],
  bodyweight: number,
): number {
  let v = 0
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.warmup) continue
      const eff = ex.isBodyweight ? bodyweight + s.weight : s.weight
      v += eff * s.reps
    }
  }
  return v
}

export function workingVolume(session: GymSession, bodyweight: number): number {
  return volumeOfExercises(session.exercises, bodyweight)
}

/** Sessions keyed by ISO date. One session per day; a later one wins. */
export function indexSessionsByDate(
  sessions: GymSession[],
): Map<string, GymSession> {
  const m = new Map<string, GymSession>()
  for (const s of sessions) m.set(s.date, s)
  return m
}

export interface DayAggregate {
  date: string
  /** All sessions on this date (usually one). */
  sessions: GymSession[]
  /** Summed working volume across the day's sessions. */
  volume: number
  /** Training type of the day's primary (largest-volume) session. */
  type: GymType
  /** The largest-volume session — the one the cell editor opens. */
  primary: GymSession
}

/**
 * Aggregate sessions per calendar day. Multiple sessions can share a date (a
 * manual log plus a synced one, or two workouts the same day); the grid colors
 * by the SUMMED volume and the primary session's type. The coloring math itself
 * is unchanged — it just receives one volume + one type per day.
 */
export function aggregateByDate(
  sessions: GymSession[],
  bodyweight: number,
): Map<string, DayAggregate> {
  const byDate = new Map<string, GymSession[]>()
  for (const s of sessions) {
    const list = byDate.get(s.date) ?? []
    list.push(s)
    byDate.set(s.date, list)
  }
  const out = new Map<string, DayAggregate>()
  for (const [date, list] of byDate) {
    let volume = 0
    let primary = list[0]
    let primaryVol = -1
    for (const s of list) {
      const v = workingVolume(s, bodyweight)
      volume += v
      if (v > primaryVol) {
        primaryVol = v
        primary = s
      }
    }
    out.set(date, { date, sessions: list, volume, type: primary.type, primary })
  }
  return out
}

export function sessionsThisWeek(
  sessions: GymSession[],
  today = todayISO(),
): number {
  const start = startOfWeek(today)
  return sessions.filter((s) => s.date >= start && s.date <= today).length
}

export function volumeThisWeek(
  sessions: GymSession[],
  bodyweight: number,
  today = todayISO(),
): number {
  const start = startOfWeek(today)
  return sessions
    .filter((s) => s.date >= start && s.date <= today)
    .reduce((sum, s) => sum + workingVolume(s, bodyweight), 0)
}

/** Best (max) working volume achieved per training type. */
export function bestVolumeByType(
  sessions: GymSession[],
  bodyweight: number,
): Record<GymType, number> {
  const best: Record<GymType, number> = {
    push: 0,
    pull: 0,
    legs: 0,
    arms: 0,
    other: 0,
  }
  for (const s of sessions) {
    const v = workingVolume(s, bodyweight)
    if (v > best[s.type]) best[s.type] = v
  }
  return best
}

/** The exercise contributing the most working volume in a session. */
export function topExercise(
  session: GymSession,
  bodyweight: number,
): string | null {
  let best: { name: string; v: number } | null = null
  for (const ex of session.exercises) {
    const v = volumeOfExercises([ex], bodyweight)
    if (!best || v > best.v) best = { name: ex.name, v }
  }
  return best && best.name ? best.name : null
}

/** Unique exercise names seen across past sessions, most-recent first. */
export function rememberedExerciseNames(sessions: GymSession[]): string[] {
  const seen = new Set<string>()
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1))
  const names: string[] = []
  for (const s of ordered) {
    for (const ex of s.exercises) {
      const name = ex.name.trim()
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        names.push(name)
      }
    }
  }
  return names
}

/** Weekly total working volume — the absolute long-run trend (sparkline). */
export function gymWeeklyTotals(
  sessions: GymSession[],
  bodyweight: number,
  today = todayISO(),
): WeekTotal[] {
  const active = sessions.filter((s) => workingVolume(s, bodyweight) > 0)
  if (active.length === 0) return []
  // Sum every session into its week (multiple sessions per day are all counted).
  const byWeek = new Map<string, number>()
  for (const s of active) {
    const wk = startOfWeek(s.date)
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + workingVolume(s, bodyweight))
  }
  const firstDate = active.map((s) => s.date).sort()[0]
  const out: WeekTotal[] = []
  let w = startOfWeek(firstDate)
  const end = startOfWeek(today)
  while (w <= end) {
    out.push({ weekStart: w, total: byWeek.get(w) ?? 0 })
    w = addDays(w, 7)
  }
  return out
}
