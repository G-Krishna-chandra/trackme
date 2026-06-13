import type { Entry, Habit } from '../types'

/**
 * The storage boundary. v1 is backed by localStorage (see
 * LocalStorageRepository), but the app only ever talks to this interface, so the
 * backend can later be swapped for IndexedDB or a synced store without touching
 * UI or logic. Methods are synchronous because localStorage is; a future async
 * backend can satisfy the same contract by hydrating an in-memory cache.
 *
 * The interface is multi-habit by design even though v1 ships one habit, so
 * adding habits later needs no schema change.
 */
export interface EntryRepository {
  getHabits(): Habit[]
  getHabit(id: string): Habit | undefined

  /** All entries for one habit (unordered). */
  listEntries(habitId: string): Entry[]

  /** Insert or replace the single entry for (habitId, date). */
  upsertEntry(entry: Entry): void

  /** Remove the entry for (habitId, date) if present. */
  deleteEntry(habitId: string, date: string): void
}
