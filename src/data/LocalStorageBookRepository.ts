import type { Book } from '../types'
import type { BookRepository } from './BookRepository'

const BOOKS_KEY = 'trackme.books'
const ACTIVE_KEY = 'trackme.activeBook' // map of habitId -> bookId

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

/** localStorage-backed BookRepository. Stores denormalized book snapshots. */
export class LocalStorageBookRepository implements BookRepository {
  listBooks(): Book[] {
    return read<Book[]>(BOOKS_KEY, [])
  }

  getBook(id: string): Book | undefined {
    return this.listBooks().find((b) => b.id === id)
  }

  upsertBook(book: Book): void {
    const all = read<Book[]>(BOOKS_KEY, [])
    const idx = all.findIndex((b) => b.id === book.id)
    if (idx >= 0) all[idx] = book
    else all.push(book)
    write(BOOKS_KEY, all)
  }

  getActiveBookId(habitId: string): string | undefined {
    return read<Record<string, string>>(ACTIVE_KEY, {})[habitId]
  }

  setActiveBookId(habitId: string, bookId: string | undefined): void {
    const map = read<Record<string, string>>(ACTIVE_KEY, {})
    if (bookId) map[habitId] = bookId
    else delete map[habitId]
    write(ACTIVE_KEY, map)
  }
}
