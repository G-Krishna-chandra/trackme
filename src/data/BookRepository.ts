import type { Book } from '../types'

/**
 * Storage boundary for book metadata, parallel to EntryRepository (which is
 * left untouched). Books are global snapshots referenced by entries via
 * `bookId`; the "currently reading" pointer is per-habit. A future IndexedDB or
 * synced backend can satisfy the same synchronous contract via an in-memory
 * cache, exactly as EntryRepository does.
 */
export interface BookRepository {
  listBooks(): Book[]
  getBook(id: string): Book | undefined

  /** Insert or replace by id — never creates duplicate book rows. */
  upsertBook(book: Book): void

  /** The "currently reading" book id for a habit, if any. */
  getActiveBookId(habitId: string): string | undefined

  /** Set (or clear, with undefined) the currently-reading pointer. */
  setActiveBookId(habitId: string, bookId: string | undefined): void
}
