import { useEffect, useState } from 'react'

interface BookCoverProps {
  url: string | null
  /** For the alt text / accessibility. */
  title: string
  width: number
  height: number
}

/**
 * A book cover image that degrades to a neutral placeholder when there is no
 * URL or the image fails to load — never a broken image. Covers are served
 * straight from covers.openlibrary.org (or the Google Books thumbnail).
 */
export function BookCover({ url, title, width, height }: BookCoverProps) {
  const [failed, setFailed] = useState(false)

  // Reset when the URL changes (component may be reused for a different book).
  useEffect(() => setFailed(false), [url])

  const style = { width, height } as const

  if (!url || failed) {
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
      alt={`Cover of ${title}`}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailed(true)}
      style={style}
      className="shrink-0 rounded-sm object-cover"
    />
  )
}
