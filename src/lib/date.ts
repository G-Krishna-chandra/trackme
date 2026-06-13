// Date helpers. Every date is an ISO yyyy-mm-dd string interpreted in the
// user's LOCAL timezone. We deliberately avoid UTC parsing (`new Date("...")`)
// so that "today" matches the user's wall clock and never drifts a day.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Format a local Date as yyyy-mm-dd. */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Parse yyyy-mm-dd to a local Date at midnight. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

/** Add n days (may be negative) to an ISO date. */
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(iso: string): number {
  return parseISO(iso).getDay()
}

/** The Sunday that starts the week containing `iso`. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -dayOfWeek(iso))
}

export function monthShort(iso: string): string {
  return MONTHS[parseISO(iso).getMonth()]
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()]
}

/** Human label like "May 14, 2026". */
export function formatLong(iso: string): string {
  const d = parseISO(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/** Short label like "May 14" (no year). */
export function formatShort(iso: string): string {
  const d = parseISO(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}
