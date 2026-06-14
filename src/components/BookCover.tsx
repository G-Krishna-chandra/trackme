import { useEffect, useState } from 'react'
import type { Book } from '../types'
import { cachedCover, resolveCover } from '../lib/cover'

interface BookCoverProps {
  book: Book
  width: number
  height: number
}

/**
 * A book cover that shows a neutral placeholder immediately, then resolves a
 * real cover lazily (via the shared, cached resolver) and swaps it in. Works
 * even when the stored coverUrl is null (the currently-reading case). If the
 * resolved image fails at render time it falls back to the placeholder and
 * stops — no retry loop. Cover resolution is runtime-only; stored book records
 * are never mutated.
 */
export function BookCover({ book, width, height }: BookCoverProps) {
  const [url, setUrl] = useState<string | null>(() => cachedCover(book.id) ?? null)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    setImgFailed(false)

    // Already resolved (including a known no-cover null) — use it, skip work.
    const known = cachedCover(book.id)
    if (known !== undefined) {
      setUrl(known)
      return
    }

    let cancelled = false
    const ctrl = new AbortController()
    setUrl(null) // placeholder while resolving a fresh book
    resolveCover(
      {
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        coverUrl: book.coverUrl,
      },
      ctrl.signal,
    )
      .then((resolved) => {
        if (!cancelled) setUrl(resolved)
      })
      .catch(() => {
        /* aborted or failed — placeholder stays */
      })

    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [book.id, book.title, book.author, book.isbn, book.coverUrl])

  const style = { width, height } as const

  if (!url || imgFailed) {
    return (
      <div
        aria-hidden
        style={style}
        className="flex shrink-0 items-center justify-center rounded-sm bg-[#eaeef2] text-[#8c959f]"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1H13a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3.5A1.5 1.5 0 0 1 2 12.5v-10ZM3.5 2a.5.5 0 0 0-.5.5V12h10V2H3.5Z" />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={`Cover of ${book.title}`}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setImgFailed(true)}
      style={style}
      className="shrink-0 rounded-sm object-cover"
    />
  )
}
