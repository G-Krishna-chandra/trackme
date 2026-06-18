// Color intensity for a day-cell. 0 = empty/faint, 1-4 = increasing saturation.
export type Level = 0 | 1 | 2 | 3 | 4

export interface Habit {
  id: string
  name: string
  /** Unit the value is measured in, e.g. "pages". */
  unit: string
  /** Color key driving the cell ramp, e.g. "green". See lib/colors.ts. */
  color: string
}

export interface Entry {
  habitId: string
  /** ISO yyyy-mm-dd, interpreted in the user's local timezone. */
  date: string
  /** Integer amount done that day, e.g. pages read. */
  value: number
  /** Optional freeform note, e.g. the book title. Kept as the fallback when no
   *  book is attached and for annotations alongside one. */
  note?: string
  /** Optional foreign key into the books store (Open Library work id). Pure
   *  metadata — it rides alongside the entry and never affects cell levels.
   *  Old entries predate this and have it undefined; that keeps working. */
  bookId?: string
}

// ---- Gym (second habit) ----------------------------------------------------
// Gym is the additive second-habit case: its own coloring rule (per training
// type) and its own per-set logger. Reading is untouched.

export type GymType = 'push' | 'pull' | 'legs' | 'arms' | 'other'

export interface GymSet {
  reps: number
  /** Added/external weight in the user's weight unit (0 is allowed). */
  weight: number
  /** Warmup sets are recorded but excluded from working volume. */
  warmup: boolean
}

export interface GymExercise {
  name: string
  /** Bodyweight moves (pullups, dips) add the user's bodyweight to each set. */
  isBodyweight: boolean
  sets: GymSet[]
  /** Hevy exercise template id, captured on import for a future muscle heat map. */
  exerciseTemplateId?: string
}

/** A training session. Stored by stable `id`; multiple may share a date (e.g. a
 *  manual session plus a synced one) — the grid aggregates per day. */
export interface GymSession {
  /** Stable id: "gym:<date>" for manual, "hevy:<hevyId>" for synced. */
  id: string
  habitId: string // "gym"
  /** ISO yyyy-mm-dd, local. */
  date: string
  type: GymType
  exercises: GymExercise[]
  note?: string
  /** Hevy workout id — present only on synced sessions; the de-dupe key. */
  hevyId?: string
}

export interface GymSettings {
  /** Single editable bodyweight, used for bodyweight-exercise volume. */
  bodyweight: number
  weightUnit: 'kg' | 'lbs'
  /** ISO timestamp of the last successful Hevy sync, if any. */
  lastSyncedAt?: string
}

// ---- Chess (Chess.com sync) ------------------------------------------------
// Grid is colored by GAMES PLAYED per day (activity); the Elo "climb" is a
// separate rating-over-time line (an outcome, not an activity).

export type ChessTimeClass = 'rapid' | 'blitz' | 'bullet' | 'daily'

/** Per-day chess activity, derived/cached from the Chess.com archives. */
export interface ChessDay {
  /** ISO yyyy-mm-dd, local. */
  date: string
  /** Rated standard games played that day (drives the grid color). */
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  /** Last rating that day per time class (rating after that class's last game). */
  ratingByClass: Partial<Record<ChessTimeClass, number>>
  /** Rating after the day's final game (any class) — for the grid tooltip. */
  lastRating?: number
}

export interface ChessSettings {
  /** Chess.com username (public, not a secret). */
  username?: string
  lastSyncedAt?: string
  /** Most-played class over the synced window — the rating line's default. */
  primaryClass?: ChessTimeClass
  /** Current rating per class from /pub/player/{u}/stats. */
  currentRatings?: Partial<Record<ChessTimeClass, number>>
}

/**
 * A denormalized snapshot of a book, captured at selection time so it renders
 * offline forever without re-fetching. Merged from Open Library (identity,
 * cover) and a single Google Books enrichment call (page count, description,
 * cover fallback). Stored in its own `books` store and referenced by entries.
 */
export interface Book {
  /** Canonical id so the same title de-dupes across sources to one row:
   *  isbn13 || isbn10 || "gb:"+googleVolumeId || "ol:"+olWorkId. Upserted by id. */
  id: string
  title: string
  /** First author, or comma-joined author names. */
  author: string
  /** Resolved cover URL: Google thumbnail (https, de-curled), else Open Library
   *  by ISBN, else null (placeholder). */
  coverUrl: string | null
  /** Page count (from the Google Books profile), or null when unknown. */
  pageCount: number | null
  /** Chosen ISBN (isbn13 preferred), used for the canonical id and cover. */
  isbn: string | null
  firstPublishYear: number | null
  /** Provenance, e.g. ["openlibrary", "googlebooks"]. */
  source: string[]
  // Captured now for the deferred per-book / bookshelf UI (see README roadmap).
  description: string | null
  publishedDate: string | null
  categories: string[] | null
}
