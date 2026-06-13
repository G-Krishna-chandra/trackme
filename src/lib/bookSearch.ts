import type { Book } from '../types'

// Two free, keyless, CORS-enabled APIs used at different moments so we never
// fire two calls per keystroke:
//   1. Open Library  — one search call per debounced keystroke (typeahead).
//   2. Google Books   — exactly one enrichment call, only when a result is
//      clicked. Best-effort: it must NEVER block adding a book.
// Debounced, low-volume usage only — we do not crawl. Cover <img> tags point at
// covers.openlibrary.org rather than re-hosting, per Open Library's request.

const OL_SEARCH = 'https://openlibrary.org/search.json'
const OL_COVER = 'https://covers.openlibrary.org/b/id'
const GB_VOLUMES = 'https://www.googleapis.com/books/v1/volumes'

/** A lightweight typeahead result, one row in the dropdown. */
export interface BookSearchResult {
  /** Open Library work id (the OL…W part of `key`). Stable foreign key. */
  workId: string
  title: string
  /** Author names joined for display. */
  author: string
  /** First author only, for the Google Books title/author fallback query. */
  firstAuthor: string
  firstPublishYear: number | null
  /** First ISBN from the doc, used to join to Google Books on select. */
  isbn: string | null
  /** Small cover thumb for the dropdown, or null → render a placeholder. */
  coverThumbUrl: string | null
  /** Open Library cover id, used to build the stored -M cover on select. */
  coverId: number | null
}

interface OLDoc {
  key?: string
  title?: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  isbn?: string[]
}

/** The `OL…W` part of a work key like `/works/OL166894W`. */
function workIdFromKey(key: string): string {
  return key.split('/').pop() ?? key
}

/**
 * Typeahead search against Open Library. One call per debounced keystroke;
 * pass an AbortSignal so the caller can cancel the in-flight request.
 * De-duplicates by work id (search returns multiple editions of one work).
 */
export async function searchBooks(
  query: string,
  signal?: AbortSignal,
): Promise<BookSearchResult[]> {
  const url =
    `${OL_SEARCH}?q=${encodeURIComponent(query)}` +
    `&fields=key,title,author_name,cover_i,first_publish_year,isbn&limit=6`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open Library ${res.status}`)
  const data = (await res.json()) as { docs?: OLDoc[] }

  const seen = new Set<string>()
  const out: BookSearchResult[] = []
  for (const doc of data.docs ?? []) {
    if (!doc.key || !doc.title) continue
    const workId = workIdFromKey(doc.key)
    if (seen.has(workId)) continue
    seen.add(workId)

    const coverId = typeof doc.cover_i === 'number' ? doc.cover_i : null
    const authors = doc.author_name ?? []
    out.push({
      workId,
      title: doc.title,
      author: authors.length > 0 ? authors.join(', ') : 'Unknown author',
      firstAuthor: authors[0] ?? '',
      firstPublishYear:
        typeof doc.first_publish_year === 'number'
          ? doc.first_publish_year
          : null,
      isbn: doc.isbn && doc.isbn.length > 0 ? doc.isbn[0] : null,
      coverThumbUrl: coverId ? `${OL_COVER}/${coverId}-S.jpg` : null,
      coverId,
    })
    if (out.length >= 6) break
  }
  return out
}

interface GBVolumeInfo {
  pageCount?: number
  description?: string
  imageLinks?: { thumbnail?: string }
  publishedDate?: string
  categories?: string[]
}

function forceHttps(url: string): string {
  return url.replace(/^http:\/\//, 'https://')
}

async function fetchFirstVolumeInfo(
  url: string,
  signal?: AbortSignal,
): Promise<GBVolumeInfo | null> {
  const res = await fetch(url, { signal })
  if (!res.ok) return null
  const data = (await res.json()) as { items?: { volumeInfo?: GBVolumeInfo }[] }
  return data.items?.[0]?.volumeInfo ?? null
}

/**
 * Build the denormalized Book snapshot for a selected result. Open Library
 * supplies identity + cover; a single Google Books call backfills pageCount,
 * description, categories, and a cover fallback. Enrichment is best-effort: on
 * any error or empty result the book is still returned with pageCount null, so
 * a book-data outage never stands between the user and adding a book.
 */
export async function buildBookProfile(
  result: BookSearchResult,
  signal?: AbortSignal,
): Promise<Book> {
  const source = ['openlibrary']
  let coverUrl: string | null = result.coverId
    ? `${OL_COVER}/${result.coverId}-M.jpg`
    : null
  let pageCount: number | null = null
  let description: string | null = null
  let publishedDate: string | null = null
  let categories: string[] | null = null

  try {
    let info: GBVolumeInfo | null = null
    if (result.isbn) {
      // Prefer the ISBN join.
      info = await fetchFirstVolumeInfo(
        `${GB_VOLUMES}?q=isbn:${encodeURIComponent(result.isbn)}`,
        signal,
      )
    } else if (result.title && result.firstAuthor) {
      // No ISBN on the doc — fall back to title + author.
      const q = `intitle:${encodeURIComponent(
        result.title,
      )}+inauthor:${encodeURIComponent(result.firstAuthor)}`
      info = await fetchFirstVolumeInfo(`${GB_VOLUMES}?q=${q}`, signal)
    }

    if (info) {
      pageCount = typeof info.pageCount === 'number' ? info.pageCount : null
      description = info.description ?? null
      publishedDate = info.publishedDate ?? null
      categories = info.categories ?? null
      const gbThumb = info.imageLinks?.thumbnail
      if (!coverUrl && gbThumb) coverUrl = forceHttps(gbThumb)
      source.push('googlebooks')
    }
  } catch {
    // Best-effort: keep Open Library data and pageCount null.
  }

  return {
    id: result.workId,
    title: result.title,
    author: result.author,
    coverUrl,
    pageCount,
    isbn: result.isbn,
    firstPublishYear: result.firstPublishYear,
    source,
    description,
    publishedDate,
    categories,
  }
}
