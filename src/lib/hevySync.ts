import type { GymExercise, GymSession } from '../types'
import { GYM_HABIT_ID } from '../data/seed'
import { toISO } from './date'
import { guessType, isBodyweightName, type WeightUnit } from './hevyImport'

// Live sync from the Hevy API. The browser only ever calls the same-origin
// Vite proxy (/api/hevy/*); the api-key header is injected server-side in
// vite.config.ts, so the key never reaches client code. Hevy's API is kg-based
// regardless of the user's display unit; we normalize to the app's unit so the
// per-type rolling baseline isn't corrupted by mixed units.
//
// v1 does a full paginated pull each sync (simple + idempotent). Future
// optimization: GET /v1/workouts/events?since=<timestamp> for incremental sync.

const BASE = '/api/hevy/v1'
const PAGE_SIZE = 10 // Hevy caps pageSize (~10)
const LB_PER_KG = 2.2046226218

/** Thrown on 401/403 (missing or invalid key) so the UI can show setup help. */
export class HevyAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HevyAuthError'
  }
}

export interface HevySet {
  type?: string
  weight_kg?: number | null
  reps?: number | null
}
export interface HevyExercise {
  title?: string
  exercise_template_id?: string
  sets?: HevySet[]
}
export interface HevyWorkout {
  id?: string
  title?: string
  description?: string
  start_time?: string | number
  exercises?: HevyExercise[]
}

export interface SyncResult {
  sessions: GymSession[]
  total: number
  /** First raw workout from page 1 — shown if the shape can't be mapped. */
  sampleWorkout: unknown
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    signal,
    headers: { accept: 'application/json' },
  })
  if (res.status === 401 || res.status === 403) {
    throw new HevyAuthError(`Hevy auth failed (${res.status})`)
  }
  if (!res.ok) throw new Error(`Hevy request failed (${res.status})`)
  return res.json()
}

export async function fetchWorkoutCount(signal?: AbortSignal): Promise<number> {
  const data = (await getJson('/workouts/count', signal)) as {
    workout_count?: number
    count?: number
  }
  return data.workout_count ?? data.count ?? 0
}

async function fetchWorkoutsPage(
  page: number,
  signal?: AbortSignal,
): Promise<{ workouts: HevyWorkout[]; pageCount: number }> {
  const data = (await getJson(
    `/workouts?page=${page}&pageSize=${PAGE_SIZE}`,
    signal,
  )) as { workouts?: HevyWorkout[]; page_count?: number }
  return { workouts: data.workouts ?? [], pageCount: data.page_count ?? 1 }
}

/** Parse Hevy start_time (ISO 8601 string, or a unix number) to a LOCAL date. */
function toLocalDate(start: string | number | undefined): string | null {
  if (start === undefined || start === null || start === '') return null
  let d: Date
  if (typeof start === 'number') {
    d = new Date(start < 1e12 ? start * 1000 : start)
  } else {
    const t = Date.parse(start)
    if (Number.isNaN(t)) return null
    d = new Date(t)
  }
  return Number.isNaN(d.getTime()) ? null : toISO(d)
}

function normalizeWeight(kg: number, unit: WeightUnit): number {
  const w = unit === 'lbs' ? kg * LB_PER_KG : kg
  return Math.round(w * 100) / 100
}

/** Map one Hevy workout to a GymSession (same shape the manual logger writes). */
export function mapHevyWorkout(
  w: HevyWorkout,
  unit: WeightUnit,
): GymSession | null {
  if (!w.id) return null
  const date = toLocalDate(w.start_time)
  if (!date) return null

  const exercises: GymExercise[] = []
  for (const ex of w.exercises ?? []) {
    const name = (ex.title ?? '').trim()
    if (!name) continue
    const sets = (ex.sets ?? [])
      .map((s) => ({
        reps: Math.max(0, Math.floor(Number(s.reps) || 0)),
        weight: normalizeWeight(Math.max(0, Number(s.weight_kg) || 0), unit),
        warmup: (s.type ?? '').toLowerCase() === 'warmup',
      }))
      .filter((s) => s.reps > 0)
    if (sets.length === 0) continue
    exercises.push({
      name,
      isBodyweight: isBodyweightName(name),
      sets,
      exerciseTemplateId: ex.exercise_template_id,
    })
  }
  if (exercises.length === 0) return null

  const title = (w.title ?? '').trim()
  const description = (w.description ?? '').trim()
  return {
    id: `hevy:${w.id}`,
    habitId: GYM_HABIT_ID,
    hevyId: w.id,
    date,
    type: guessType(title),
    exercises,
    note: title || description || undefined,
  }
}

/**
 * Full paginated pull. Reports progress as (workoutsProcessed, total). Returns
 * mapped sessions plus a sample raw workout for diagnostics.
 */
export async function syncFromHevy(
  unit: WeightUnit,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<SyncResult> {
  const total = await fetchWorkoutCount(signal)
  onProgress(0, total)

  const sessions: GymSession[] = []
  let sampleWorkout: unknown = undefined
  let done = 0
  let page = 1
  let pageCount = 1

  do {
    const { workouts, pageCount: pc } = await fetchWorkoutsPage(page, signal)
    pageCount = pc
    if (sampleWorkout === undefined && workouts.length > 0) {
      sampleWorkout = workouts[0]
    }
    for (const w of workouts) {
      const mapped = mapHevyWorkout(w, unit)
      if (mapped) sessions.push(mapped)
      done++
    }
    onProgress(Math.min(done, total || done), total)
    page++
  } while (page <= pageCount)

  return { sessions, total, sampleWorkout }
}
