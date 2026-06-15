import type { Habit } from '../types'

// The data layer is multi-habit. Each habit is one row here; the repository
// merges in any seed habit the store is missing (so existing installs gain new
// habits without losing their data). Reading keeps its own coloring/logger;
// Gym adds its own (per-type rolling baseline, per-set logging).
export const SEED_HABITS: Habit[] = [
  { id: 'reading', name: 'Reading', unit: 'pages', color: 'green' },
  { id: 'gym', name: 'Gym', unit: 'volume', color: 'purple' },
  { id: 'guitar', name: 'Guitar', unit: 'minutes', color: 'orange' },
]

export const PRIMARY_HABIT_ID = 'reading'
export const GYM_HABIT_ID = 'gym'
