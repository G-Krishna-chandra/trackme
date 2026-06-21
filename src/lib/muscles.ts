import type { GymSession, Level } from '../types'
import { volumeOfExercises } from './gym'
import { addDays, todayISO } from './date'
import type { HevyTemplate } from './hevySync'

// Attribute working volume to muscle groups via Hevy's exercise→muscle data.
// Self-relative coloring like the rest of the app: each muscle's intensity is
// its windowed volume ÷ the most-trained muscle's volume in the window.

/** Volume share a secondary muscle receives (primary always gets 1.0).
 *  Single tunable constant. */
export const SECONDARY_WEIGHT = 0.5

export interface TemplateInfo {
  title: string
  primary: string
  secondaries: string[]
}
export type TemplateMap = Record<string, TemplateInfo>

export function buildTemplateMap(templates: HevyTemplate[]): TemplateMap {
  const map: TemplateMap = {}
  for (const t of templates) {
    if (!t.id) continue
    map[t.id] = {
      title: (t.title ?? '').trim(),
      primary: (t.primary_muscle_group ?? '').trim(),
      secondaries: (t.secondary_muscle_groups ?? [])
        .map((s) => s.trim())
        .filter(Boolean),
    }
  }
  return map
}

// Muscle groups rendered on the body (Hevy's taxonomy). Hevy values without a
// body region (neck, cardio, full_body, other) fall into "unattributed".
export const BODY_MUSCLES = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals',
  'quadriceps', 'hamstrings', 'calves', 'glutes', 'lats', 'upper_back',
  'lower_back', 'traps', 'adductors', 'abductors',
] as const

const BODY_SET = new Set<string>(BODY_MUSCLES)

export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abdominals: 'Abs',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  glutes: 'Glutes',
  lats: 'Lats',
  upper_back: 'Upper back',
  lower_back: 'Lower back',
  traps: 'Traps',
  adductors: 'Adductors',
  abductors: 'Abductors',
}

export interface MuscleStat {
  volume: number
  sets: number
}

export interface Attribution {
  /** Every body muscle → its windowed volume + working-set count (0 if none). */
  byMuscle: Map<string, MuscleStat>
  /** Largest muscle volume (the self-relative denominator). */
  maxVolume: number
  /** Volume from exercises whose muscle couldn't be resolved or has no region. */
  unattributedVolume: number
  unattributedSets: number
}

/** Lowercased template title → info, for name-fallback when no template id. */
function titleIndex(map: TemplateMap): Map<string, TemplateInfo> {
  const idx = new Map<string, TemplateInfo>()
  for (const id in map) {
    const info = map[id]
    if (info.title) idx.set(info.title.toLowerCase(), info)
  }
  return idx
}

export function attributeMuscles(
  sessions: GymSession[],
  windowDays: number,
  templateMap: TemplateMap,
  bodyweight: number,
  today = todayISO(),
): Attribution {
  const start = addDays(today, -(windowDays - 1))
  const titles = titleIndex(templateMap)

  const byMuscle = new Map<string, MuscleStat>()
  for (const m of BODY_MUSCLES) byMuscle.set(m, { volume: 0, sets: 0 })
  let unattributedVolume = 0
  let unattributedSets = 0

  const add = (muscle: string, vol: number, sets: number) => {
    if (!BODY_SET.has(muscle)) {
      unattributedVolume += vol
      unattributedSets += sets
      return
    }
    const s = byMuscle.get(muscle)!
    s.volume += vol
    s.sets += sets
  }

  for (const session of sessions) {
    if (session.date < start || session.date > today) continue
    for (const ex of session.exercises) {
      const exVol = volumeOfExercises([ex], bodyweight) // reuse the volume fn
      const exSets = ex.sets.filter((s) => !s.warmup).length
      if (exVol <= 0 && exSets === 0) continue

      const info = ex.exerciseTemplateId
        ? templateMap[ex.exerciseTemplateId]
        : titles.get(ex.name.trim().toLowerCase())

      if (!info || !info.primary) {
        unattributedVolume += exVol
        unattributedSets += exSets
        continue
      }
      add(info.primary, exVol, exSets)
      for (const sec of info.secondaries) add(sec, exVol * SECONDARY_WEIGHT, exSets)
    }
  }

  let maxVolume = 0
  for (const m of BODY_MUSCLES) {
    maxVolume = Math.max(maxVolume, byMuscle.get(m)!.volume)
  }
  return { byMuscle, maxVolume, unattributedVolume, unattributedSets }
}

/** Self-relative level 0-4 for a muscle's volume vs the window's max. */
export function muscleLevel(volume: number, maxVolume: number): Level {
  if (volume <= 0 || maxVolume <= 0) return 0
  const ratio = Math.min(volume / maxVolume, 1)
  return Math.max(1, Math.min(4, Math.ceil(ratio * 4))) as Level
}
