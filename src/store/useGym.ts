import { useCallback, useMemo, useState } from 'react'
import type { GymExercise, GymSession, GymSettings, GymType, Habit } from '../types'
import { GYM_HABIT_ID } from '../data/seed'
import { LocalStorageRepository } from '../data/LocalStorageRepository'
import type { EntryRepository } from '../data/EntryRepository'
import { LocalStorageGymRepository } from '../data/LocalStorageGymRepository'
import type { GymRepository } from '../data/GymRepository'
import { rememberedExerciseNames } from '../lib/gym'
import { syncFromHevy, type SyncResult } from '../lib/hevySync'

// Habit metadata lives in the shared habits store; sessions/settings in the gym
// store. Both are stateless localStorage wrappers (same pattern as useHabit).
const entryRepo: EntryRepository = new LocalStorageRepository()
const gymRepo: GymRepository = new LocalStorageGymRepository()

export interface UseGym {
  habit: Habit | undefined
  sessions: GymSession[]
  settings: GymSettings
  /** Exercise names seen before, for the logger autocomplete. */
  rememberedNames: string[]
  /** Create/replace a manual session for a date (id "gym:<date>"). */
  saveSession: (
    date: string,
    type: GymType,
    exercises: GymExercise[],
    note: string,
  ) => void
  /** Edit an existing session in place, preserving its id/hevyId. */
  updateSession: (
    existing: GymSession,
    type: GymType,
    exercises: GymExercise[],
    note: string,
  ) => void
  deleteSessionById: (id: string) => void
  updateSettings: (settings: GymSettings) => void
  /** Bulk upsert file-imported sessions (idempotent — keyed by id). */
  importSessions: (sessions: GymSession[]) => void
  /** Full idempotent pull from the Hevy API via the dev proxy. */
  runHevySync: (
    onProgress: (done: number, total: number) => void,
    signal?: AbortSignal,
  ) => Promise<SyncResult>
}

export function useGym(): UseGym {
  const habit = useMemo(() => entryRepo.getHabit(GYM_HABIT_ID), [])
  const [sessions, setSessions] = useState<GymSession[]>(() =>
    gymRepo.listSessions(GYM_HABIT_ID),
  )
  const [settings, setSettingsState] = useState<GymSettings>(() =>
    gymRepo.getSettings(),
  )

  const refresh = useCallback(() => {
    setSessions(gymRepo.listSessions(GYM_HABIT_ID))
  }, [])

  const saveSession = useCallback(
    (date: string, type: GymType, exercises: GymExercise[], note: string) => {
      const trimmed = note.trim()
      const id = `${GYM_HABIT_ID}:${date}`
      // An emptied session (no exercises, no note) clears the day's manual log.
      if (exercises.length === 0 && !trimmed) {
        gymRepo.deleteSessionById(id)
      } else {
        gymRepo.upsertSession({
          id,
          habitId: GYM_HABIT_ID,
          date,
          type,
          exercises,
          note: trimmed ? trimmed : undefined,
        })
      }
      refresh()
    },
    [refresh],
  )

  const updateSession = useCallback(
    (
      existing: GymSession,
      type: GymType,
      exercises: GymExercise[],
      note: string,
    ) => {
      const trimmed = note.trim()
      if (exercises.length === 0 && !trimmed) {
        gymRepo.deleteSessionById(existing.id)
      } else {
        // Preserve id + hevyId so a synced session stays synced (and its edits
        // survive re-sync via the repository's preserve rule).
        gymRepo.upsertSession({
          ...existing,
          type,
          exercises,
          note: trimmed ? trimmed : undefined,
        })
      }
      refresh()
    },
    [refresh],
  )

  const deleteSessionById = useCallback(
    (id: string) => {
      gymRepo.deleteSessionById(id)
      refresh()
    },
    [refresh],
  )

  const updateSettings = useCallback((next: GymSettings) => {
    gymRepo.setSettings(next)
    setSettingsState(next)
  }, [])

  const importSessions = useCallback(
    (incoming: GymSession[]) => {
      gymRepo.bulkUpsertSessions(incoming)
      refresh()
    },
    [refresh],
  )

  const runHevySync = useCallback(
    async (
      onProgress: (done: number, total: number) => void,
      signal?: AbortSignal,
    ): Promise<SyncResult> => {
      const current = gymRepo.getSettings()
      const result = await syncFromHevy(current.weightUnit, onProgress, signal)
      gymRepo.syncImportedSessions(GYM_HABIT_ID, result.sessions)
      const next: GymSettings = {
        ...current,
        lastSyncedAt: new Date().toISOString(),
      }
      gymRepo.setSettings(next)
      setSettingsState(next)
      refresh()
      return result
    },
    [refresh],
  )

  const rememberedNames = useMemo(
    () => rememberedExerciseNames(sessions),
    [sessions],
  )

  return {
    habit,
    sessions,
    settings,
    rememberedNames,
    saveSession,
    updateSession,
    deleteSessionById,
    updateSettings,
    importSessions,
    runHevySync,
  }
}
