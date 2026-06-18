import type { ChessDay, ChessTimeClass, Entry } from '../types'
import { toISO } from './date'

// Chess.com Published-Data API — public, no key/auth/Pro, and CORS-open
// (access-control-allow-origin: *), so we fetch it directly from the browser.
// Idempotent: each sync recomputes per-day activity from the monthly archives.

const PUB = 'https://api.chess.com/pub'
const MAX_MONTHS = 14 // enough for the 53-week grid + 6-week windows
const CLASSES: ChessTimeClass[] = ['rapid', 'blitz', 'bullet', 'daily']
// Result strings Chess.com uses for a non-win, non-loss (a draw).
const DRAW_RESULTS = new Set([
  'agreed', 'repetition', 'stalemate', 'insufficient', 'timevsinsufficient', '50move',
])

/** Thrown when the username doesn't exist (404), so the UI can guide setup. */
export class ChessNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChessNotFoundError'
  }
}

interface RawSide {
  username?: string
  result?: string
  rating?: number
}
interface RawGame {
  end_time?: number
  time_class?: string
  rated?: boolean
  rules?: string
  white?: RawSide
  black?: RawSide
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (res.status === 404) throw new ChessNotFoundError('Chess.com user not found')
  if (!res.ok) throw new Error(`Chess.com request failed (${res.status})`)
  return res.json()
}

export async function fetchArchives(
  username: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const data = (await getJson(
    `${PUB}/player/${encodeURIComponent(username.toLowerCase())}/games/archives`,
    signal,
  )) as { archives?: string[] }
  return data.archives ?? []
}

async function fetchCurrentRatings(
  username: string,
  signal?: AbortSignal,
): Promise<Partial<Record<ChessTimeClass, number>>> {
  try {
    const data = (await getJson(
      `${PUB}/player/${encodeURIComponent(username.toLowerCase())}/stats`,
      signal,
    )) as Record<string, { last?: { rating?: number } }>
    const out: Partial<Record<ChessTimeClass, number>> = {}
    for (const c of CLASSES) {
      const r = data[`chess_${c}`]?.last?.rating
      if (typeof r === 'number') out[c] = r
    }
    return out
  } catch {
    return {} // stats are best-effort; never block a sync
  }
}

function outcomeOf(result: string | undefined): 'win' | 'draw' | 'loss' {
  if (result === 'win') return 'win'
  if (result && DRAW_RESULTS.has(result)) return 'draw'
  return 'loss'
}

export interface ChessSyncResult {
  days: ChessDay[]
  primaryClass?: ChessTimeClass
  currentRatings: Partial<Record<ChessTimeClass, number>>
  totalGames: number
  /** First raw game seen — shown if the shape can't be mapped. */
  sampleGame: unknown
}

/**
 * Pull the most recent ~14 months of archives and derive per-day activity.
 * Reports progress as (archivesDone, archivesTotal).
 */
export async function syncChess(
  username: string,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ChessSyncResult> {
  const archives = await fetchArchives(username, signal)
  const recent = archives.slice(-MAX_MONTHS)
  const uname = username.toLowerCase()
  onProgress(0, recent.length)

  interface Flat {
    date: string
    timeClass: ChessTimeClass
    outcome: 'win' | 'draw' | 'loss'
    rating: number | undefined
    endTime: number
  }
  const flat: Flat[] = []
  const classCounts: Partial<Record<ChessTimeClass, number>> = {}
  let sampleGame: unknown

  for (let i = 0; i < recent.length; i++) {
    const archive = (await getJson(recent[i], signal)) as { games?: RawGame[] }
    for (const g of archive.games ?? []) {
      if (sampleGame === undefined) sampleGame = g
      if (!g.rated || g.rules !== 'chess' || typeof g.end_time !== 'number') continue
      const tc = g.time_class as ChessTimeClass
      if (!CLASSES.includes(tc)) continue
      const side =
        g.white?.username?.toLowerCase() === uname
          ? g.white
          : g.black?.username?.toLowerCase() === uname
            ? g.black
            : undefined
      if (!side) continue
      flat.push({
        date: toISO(new Date(g.end_time * 1000)),
        timeClass: tc,
        outcome: outcomeOf(side.result),
        rating: typeof side.rating === 'number' ? side.rating : undefined,
        endTime: g.end_time,
      })
      classCounts[tc] = (classCounts[tc] ?? 0) + 1
    }
    onProgress(i + 1, recent.length)
  }

  // Sort by time so "last rating per day/class" is the latest game's rating.
  flat.sort((a, b) => a.endTime - b.endTime)
  const byDate = new Map<string, ChessDay>()
  for (const f of flat) {
    let day = byDate.get(f.date)
    if (!day) {
      day = { date: f.date, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, ratingByClass: {} }
      byDate.set(f.date, day)
    }
    day.gamesPlayed++
    if (f.outcome === 'win') day.wins++
    else if (f.outcome === 'draw') day.draws++
    else day.losses++
    if (f.rating !== undefined) {
      day.ratingByClass[f.timeClass] = f.rating
      day.lastRating = f.rating
    }
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))

  let primaryClass: ChessTimeClass | undefined
  let maxCount = 0
  for (const c of CLASSES) {
    const n = classCounts[c] ?? 0
    if (n > maxCount) {
      maxCount = n
      primaryClass = c
    }
  }

  const currentRatings = await fetchCurrentRatings(username, signal)
  return { days, primaryClass, currentRatings, totalGames: flat.length, sampleGame }
}

/** Build an Entry-shaped map (value = gamesPlayed) so the shared coloring
 *  engine (computeLevel) can color the chess grid by activity, unchanged. */
export function gamesEntriesByDate(days: ChessDay[]): Map<string, Entry> {
  const m = new Map<string, Entry>()
  for (const d of days) {
    m.set(d.date, { habitId: 'chess', date: d.date, value: d.gamesPlayed })
  }
  return m
}

/** Daily rating points for one class, oldest→newest, for the rating line. */
export function ratingSeries(
  days: ChessDay[],
  timeClass: ChessTimeClass,
): { date: string; rating: number }[] {
  const out: { date: string; rating: number }[] = []
  for (const d of days) {
    const r = d.ratingByClass[timeClass]
    if (typeof r === 'number') out.push({ date: d.date, rating: r })
  }
  return out
}

/** Classes that actually have rating data, in canonical order. */
export function availableClasses(days: ChessDay[]): ChessTimeClass[] {
  return CLASSES.filter((c) => days.some((d) => d.ratingByClass[c] !== undefined))
}
