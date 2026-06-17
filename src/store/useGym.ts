import { useCallback, useMemo, useState } from 'react'
import type { GymExercise, GymSession, GymSettings, GymType, Habit } from '../types'
import { GYM_HABIT_ID } from '../data/seed'
import { LocalStorageRepository } from '../data/LocalStorageRepository'
import type { EntryRepository } from '../data/EntryRepository'
import { LocalStorageGymRepository } from '../data/LocalStorageGymRepository'
import type { GymRepository } from '../data/GymRepository'
import { rememberedExerciseNames } from '../lib/gym'

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
  /** Upsert (or, when emptied, delete) the session for a date. */
  saveSession: (
    date: string,
    type: GymType,
    exercises: GymExercise[],
    note: string,
  ) => void
  deleteSession: (date: string) => void
  updateSettings: (settings: GymSettings) => void
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
      // An emptied session (no exercises, no note) clears the day.
      if (exercises.length === 0 && !trimmed) {
        gymRepo.deleteSession(GYM_HABIT_ID, date)
      } else {
        gymRepo.upsertSession({
          id: `${GYM_HABIT_ID}:${date}`,
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

  const deleteSession = useCallback(
    (date: string) => {
      gymRepo.deleteSession(GYM_HABIT_ID, date)
      refresh()
    },
    [refresh],
  )

  const updateSettings = useCallback((next: GymSettings) => {
    gymRepo.setSettings(next)
    setSettingsState(next)
  }, [])

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
    deleteSession,
    updateSettings,
  }
}
