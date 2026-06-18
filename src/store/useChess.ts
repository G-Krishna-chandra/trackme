import { useCallback, useMemo, useState } from 'react'
import type { ChessDay, ChessSettings, Habit } from '../types'
import { LocalStorageRepository } from '../data/LocalStorageRepository'
import { LocalStorageChessRepository } from '../data/LocalStorageChessRepository'
import type { ChessRepository } from '../data/ChessRepository'
import { syncChess, type ChessSyncResult } from '../lib/chess'

const entryRepo = new LocalStorageRepository()
const repo: ChessRepository = new LocalStorageChessRepository()
const CHESS_HABIT_ID = 'chess'

export interface UseChess {
  habit: Habit | undefined
  days: ChessDay[]
  settings: ChessSettings
  setUsername: (username: string) => void
  /** Full idempotent recompute from the Chess.com archives. */
  runSync: (
    onProgress: (done: number, total: number) => void,
    signal?: AbortSignal,
  ) => Promise<ChessSyncResult>
}

export function useChess(): UseChess {
  const habit = useMemo(() => entryRepo.getHabit(CHESS_HABIT_ID), [])
  const [days, setDaysState] = useState<ChessDay[]>(() => repo.getDays())
  const [settings, setSettingsState] = useState<ChessSettings>(() =>
    repo.getSettings(),
  )

  const setUsername = useCallback((username: string) => {
    const next: ChessSettings = { ...repo.getSettings(), username: username.trim() }
    repo.setSettings(next)
    setSettingsState(next)
  }, [])

  const runSync = useCallback(
    async (
      onProgress: (done: number, total: number) => void,
      signal?: AbortSignal,
    ): Promise<ChessSyncResult> => {
      const current = repo.getSettings()
      const username = current.username?.trim()
      if (!username) throw new Error('Enter your Chess.com username first.')
      const result = await syncChess(username, onProgress, signal)
      repo.setDays(result.days)
      const next: ChessSettings = {
        ...current,
        lastSyncedAt: new Date().toISOString(),
        primaryClass: result.primaryClass,
        currentRatings: result.currentRatings,
      }
      repo.setSettings(next)
      setDaysState(result.days)
      setSettingsState(next)
      return result
    },
    [],
  )

  return { habit, days, settings, setUsername, runSync }
}
