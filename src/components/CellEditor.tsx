import { useEffect, useRef, useState } from 'react'
import type { Book, Entry } from '../types'
import { formatLong } from '../lib/date'
import { BookAutocomplete } from './BookAutocomplete'

interface CellEditorProps {
  date: string
  unit: string
  /** Existing entry for this date, if any. */
  entry: Entry | undefined
  /** Book to attach by default — the entry's book, or the active book if today. */
  initialBook: Book | undefined
  /** Anchor rect (viewport coords) of the clicked cell. */
  rect: DOMRect
  onSelectBook: (book: Book) => Book
  onSave: (date: string, value: number, note: string, bookId?: string) => void
  onClear: (date: string) => void
  onClose: () => void
}

const CARD_W = 280
const EST_H = 320

export function CellEditor({
  date,
  unit,
  entry,
  initialBook,
  rect,
  onSelectBook,
  onSave,
  onClear,
  onClose,
}: CellEditorProps) {
  const [value, setValue] = useState(
    entry && entry.value > 0 ? String(entry.value) : '',
  )
  const [note, setNote] = useState(entry?.note ?? '')
  const [attachedBook, setAttachedBook] = useState<Book | undefined>(initialBook)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prefer placing the card below the cell; flip above if it would overflow.
  const placeAbove = rect.bottom + 10 + EST_H > window.innerHeight
  const top = placeAbove ? rect.top - 10 : rect.bottom + 10
  const rawLeft = rect.left + rect.width / 2 - CARD_W / 2
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - CARD_W - 8))

  const submit = () => {
    onSave(date, value.trim() === '' ? 0 : Number(value), note, attachedBook?.id)
  }

  const handleSelect = (book: Book) => {
    setAttachedBook(onSelectBook(book))
  }

  return (
    <>
      {/* Click-outside backdrop. */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded-lg border border-[#d0d7de] bg-white p-3 shadow-xl"
        style={{
          top,
          left,
          width: CARD_W,
          transform: placeAbove ? 'translateY(-100%)' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-[13px] font-semibold text-[#1f2328]">
          {formatLong(date)}
        </div>

        <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
          Book <span className="font-normal text-[#8c959f]">(optional)</span>
        </label>
        <BookAutocomplete
          onSelect={handleSelect}
          placeholder={attachedBook ? 'Search to change book…' : 'Search for a book…'}
        />
        {attachedBook ? (
          <div className="mb-2 mt-1.5 flex items-center gap-1 text-[12px] text-[#1f2328]">
            <span className="text-[#656d76]">Attaching to</span>
            <span className="min-w-0 truncate font-medium">{attachedBook.title}</span>
            <button
              type="button"
              onClick={() => setAttachedBook(undefined)}
              aria-label="Detach book"
              className="shrink-0 rounded px-1 text-[#656d76] hover:text-[#cf222e]"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="mb-2" />
        )}

        <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
          {unit.charAt(0).toUpperCase() + unit.slice(1)}
        </label>
        <input
          ref={inputRef}
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="0"
          className="mb-2 w-full rounded-md border border-[#d0d7de] px-2 py-1 text-[13px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
        />

        <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
          Note <span className="font-normal text-[#8c959f]">(optional)</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. book title"
          className="mb-3 w-full rounded-md border border-[#d0d7de] px-2 py-1 text-[13px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
        />

        <div className="flex items-center justify-between gap-2">
          {entry ? (
            <button
              type="button"
              onClick={() => onClear(date)}
              className="rounded-md px-2 py-1 text-[12px] font-medium text-[#cf222e] hover:bg-[#cf222e]/10"
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#d0d7de] px-2.5 py-1 text-[12px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-[#1f883d] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-[#1a7f37]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
