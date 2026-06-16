import { useEffect, useState } from 'react'
import type { Book } from '../types'
import { cachedCover, resolveCover, upgradeGoogleCover } from '../lib/cover'

interface BookCoverProps {
  book: Book
  width: number
  height: number
}

/** The cover to paint immediately: a previously-resolved cache hit, else the
 *  upgraded Google thumbnail from the search payload, else null (placeholder). */
function instantCover(book: Book): string | null {
  const cached = cachedCover(book.id)
  if (cached !== undefined) return cached
  return book.coverUrl ? upgradeGoogleCover(book.coverUrl) : null
}

/**
 * A book cover that paints instantly — the Google thumbnail (or a cached
 * resolution) shows with no blank gap — then upgrades to the canonical, high-res
 * cover in the background and swaps it in flicker-free (the resolver has already
 * probe-loaded it). A cache hit skips the resolve chain entirely. A ≤1px or
 * broken image falls back to the placeholder. Resolution is the resolver's job;
 * stored book records get the resolved cover written back there.
 */
export function BookCover({ book, width, height }: BookCoverProps) {
  const [src, setSrc] = useState<string | null>(() => instantCover(book))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)

    // Already resolved (incl. a known no-cover null) → paint it, skip the chain.
    const cached = cachedCover(book.id)
    if (cached !== undefined) {
      setSrc(cached)
      return
    }

    // Cold path: paint the instant thumbnail now, upgrade in the background.
    setSrc(book.coverUrl ? upgradeGoogleCover(book.coverUrl) : null)

    let cancelled = false
    const ctrl = new AbortController()
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
        if (cancelled || !resolved) return // nothing better — keep the thumbnail
        // The resolver already verified + warmed this URL, so the swap is
        // flicker-free. Reset `failed` in case the thumbnail had errored.
        setFailed(false)
        setSrc((cur) => (resolved === cur ? cur : resolved))
      })
      .catch(() => {
        /* aborted or failed — keep whatever is painted */
      })

    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [book.id, book.title, book.author, book.isbn, book.coverUrl])

  const style = { width, height } as const

  if (!src || failed) {
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
      src={src}
      alt={`Cover of ${book.title}`}
      width={width}
      height={height}
      loading="lazy"
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth <= 1) setFailed(true)
      }}
      onError={() => setFailed(true)}
      style={style}
      className="shrink-0 rounded-sm object-cover"
    />
  )
}
