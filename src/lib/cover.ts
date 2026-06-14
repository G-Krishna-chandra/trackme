// Runtime-only cover resolution. We resolve covers in the render path rather
// than trusting a book's stored coverUrl, because that URL comes from whatever
// edition Google ranked first — often a no-name reprint, not the WORK's
// recognizable primary-edition cover. The chain below prefers the canonical,
// highest-res cover and falls back through progressively-less-ideal sources,
// stopping at the first image that actually loads.
//
// Results are cached per book id (negative results too) and in-flight lookups
// are de-duped, so the same id never fires the OL canonical lookup twice. This
// NEVER mutates stored book records.

export interface CoverInput {
  id: string
  title: string
  author: string
  isbn: string | null
  coverUrl: string | null
}

const OL_SEARCH = 'https://openlibrary.org/search.json'
const OL_COVER_OLID = 'https://covers.openlibrary.org/b/olid'
const OL_COVER_ID = 'https://covers.openlibrary.org/b/id'
const OL_COVER_ISBN = 'https://covers.openlibrary.org/b/isbn'
const LONGITOOD = 'https://bookcover.longitood.com/bookcover'

const cache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

// Cap concurrent cover resolutions so a 6-row dropdown doesn't fan out into a
// burst of Open Library requests. The cache + in-flight dedupe (below) already
// stop the SAME book id from re-fetching across keystrokes; this bounds the
// number of DISTINCT ids resolving at once.
const MAX_CONCURRENT = 3
let activeResolutions = 0
const slotWaiters: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeResolutions < MAX_CONCURRENT) {
    activeResolutions++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => slotWaiters.push(resolve))
}

function releaseSlot(): void {
  activeResolutions--
  if (slotWaiters.length > 0 && activeResolutions < MAX_CONCURRENT) {
    activeResolutions++
    slotWaiters.shift()!()
  }
}

async function withCoverSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    return await fn()
  } finally {
    releaseSlot()
  }
}

/** Previously resolved cover for an id (undefined = not resolved yet). */
export function cachedCover(id: string): string | null | undefined {
  return cache.get(id)
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

/** First name in a comma-joined author string. */
function firstAuthorOf(author: string): string {
  return author.split(',')[0]?.trim() ?? ''
}

/**
 * Resolve true if the image URL actually loads as a real cover. Cross-origin
 * load/error events fire without CORS, so this is a reliable probe — and
 * `naturalWidth > 1` rejects the ~1px "image not available" sentinels that some
 * sources return with a 200, treating them as a miss so we advance.
 */
function imageLoads(url: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false)
      return
    }
    const img = new Image()
    const onAbort = () => finish(false)
    function finish(ok: boolean) {
      img.onload = null
      img.onerror = null
      signal?.removeEventListener('abort', onAbort)
      resolve(ok)
    }
    img.onload = () => finish(img.naturalWidth > 1)
    img.onerror = () => finish(false)
    signal?.addEventListener('abort', onAbort)
    img.src = url
  })
}

/** GET JSON, or null on any non-abort failure. Rethrows AbortError. */
async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (err) {
    if (isAbort(err)) throw err
    return null
  }
}

/** Goodreads-grade cover via the longitood proxy. Best-effort URL or null. */
async function longitoodCover(
  isbn13: string | null,
  title: string,
  firstAuthor: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = isbn13
    ? `${LONGITOOD}?isbn=${encodeURIComponent(isbn13)}`
    : `${LONGITOOD}?book_title=${encodeURIComponent(title)}&author_name=${encodeURIComponent(firstAuthor)}`
  const data = await fetchJson<{ url?: string }>(url, signal)
  return data?.url ?? null
}

/** Open Library WORK canonical cover URL (large), or null. */
async function olWorkCover(
  title: string,
  firstAuthor: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const q = `${title} ${firstAuthor}`.trim()
  const url = `${OL_SEARCH}?q=${encodeURIComponent(q)}&fields=cover_edition_key,cover_i&limit=1`
  const data = await fetchJson<{
    docs?: { cover_edition_key?: string; cover_i?: number }[]
  }>(url, signal)
  const doc = data?.docs?.[0]
  if (!doc) return null
  if (doc.cover_edition_key) {
    return `${OL_COVER_OLID}/${doc.cover_edition_key}-L.jpg?default=false`
  }
  if (typeof doc.cover_i === 'number') {
    return `${OL_COVER_ID}/${doc.cover_i}-L.jpg?default=false`
  }
  return null
}

/** Force https, strip edge=curl, and bump the tiny zoom=1 to a larger size. */
function upgradeGoogleCover(url: string): string {
  return url
    .replace(/^http:\/\//i, 'https://')
    .replace(/([?&])edge=curl(&|$)/gi, (_m, sep: string, tail: string) =>
      tail === '&' ? sep : '',
    )
    .replace(/([?&]zoom=)1\b/i, (_m, prefix: string) => `${prefix}2`)
}

async function doResolve(
  input: CoverInput,
  signal?: AbortSignal,
): Promise<string | null> {
  const firstAuthor = firstAuthorOf(input.author)
  const isbn = input.isbn
  const isbn13 = isbn && /^\d{13}$/.test(isbn) ? isbn : null

  // 1. Goodreads-grade cover via hosted proxy (best-effort, popular edition).
  //    To drop the third-party proxy later, delete this single block — steps
  //    2-4 are a fully native, self-sufficient fallback chain.
  const proxy = await longitoodCover(isbn13, input.title, firstAuthor, signal)
  if (proxy && (await imageLoads(proxy, signal))) return proxy
  if (signal?.aborted) throw abortError()

  // 2. Open Library WORK canonical cover, large — the recognizable edition.
  const work = await olWorkCover(input.title, firstAuthor, signal)
  if (work && (await imageLoads(work, signal))) return work
  if (signal?.aborted) throw abortError()

  // 3. Open Library by the book's own ISBN, large.
  if (isbn) {
    const byIsbn = `${OL_COVER_ISBN}/${encodeURIComponent(isbn)}-L.jpg?default=false`
    if (await imageLoads(byIsbn, signal)) return byIsbn
  }
  if (signal?.aborted) throw abortError()

  // 4. Google thumbnail, upgraded. Lowest priority — this is the source that
  //    gave us the wrong edition in the first place.
  if (input.coverUrl) {
    const upgraded = upgradeGoogleCover(input.coverUrl)
    if (await imageLoads(upgraded, signal)) return upgraded
  }

  // 5. nothing loaded → caller shows the neutral placeholder.
  return null
}

/**
 * Resolve a working cover URL for a book, or null. Cached per id; concurrent
 * calls for the same id share one resolution. Pass an AbortSignal so a
 * superseded keystroke cancels the in-flight lookup.
 */
export async function resolveCover(
  input: CoverInput,
  signal?: AbortSignal,
): Promise<string | null> {
  const hit = cache.get(input.id)
  if (hit !== undefined) return hit

  const existing = inflight.get(input.id)
  if (existing) {
    try {
      return await existing
    } catch (err) {
      // Shared lookup was cancelled by another consumer; if we're still live,
      // resolve afresh rather than inheriting its abort.
      if (isAbort(err) && !signal?.aborted) return resolveCover(input, signal)
      throw err
    }
  }

  const pending = withCoverSlot(() => doResolve(input, signal))
  inflight.set(input.id, pending)
  try {
    const url = await pending
    cache.set(input.id, url) // cache the result (incl. null) — no re-probing
    return url
  } finally {
    inflight.delete(input.id)
  }
}
