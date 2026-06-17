import type { GymSession, GymSettings } from '../types'
import type { GymRepository } from './GymRepository'

const SESSIONS_KEY = 'trackme.gymSessions'
const SETTINGS_KEY = 'trackme.gymSettings'

const DEFAULT_SETTINGS: GymSettings = { bodyweight: 70, weightUnit: 'kg' }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/** localStorage-backed GymRepository. Stores ONLY raw sessions (no volume/level). */
export class LocalStorageGymRepository implements GymRepository {
  listSessions(habitId: string): GymSession[] {
    return read<GymSession[]>(SESSIONS_KEY, []).filter(
      (s) => s.habitId === habitId,
    )
  }

  upsertSession(session: GymSession): void {
    const all = read<GymSession[]>(SESSIONS_KEY, [])
    // One session per (habitId, date) — replace any existing same-day session.
    const idx = all.findIndex(
      (s) => s.habitId === session.habitId && s.date === session.date,
    )
    if (idx >= 0) all[idx] = session
    else all.push(session)
    write(SESSIONS_KEY, all)
  }

  deleteSession(habitId: string, date: string): void {
    const all = read<GymSession[]>(SESSIONS_KEY, [])
    write(
      SESSIONS_KEY,
      all.filter((s) => !(s.habitId === habitId && s.date === date)),
    )
  }

  getSettings(): GymSettings {
    return { ...DEFAULT_SETTINGS, ...read<Partial<GymSettings>>(SETTINGS_KEY, {}) }
  }

  setSettings(settings: GymSettings): void {
    write(SETTINGS_KEY, settings)
  }
}
