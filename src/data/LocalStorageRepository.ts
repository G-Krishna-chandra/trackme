import type { Entry, Habit } from '../types'
import type { EntryRepository } from './EntryRepository'
import { SEED_HABITS } from './seed'

const HABITS_KEY = 'trackme.habits'
const ENTRIES_KEY = 'trackme.entries'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/** localStorage-backed EntryRepository. Stores ONLY raw entries (no levels). */
export class LocalStorageRepository implements EntryRepository {
  constructor() {
    // Ensure every seed habit exists. Merge (not overwrite) so existing rows —
    // and any future user edits to them — are preserved while newly-added seed
    // habits (e.g. Gym) appear for installs that predate them.
    const existing = read<Habit[]>(HABITS_KEY, [])
    const known = new Set(existing.map((h) => h.id))
    const missing = SEED_HABITS.filter((h) => !known.has(h.id))
    if (missing.length > 0) write(HABITS_KEY, [...existing, ...missing])
  }

  getHabits(): Habit[] {
    return read<Habit[]>(HABITS_KEY, SEED_HABITS)
  }

  getHabit(id: string): Habit | undefined {
    return this.getHabits().find((h) => h.id === id)
  }

  listEntries(habitId: string): Entry[] {
    return read<Entry[]>(ENTRIES_KEY, []).filter((e) => e.habitId === habitId)
  }

  upsertEntry(entry: Entry): void {
    const all = read<Entry[]>(ENTRIES_KEY, [])
    const idx = all.findIndex(
      (e) => e.habitId === entry.habitId && e.date === entry.date,
    )
    if (idx >= 0) all[idx] = entry
    else all.push(entry)
    write(ENTRIES_KEY, all)
  }

  deleteEntry(habitId: string, date: string): void {
    const all = read<Entry[]>(ENTRIES_KEY, [])
    const next = all.filter(
      (e) => !(e.habitId === habitId && e.date === date),
    )
    write(ENTRIES_KEY, next)
  }
}
