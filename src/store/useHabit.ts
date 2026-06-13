import { useCallback, useMemo, useState } from 'react'
import type { Entry, Habit } from '../types'
import type { EntryRepository } from '../data/EntryRepository'
import { LocalStorageRepository } from '../data/LocalStorageRepository'

// Single repository instance for the app. Swap this line to change the backend.
const repo: EntryRepository = new LocalStorageRepository()

export interface UseHabit {
  habit: Habit | undefined
  entries: Entry[]
  /** Set/replace one day's value + note. */
  setEntry: (date: string, value: number, note?: string) => void
  /** Remove a day's entry entirely. */
  clearEntry: (date: string) => void
}

export function useHabit(habitId: string): UseHabit {
  const habit = useMemo(() => repo.getHabit(habitId), [habitId])
  const [entries, setEntries] = useState<Entry[]>(() =>
    repo.listEntries(habitId),
  )

  const refresh = useCallback(() => {
    setEntries(repo.listEntries(habitId))
  }, [habitId])

  const setEntry = useCallback(
    (date: string, value: number, note?: string) => {
      const v = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
      const trimmed = note?.trim()
      repo.upsertEntry({
        habitId,
        date,
        value: v,
        note: trimmed ? trimmed : undefined,
      })
      refresh()
    },
    [habitId, refresh],
  )

  const clearEntry = useCallback(
    (date: string) => {
      repo.deleteEntry(habitId, date)
      refresh()
    },
    [habitId, refresh],
  )

  return { habit, entries, setEntry, clearEntry }
}
