import type { ChessDay, ChessSettings } from '../types'
import type { ChessRepository } from './ChessRepository'

const DAYS_KEY = 'trackme.chessDays'
const SETTINGS_KEY = 'trackme.chessSettings'

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

/** localStorage-backed ChessRepository (a derived cache + settings). */
export class LocalStorageChessRepository implements ChessRepository {
  getSettings(): ChessSettings {
    return read<ChessSettings>(SETTINGS_KEY, {})
  }

  setSettings(settings: ChessSettings): void {
    write(SETTINGS_KEY, settings)
  }

  getDays(): ChessDay[] {
    return read<ChessDay[]>(DAYS_KEY, [])
  }

  setDays(days: ChessDay[]): void {
    write(DAYS_KEY, days)
  }
}
