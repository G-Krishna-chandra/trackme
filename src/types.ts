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
