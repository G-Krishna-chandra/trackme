// Runtime-only cover resolution. A book's stored coverUrl comes from Google
// Books `imageLinks`, which is absent on metadata-only editions and dropped
// under the unauthenticated quota — and when a volume has neither a thumbnail
// nor an ISBN, no identifier-keyed source can fire. So we resolve covers here,
// in the render path, via a multi-source chain whose key step is Open Library's
// title-addressable search (not gated on the book already having an identifier).
//
// Results are cached per book id (negative results too) and in-flight lookups
// are de-duped, so the same id never fires the title lookup twice. This NEVER
// mutates stored book records.

export interface CoverInput {
  id: string
  title: string
  author: string
  isbn: string | null
  coverUrl: string | null
}

const OL_COVER_ID = 'https://covers.openlibrary.org/b/id'
const OL_COVER_ISBN = 'https://covers.openlibrary.org/b/isbn'
const OL_SEARCH = 'https://openlibrary.org/search.json'

const cache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

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

/**
 * Resolve true if the image URL actually loads. Cross-origin load/error events
 * fire without CORS, so this is a reliable existence probe — and with OL's
 * `default=false`, a missing cover 404s (error) instead of returning a grey
 * placeholder that would "load" successfully.
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
    img.onload = () => finish(true)
    img.onerror = () => finish(false)
    signal?.addEventListener('abort', onAbort)
    img.src = url
  })
}

/** Open Library title-addressable lookup → a cover_i, if any. */
async function olCoverIdByTitle(
  title: string,
  author: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const url =
    `${OL_SEARCH}?title=${encodeURIComponent(title)}` +
    `&author=${encodeURIComponent(author)}&fields=cover_i&limit=1`
  const res = await fetch(url, { signal })
  if (!res.ok) return null
  const data = (await res.json()) as { docs?: { cover_i?: number }[] }
  const coverId = data.docs?.[0]?.cover_i
  return typeof coverId === 'number' ? coverId : null
}

async function doResolve(
  input: CoverInput,
  signal?: AbortSignal,
): Promise<string | null> {
  // a. the stored Google thumbnail, if present.
  if (input.coverUrl && (await imageLoads(input.coverUrl, signal))) {
    return input.coverUrl
  }
  if (signal?.aborted) throw abortError()

  // b. Open Library by ISBN (default=false → 404 when missing, so we advance).
  if (input.isbn) {
    const byIsbn = `${OL_COVER_ISBN}/${encodeURIComponent(input.isbn)}-M.jpg?default=false`
    if (await imageLoads(byIsbn, signal)) return byIsbn
  }
  if (signal?.aborted) throw abortError()

  // c. Open Library title lookup → cover by cover_i (works without any ISBN).
  if (input.title) {
    const coverId = await olCoverIdByTitle(input.title, input.author, signal)
    if (coverId !== null) {
      const byId = `${OL_COVER_ID}/${coverId}-M.jpg`
      if (await imageLoads(byId, signal)) return byId
    }
  }

  // d. nothing loaded → caller shows the neutral placeholder.
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

  const pending = doResolve(input, signal)
  inflight.set(input.id, pending)
  try {
    const url = await pending
    cache.set(input.id, url) // cache the result (incl. null) — no re-probing
    return url
  } finally {
    inflight.delete(input.id)
  }
}
