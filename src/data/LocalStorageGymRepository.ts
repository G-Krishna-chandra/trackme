import type { GymExercise, GymSession, GymSettings } from '../types'
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

/** Preserve the user-editable guessed fields (type + per-exercise bodyweight)
 *  from a prior synced session onto a freshly-pulled one. */
function mergePreservingEdits(prev: GymSession, fresh: GymSession): GymSession {
  const bwByName = new Map(
    prev.exercises.map((e) => [e.name.toLowerCase(), e.isBodyweight]),
  )
  const exercises: GymExercise[] = fresh.exercises.map((e) => ({
    ...e,
    isBodyweight: bwByName.get(e.name.toLowerCase()) ?? e.isBodyweight,
  }))
  return { ...fresh, type: prev.type, exercises }
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
    const idx = all.findIndex((s) => s.id === session.id)
    if (idx >= 0) all[idx] = session
    else all.push(session)
    write(SESSIONS_KEY, all)
  }

  deleteSessionById(id: string): void {
    const all = read<GymSession[]>(SESSIONS_KEY, [])
    write(
      SESSIONS_KEY,
      all.filter((s) => s.id !== id),
    )
  }

  syncImportedSessions(habitId: string, incoming: GymSession[]): void {
    const all = read<GymSession[]>(SESSIONS_KEY, [])
    // Keep everything that isn't a synced session of this habit (manual logs,
    // file imports, and other habits) — never touched.
    const untouched = all.filter((s) => !(s.habitId === habitId && s.hevyId))
    const prevByHevyId = new Map(
      all
        .filter((s) => s.habitId === habitId && s.hevyId)
        .map((s) => [s.hevyId as string, s]),
    )
    const merged = incoming.map((fresh) => {
      const prev = fresh.hevyId ? prevByHevyId.get(fresh.hevyId) : undefined
      return prev ? mergePreservingEdits(prev, fresh) : fresh
    })
    write(SESSIONS_KEY, [...untouched, ...merged])
  }

  getSettings(): GymSettings {
    return { ...DEFAULT_SETTINGS, ...read<Partial<GymSettings>>(SETTINGS_KEY, {}) }
  }

  setSettings(settings: GymSettings): void {
    write(SETTINGS_KEY, settings)
  }
}
