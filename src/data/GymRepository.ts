import type { GymSession, GymSettings } from '../types'

/**
 * Storage boundary for Gym data, parallel to EntryRepository / BookRepository
 * (both left untouched). Sessions are per-habit; settings (bodyweight + unit)
 * are a single global record. A future IndexedDB/synced backend can satisfy the
 * same synchronous contract via an in-memory cache.
 */
export interface GymRepository {
  listSessions(habitId: string): GymSession[]

  /** Insert or replace a session by id (one session per calendar day). */
  upsertSession(session: GymSession): void

  /** Upsert many sessions in one write (import), keyed by (habitId, date). */
  bulkUpsertSessions(sessions: GymSession[]): void

  /** Remove the session for (habitId, date) if present. */
  deleteSession(habitId: string, date: string): void

  getSettings(): GymSettings
  setSettings(settings: GymSettings): void
}
