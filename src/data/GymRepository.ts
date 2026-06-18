import type { GymSession, GymSettings } from '../types'

/**
 * Storage boundary for Gym data, parallel to EntryRepository / BookRepository
 * (both left untouched). Sessions are stored by stable `id`; multiple sessions
 * may share a date (e.g. a manual one plus a synced one) and the grid aggregates
 * per day. The "currently reading"-style settings hold bodyweight + unit.
 */
export interface GymRepository {
  listSessions(habitId: string): GymSession[]

  /** Insert or replace a session by its `id`. */
  upsertSession(session: GymSession): void

  /** Remove a session by its `id`. */
  deleteSessionById(id: string): void

  /**
   * Idempotent Hevy sync: replace ALL previously-synced sessions (those with a
   * hevyId) with `incoming`, while NEVER touching manual sessions (no hevyId).
   * For a hevyId that already existed, the user-editable guessed fields (type
   * and per-exercise isBodyweight) are preserved; sets/notes refresh from Hevy.
   * Sessions whose hevyId is no longer returned are dropped (handles deletions).
   */
  syncImportedSessions(habitId: string, incoming: GymSession[]): void

  getSettings(): GymSettings
  setSettings(settings: GymSettings): void
}
