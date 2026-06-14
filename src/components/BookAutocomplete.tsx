import { useEffect, useRef, useState } from 'react'
import type { Book } from '../types'
import { searchBooks } from '../lib/bookSearch'
import { BookCover } from './BookCover'

interface BookAutocompleteProps {
  /** Called with the chosen book (already a complete profile) to attach it. */
  onSelect: (book: Book) => void
  placeholder?: string
}

const DEBOUNCE_MS = 280
const MIN_CHARS = 3

/**
 * Typeahead over Google Books (with Open Library recall fallback handled in
 * searchBooks). One search call per debounced keystroke, with the in-flight
 * request aborted on each new keystroke. The note field stays available as a
 * fallback, so a search outage never blocks logging.
 */
export function BookAutocomplete({ onSelect, placeholder }: BookAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Book[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounced search; aborts the previous request on each keystroke.
  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_CHARS) {
      abortRef.current?.abort()
      setResults([])
      setOpen(false)
      setLoading(false)
      setError(false)
      return
    }
    setLoading(true)
    setError(false)
    setOpen(true)
    const handle = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const r = await searchBooks(q, ctrl.signal)
        setResults(r)
        setLoading(false)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return // superseded — ignore
        setResults([])
        setError(true)
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Abort any in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), [])

  const handleRow = (book: Book) => {
    onSelect(book)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const showEmpty =
    !loading && !error && results.length === 0 && query.trim().length >= MIN_CHARS

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (results.length > 0 || error || showEmpty) setOpen(true)
        }}
        placeholder={placeholder ?? 'Search for a book…'}
        className="w-full rounded-md border border-[#d0d7de] px-2 py-1.5 text-[14px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
      />

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-[#d0d7de] bg-white py-1 shadow-xl">
          {loading ? (
            <div className="px-3 py-2 text-[12px] text-[#8c959f]">Searching…</div>
          ) : null}

          {error ? (
            <div className="px-3 py-2 text-[12px] text-[#8c959f]">
              Search unavailable — type a note below instead.
            </div>
          ) : null}

          {showEmpty ? (
            <div className="px-3 py-2 text-[12px] text-[#8c959f]">
              No matches — type a note below instead.
            </div>
          ) : null}

          {results.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => handleRow(book)}
              className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-[#f3f4f6]"
            >
              <BookCover book={book} width={28} height={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-[#1f2328]">
                  {book.title}
                </div>
                <div className="truncate text-[11px] text-[#656d76]">
                  {book.author}
                  {book.firstPublishYear ? ` · ${book.firstPublishYear}` : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
