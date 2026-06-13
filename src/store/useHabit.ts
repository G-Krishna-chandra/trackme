import { useCallback, useMemo, useState } from 'react'
import type { Book, Entry, Habit } from '../types'
import type { EntryRepository } from '../data/EntryRepository'
import { LocalStorageRepository } from '../data/LocalStorageRepository'
import type { BookRepository } from '../data/BookRepository'
import { LocalStorageBookRepository } from '../data/LocalStorageBookRepository'

// Single repository instances for the app. Swap these lines to change backends.
const repo: EntryRepository = new LocalStorageRepository()
const bookRepo: BookRepository = new LocalStorageBookRepository()

export interface UseHabit {
  habit: Habit | undefined
  entries: Entry[]
  /** All known books, keyed by id, for resolving entry.bookId at render time. */
  booksById: Map<string, Book>
  /** The "currently reading" book for this habit, if set. */
  activeBook: Book | undefined
  /** Set/replace one day's value, note, and optional attached book. */
  setEntry: (date: string, value: number, note?: string, bookId?: string) => void
  /** Remove a day's entry entirely. */
  clearEntry: (date: string) => void
  /**
   * Persist a chosen search result (already a complete profile — no enrichment
   * round-trip), upsert by its canonical id, set it as currently reading, and
   * return it.
   */
  selectBook: (book: Book) => Book
}

export function useHabit(habitId: string): UseHabit {
  const habit = useMemo(() => repo.getHabit(habitId), [habitId])
  const [entries, setEntries] = useState<Entry[]>(() =>
    repo.listEntries(habitId),
  )
  const [books, setBooks] = useState<Book[]>(() => bookRepo.listBooks())
  const [activeBookId, setActiveBookIdState] = useState<string | undefined>(() =>
    bookRepo.getActiveBookId(habitId),
  )

  const booksById = useMemo(() => {
    const m = new Map<string, Book>()
    for (const b of books) m.set(b.id, b)
    return m
  }, [books])

  const activeBook = activeBookId ? booksById.get(activeBookId) : undefined

  const refresh = useCallback(() => {
    setEntries(repo.listEntries(habitId))
  }, [habitId])

  const setEntry = useCallback(
    (date: string, value: number, note?: string, bookId?: string) => {
      const v = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
      const trimmed = note?.trim()
      repo.upsertEntry({
        habitId,
        date,
        value: v,
        note: trimmed ? trimmed : undefined,
        bookId: bookId || undefined,
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

  const selectBook = useCallback(
    (book: Book): Book => {
      bookRepo.upsertBook(book)
      bookRepo.setActiveBookId(habitId, book.id)
      setBooks(bookRepo.listBooks())
      setActiveBookIdState(book.id)
      return book
    },
    [habitId],
  )

  return {
    habit,
    entries,
    booksById,
    activeBook,
    setEntry,
    clearEntry,
    selectBook,
  }
}
