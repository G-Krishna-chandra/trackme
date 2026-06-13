import type { Habit } from '../types'

// v1 ships exactly ONE habit. The data layer supports many; only this is seeded.
// Adding more later (e.g. gym) is just more rows here — no schema change.
export const SEED_HABITS: Habit[] = [
  { id: 'reading', name: 'Reading', unit: 'pages', color: 'green' },
]

/** The single habit v1 surfaces in the UI. */
export const PRIMARY_HABIT_ID = 'reading'
