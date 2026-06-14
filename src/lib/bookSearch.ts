import type { Book } from '../types'

// Recall ("will the right book come back at all, even if I typed it wrong") is
// solved at the SOURCE, not with client-side fuzzy re-ranking — a fuzzy library
// can only reorder what was already returned, it cannot improve recall.
//
//   1. PRIMARY → Google Books. One call per debounced keystroke. It's Google's
//      own index, so spell-correction, partial titles, and author+fragment
//      matching work like google.com. The search payload is the COMPLETE
//      profile (pageCount, description, cover, ISBNs…), so a Google-sourced
//      selection needs NO separate enrichment call.
//   2. TYPO INSURANCE → if the primary returns zero items, retry ONCE with a
//      normalized query before falling through. No retry loops.
//   3. RECALL FALLBACK → Open Library, only when Google yields nothing (rare).
//      Preserves breadth for obscure / old / non-English titles.
//
// Keyless at this volume; debounced, low-volume usage only — we do not crawl.

const GB_VOLUMES = 'https://www.googleapis.com/books/v1/volumes'
const OL_SEARCH = 'https://openlibrary.org/search.json'

function olCoverByIsbn(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg`
}

/** Google thumbnails arrive as http:// and with &edge=curl — clean both. */
function sanitizeCover(url: string): string {
  return url
    .replace(/^http:\/\//i, 'https://')
    .replace(/([?&])edge=curl(&|$)/gi, (_m, sep: string, tail: string) =>
      tail === '&' ? sep : '',
    )
}

/** Leading 4-digit year from a publishedDate like "1925" or "1925-04-10". */
function parseYear(date: string | undefined): number | null {
  const m = date?.match(/\d{4}/)
  return m ? Number(m[0]) : null
}

function notNull<T>(x: T | null): x is T {
  return x !== null
}

function dedupeById(books: Book[]): Book[] {
  const seen = new Set<string>()
  const out: Book[] = []
  for (const b of books) {
    if (seen.has(b.id)) continue
    seen.add(b.id)
    out.push(b)
  }
  return out
}

/** Resolve a fetch to parsed JSON, or null on non-ok / network error. Rethrows
 *  AbortError so a superseding keystroke can cancel cleanly. */
async function tryFetchJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T | null> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    return null // treat a network/CORS failure as "no items" so we can fall back
  }
}

// ---- Google Books (primary) ----

interface GBItem {
  id: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    pageCount?: number
    description?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    publishedDate?: string
    categories?: string[]
    industryIdentifiers?: { type?: string; identifier?: string }[]
  }
}

async function googleVolumes(
  query: string,
  signal?: AbortSignal,
): Promise<GBItem[]> {
  if (query.length === 0) return []
  // country=US makes Google return complete volumeInfo (incl. imageLinks) for
  // unauthenticated requests that otherwise come back partial.
  const url = `${GB_VOLUMES}?q=${encodeURIComponent(query)}&maxResults=6&printType=books&country=US`
  const data = await tryFetchJson<{ items?: GBItem[] }>(url, signal)
  return data?.items ?? []
}

function mapGoogleItem(item: GBItem): Book | null {
  const vi = item.volumeInfo
  if (!vi?.title) return null // items may lack a title — skip them

  const ids = vi.industryIdentifiers ?? []
  const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? null
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier ?? null
  const isbn = isbn13 ?? isbn10 ?? null
  // Canonical id de-dupes the same title across sources to one row.
  const id = isbn13 ?? isbn10 ?? `gb:${item.id}`

  const source = ['googlebooks']
  let coverUrl: string | null = null
  const gThumb = vi.imageLinks?.thumbnail ?? vi.imageLinks?.smallThumbnail
  if (gThumb) {
    coverUrl = sanitizeCover(gThumb)
  } else if (isbn) {
    // Google profile, Open Library cover — provenance reflects both.
    coverUrl = olCoverByIsbn(isbn)
    source.push('openlibrary')
  }

  const authors = vi.authors ?? []
  return {
    id,
    title: vi.title,
    author: authors.length > 0 ? authors.join(', ') : 'Unknown author',
    coverUrl,
    pageCount: typeof vi.pageCount === 'number' ? vi.pageCount : null,
    isbn,
    firstPublishYear: parseYear(vi.publishedDate),
    source,
    description: vi.description ?? null,
    publishedDate: vi.publishedDate ?? null,
    categories: vi.categories ?? null,
  }
}

// ---- Open Library (recall fallback) ----

interface OLDoc {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  isbn?: string[]
}

async function openLibraryDocs(
  query: string,
  signal?: AbortSignal,
): Promise<OLDoc[]> {
  const url =
    `${OL_SEARCH}?q=${encodeURIComponent(query)}` +
    `&fields=key,title,author_name,cover_i,first_publish_year,isbn&limit=6`
  const data = await tryFetchJson<{ docs?: OLDoc[] }>(url, signal)
  return data?.docs ?? []
}

function mapOLDoc(doc: OLDoc): Book | null {
  if (!doc.key || !doc.title) return null
  const workId = doc.key.split('/').pop() ?? doc.key

  const isbns = doc.isbn ?? []
  const isbn13 = isbns.find((s) => s.length === 13) ?? null
  const isbn10 = isbns.find((s) => s.length === 10) ?? null
  const isbn = isbn13 ?? isbn10 ?? null
  const id = isbn13 ?? isbn10 ?? `ol:${workId}`

  const authors = doc.author_name ?? []
  const year =
    typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null
  return {
    id,
    title: doc.title,
    author: authors.length > 0 ? authors.join(', ') : 'Unknown author',
    coverUrl: isbn ? olCoverByIsbn(isbn) : null,
    pageCount: null, // Open Library search has no page count
    isbn,
    firstPublishYear: year,
    source: ['openlibrary'],
    description: null,
    publishedDate: year !== null ? String(year) : null,
    categories: null,
  }
}

/** Lowercase, strip punctuation, collapse whitespace — for the typo retry. */
function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Typeahead search. Returns complete Book profiles (no enrichment needed on
 * select). Pass an AbortSignal so each keystroke cancels the previous request.
 */
export async function searchBooks(
  query: string,
  signal?: AbortSignal,
): Promise<Book[]> {
  const q = query.trim()

  // Primary: Google Books.
  let items = await googleVolumes(q, signal)

  // Typo insurance: one retry with a normalized query (no loops).
  if (items.length === 0) {
    const norm = normalizeQuery(q)
    if (norm.length > 0 && norm !== q.toLowerCase()) {
      items = await googleVolumes(norm, signal)
    }
  }

  if (items.length > 0) {
    return dedupeById(items.map(mapGoogleItem).filter(notNull)).slice(0, 6)
  }

  // Recall fallback: Open Library, only when Google returned nothing.
  const docs = await openLibraryDocs(q, signal)
  return dedupeById(docs.map(mapOLDoc).filter(notNull)).slice(0, 6)
}
