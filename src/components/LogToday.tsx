import { useState } from 'react'
import type { Book, Entry } from '../types'
import { formatLong } from '../lib/date'
import { BookAutocomplete } from './BookAutocomplete'

interface LogTodayProps {
  today: string
  unit: string
  /** Today's existing entry, if any (used to prefill). */
  entry: Entry | undefined
  /** Book to attach by default — the existing entry's book, else the active one. */
  initialBook: Book | undefined
  /** Persist a chosen book and set it as currently reading; returns the book. */
  onSelectBook: (book: Book) => Book
  onSave: (date: string, value: number, note: string, bookId?: string) => void
}

export function LogToday({
  today,
  unit,
  entry,
  initialBook,
  onSelectBook,
  onSave,
}: LogTodayProps) {
  const [value, setValue] = useState(
    entry && entry.value > 0 ? String(entry.value) : '',
  )
  const [note, setNote] = useState(entry?.note ?? '')
  const [attachedBook, setAttachedBook] = useState<Book | undefined>(initialBook)

  const submit = () => {
    onSave(today, value.trim() === '' ? 0 : Number(value), note, attachedBook?.id)
  }

  const handleSelect = (book: Book) => {
    setAttachedBook(onSelectBook(book))
  }

  return (
    <div className="rounded-lg border border-[#d0d7de] bg-white p-4">
      <div className="mb-3 text-[13px] font-semibold text-[#1f2328]">
        Log today{' '}
        <span className="font-normal text-[#656d76]">· {formatLong(today)}</span>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
          Book <span className="font-normal text-[#8c959f]">(optional)</span>
        </label>
        <BookAutocomplete
          onSelect={handleSelect}
          placeholder={attachedBook ? 'Search to change book…' : 'Search for a book…'}
        />
        {attachedBook ? (
          <div className="mt-1.5 flex items-center gap-1 text-[12px] text-[#1f2328]">
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
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:w-32">
          <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
            {unit.charAt(0).toUpperCase() + unit.slice(1)}
          </label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="0"
            className="w-full rounded-md border border-[#d0d7de] px-2 py-1.5 text-[14px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
            Note <span className="font-normal text-[#8c959f]">(optional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. book title"
            className="w-full rounded-md border border-[#d0d7de] px-2 py-1.5 text-[14px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          className="rounded-md bg-[#1f883d] px-4 py-1.5 text-[14px] font-semibold text-white hover:bg-[#1a7f37]"
        >
          Save
        </button>
      </div>
    </div>
  )
}
