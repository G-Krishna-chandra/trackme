import type { ChessDay, ChessSettings } from '../types'

/**
 * Storage boundary for Chess data, parallel to the other repositories. Chess
 * days are a derived cache recomputed from the Chess.com archives on each sync;
 * settings hold the username + sync metadata. No secrets (username is public).
 */
export interface ChessRepository {
  getSettings(): ChessSettings
  setSettings(settings: ChessSettings): void
  getDays(): ChessDay[]
  /** Replace the cached days (a full recompute) — keeps sync idempotent. */
  setDays(days: ChessDay[]): void
}
