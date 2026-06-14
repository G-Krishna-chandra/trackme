import type { Book } from '../types'
import { BookCover } from './BookCover'

interface BookChipProps {
  book: Book
  /** Small uppercase label above the title, e.g. "Currently reading". */
  label?: string
  /** When provided, renders a ✕ to detach the book. */
  onDetach?: () => void
}

/** Compact book card: cover + title + author, with an optional detach button. */
export function BookChip({ book, label, onDetach }: BookChipProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-[#d0d7de] bg-[#f6f8fa] p-2">
      <BookCover key={book.id} book={book} width={28} height={40} />
      <div className="min-w-0 flex-1">
        {label ? (
          <div className="text-[10px] font-medium uppercase tracking-wide text-[#8c959f]">
            {label}
          </div>
        ) : null}
        <div className="truncate text-[13px] font-medium text-[#1f2328]">
          {book.title}
        </div>
        <div className="truncate text-[11px] text-[#656d76]">
          {book.author}
          {book.firstPublishYear ? ` · ${book.firstPublishYear}` : ''}
        </div>
      </div>
      {onDetach ? (
        <button
          type="button"
          onClick={onDetach}
          aria-label="Detach book"
          className="shrink-0 rounded px-1.5 py-0.5 text-[#656d76] hover:bg-[#eaeef2] hover:text-[#cf222e]"
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}
