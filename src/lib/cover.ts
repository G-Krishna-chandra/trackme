import type { Book } from '../types'
import { LocalStorageBookRepository } from '../data/LocalStorageBookRepository'

// Cover resolution. A book's stored coverUrl comes from whatever edition Google
// ranked first — often a no-name reprint, not the WORK's recognizable cover. So
// we resolve the canonical, highest-res cover, but we pay that cost LATER, not
// up front: BookCover paints the Google thumbnail instantly and this resolver
// upgrades to the canonical cover in the background. Resolved covers are cached
// (memory + localStorage) and written back onto the stored Book, so a given
// book is resolved at most once — ever.
//
// The top tier (longitood proxy + Open Library WORK cover) runs CONCURRENTLY:
// the first verified-loadable image wins, so a slow/absent source never delays
// a present one. Candidate order is preserved only as a tiebreak.

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
const LONGITOOD_TIMEOUT_MS = 1500
const COVER_CACHE_KEY = 'trackme.coverCache'

// Same localStorage-backed store useHabit uses (stateless — a parallel instance
// reads/writes the same keys). Lets us write the resolved cover back onto the
// stored Book record without threading the repo through the component tree.
const bookRepo = new LocalStorageBookRepository()

const cache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()
let cacheLoaded = false

function loadCache(): void {
  if (cacheLoaded) return
  cacheLoaded = true
  try {
    const raw = localStorage.getItem(COVER_CACHE_KEY)
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, string>
    for (const [id, url] of Object.entries(obj)) cache.set(id, url)
  } catch {
    /* ignore unavailable/corrupt cache */
  }
}

function persistCover(id: string, url: string): void {
  // localStorage holds only positive resolutions; a null (no cover) stays
  // session-only so a later session can retry.
  try {
    const raw = localStorage.getItem(COVER_CACHE_KEY)
    const obj = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    obj[id] = url
    localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(obj))
  } catch {
    /* ignore quota/unavailable */
  }
  // Write back onto the stored Book so its record reflects the good cover.
  const book = bookRepo.getBook(id)
  if (book && book.coverUrl !== url) {
    bookRepo.upsertBook({ ...book, coverUrl: url } satisfies Book)
  }
}

// Cap concurrent cover resolutions so a 6-row dropdown doesn't fan out into a
// burst. Cache + in-flight dedupe (below) stop the SAME id from re-resolving;
// this bounds the number of DISTINCT ids resolving at once.
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
  loadCache()
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

/** Force https, strip edge=curl, and bump the tiny zoom=1 to a larger size.
 *  Exported so BookCover can paint this instantly as the first cover. */
export function upgradeGoogleCover(url: string): string {
  return url
    .replace(/^http:\/\//i, 'https://')
    .replace(/([?&])edge=curl(&|$)/gi, (_m, sep: string, tail: string) =>
      tail === '&' ? sep : '',
    )
    .replace(/([?&]zoom=)1\b/i, (_m, prefix: string) => `${prefix}2`)
}

/**
 * Resolve true if the image URL actually loads as a real cover. Cross-origin
 * load/error events fire without CORS, so this is a reliable probe — and
 * `naturalWidth > 1` rejects the ~1px "image not available" sentinels that some
 * sources return with a 200, treating them as a miss so we advance. As a bonus
 * the probe warms the browser cache, so a later <img src> swap is flicker-free.
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

/** A signal that aborts when `outer` aborts OR after a timeout. */
function withTimeout(outer: AbortSignal | undefined, ms: number) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  const onOuter = () => ctrl.abort()
  if (outer) {
    if (outer.aborted) ctrl.abort()
    else outer.addEventListener('abort', onOuter, { once: true })
  }
  return {
    signal: ctrl.signal,
    dispose: () => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', onOuter)
    },
  }
}

/** Goodreads-grade cover via the longitood proxy → a verified-loadable URL or
 *  null. Capped at ~1.5s so it can never delay the concurrent OL lookup; a real
 *  (outer) cancellation still propagates. */
async function longitoodLoadable(
  isbn13: string | null,
  title: string,
  firstAuthor: string,
  outer?: AbortSignal,
): Promise<string | null> {
  const { signal, dispose } = withTimeout(outer, LONGITOOD_TIMEOUT_MS)
  try {
    const url = isbn13
      ? `${LONGITOOD}?isbn=${encodeURIComponent(isbn13)}`
      : `${LONGITOOD}?book_title=${encodeURIComponent(title)}&author_name=${encodeURIComponent(firstAuthor)}`
    const data = await fetchJson<{ url?: string }>(url, signal)
    const cover = data?.url
    if (cover && (await imageLoads(cover, signal))) return cover
    return null
  } catch (err) {
    if (isAbort(err) && outer?.aborted) throw err // real cancel
    return null // our timeout or any failure → no result, don't block the race
  } finally {
    dispose()
  }
}

/** Open Library WORK canonical cover (large) → a verified-loadable URL or null. */
async function olWorkLoadable(
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
  const candidate = doc.cover_edition_key
    ? `${OL_COVER_OLID}/${doc.cover_edition_key}-L.jpg?default=false`
    : typeof doc.cover_i === 'number'
      ? `${OL_COVER_ID}/${doc.cover_i}-L.jpg?default=false`
      : null
  if (candidate && (await imageLoads(candidate, signal))) return candidate
  return null
}

/**
 * Resolve to the first task (by completion time) that yields a non-null URL.
 * Tasks are listed in preference order, so when several settle in the same tick
 * the higher-preference one is checked first (the quality tiebreak). A task
 * that rejects with AbortError cancels the whole race; other failures resolve
 * to null and are skipped.
 */
function firstNonNull(tasks: Array<Promise<string | null>>): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let remaining = tasks.length
    let settled = false
    if (remaining === 0) {
      resolve(null)
      return
    }
    for (const task of tasks) {
      task.then(
        (value) => {
          if (settled) return
          if (value) {
            settled = true
            resolve(value)
          } else if (--remaining === 0) {
            resolve(null)
          }
        },
        (err) => {
          if (settled) return
          if (isAbort(err)) {
            settled = true
            reject(err)
          } else if (--remaining === 0) {
            resolve(null)
          }
        },
      )
    }
  })
}

async function doResolve(
  input: CoverInput,
  signal?: AbortSignal,
): Promise<string | null> {
  const firstAuthor = firstAuthorOf(input.author)
  const isbn = input.isbn
  const isbn13 = isbn && /^\d{13}$/.test(isbn) ? isbn : null

  // Top tier: longitood (preferred) and the OL WORK canonical cover, raced
  // concurrently. First verified-loadable wins; preference only breaks ties.
  const top = await firstNonNull([
    longitoodLoadable(isbn13, input.title, firstAuthor, signal),
    olWorkLoadable(input.title, firstAuthor, signal),
  ])
  if (top) return top
  if (signal?.aborted) throw abortError()

  // 3. Open Library by the book's own ISBN, large.
  if (isbn) {
    const byIsbn = `${OL_COVER_ISBN}/${encodeURIComponent(isbn)}-L.jpg?default=false`
    if (await imageLoads(byIsbn, signal)) return byIsbn
  }
  if (signal?.aborted) throw abortError()

  // 4. Google thumbnail, upgraded. Lowest priority — the wrong-edition source.
  if (input.coverUrl) {
    const upgraded = upgradeGoogleCover(input.coverUrl)
    if (await imageLoads(upgraded, signal)) return upgraded
  }

  // 5. nothing loaded → caller keeps the thumbnail / shows the placeholder.
  return null
}

/**
 * Resolve a working cover URL for a book, or null. Cached per id (memory +
 * localStorage) and written back onto the stored Book, so a book is resolved at
 * most once. Concurrent calls for the same id share one resolution. Pass an
 * AbortSignal so a superseded keystroke cancels the in-flight lookup.
 */
export async function resolveCover(
  input: CoverInput,
  signal?: AbortSignal,
): Promise<string | null> {
  loadCache()
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
    if (url) persistCover(input.id, url) // durable + write back to the Book
    return url
  } finally {
    inflight.delete(input.id)
  }
}
