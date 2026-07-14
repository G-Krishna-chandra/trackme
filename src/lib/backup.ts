// Export / import ALL app data. With no account, this is the only backup a
// hosted free user has, so it must be lossless: we snapshot every `trackme.*`
// localStorage key's raw string verbatim (entries, books, gym, chess, cover
// cache, template cache, settings…) and restore them byte-for-byte. Import
// REPLACES all current data (simplest correct behavior).

const PREFIX = 'trackme.'
export const BACKUP_VERSION = 1

export interface Backup {
  app: 'trackme'
  version: number
  exportedAt: string
  data: Record<string, string>
}

function trackmeKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) keys.push(k)
  }
  return keys
}

export function exportAll(): Backup {
  const data: Record<string, string> = {}
  for (const k of trackmeKeys()) {
    const v = localStorage.getItem(k)
    if (v !== null) data[k] = v
  }
  return {
    app: 'trackme',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export type ValidationResult =
  | { ok: true; backup: Backup }
  | { ok: false; error: string }

export function parseBackup(text: string): ValidationResult {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Not a valid JSON file.' }
  }
  const b = obj as Partial<Backup>
  if (!b || b.app !== 'trackme' || typeof b.version !== 'number' || !b.data) {
    return { ok: false, error: 'This is not a TrackMe backup file.' }
  }
  if (b.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `This backup is from a newer version (v${b.version}); this app reads up to v${BACKUP_VERSION}.`,
    }
  }
  if (typeof b.data !== 'object') {
    return { ok: false, error: 'Backup data is malformed.' }
  }
  return { ok: true, backup: b as Backup }
}

/** REPLACE all TrackMe data with the backup's. Caller should reload after. */
export function importAll(backup: Backup): void {
  for (const k of trackmeKeys()) localStorage.removeItem(k)
  for (const [k, v] of Object.entries(backup.data)) {
    if (k.startsWith(PREFIX) && typeof v === 'string') localStorage.setItem(k, v)
  }
}

/** Count of habit-bearing keys, for a "you have data" hint before export. */
export function hasAnyData(): boolean {
  return trackmeKeys().some((k) => {
    const v = localStorage.getItem(k)
    return v !== null && v !== '[]' && v !== '{}' && v !== ''
  })
}
