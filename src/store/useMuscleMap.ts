import { useCallback, useEffect, useState } from 'react'
import { fetchExerciseTemplates } from '../lib/hevySync'
import { buildTemplateMap, type TemplateMap } from '../lib/muscles'

// Cached Hevy exercise_template → muscle map. Templates rarely change, so it's
// stored in localStorage and only re-fetched when missing, stale, or on manual
// refresh. The fetch goes through the same dev proxy (key stays server-side).

const MAP_KEY = 'trackme.hevyTemplateMap'
const AT_KEY = 'trackme.hevyTemplateFetchedAt'
const STALE_MS = 7 * 24 * 60 * 60 * 1000

function readMap(): TemplateMap {
  try {
    const raw = localStorage.getItem(MAP_KEY)
    return raw ? (JSON.parse(raw) as TemplateMap) : {}
  } catch {
    return {}
  }
}

function readAt(): string | null {
  try {
    return localStorage.getItem(AT_KEY)
  } catch {
    return null
  }
}

export type MuscleMapStatus = 'idle' | 'loading' | 'error' | 'auth'

export interface UseMuscleMap {
  templateMap: TemplateMap
  fetchedAt: string | null
  status: MuscleMapStatus
  refresh: (signal?: AbortSignal) => Promise<void>
}

export function useMuscleMap(): UseMuscleMap {
  const [templateMap, setTemplateMap] = useState<TemplateMap>(() => readMap())
  const [fetchedAt, setFetchedAt] = useState<string | null>(() => readAt())
  const [status, setStatus] = useState<MuscleMapStatus>('idle')

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading')
    try {
      const templates = await fetchExerciseTemplates(undefined, signal)
      const map = buildTemplateMap(templates)
      const at = new Date().toISOString()
      try {
        localStorage.setItem(MAP_KEY, JSON.stringify(map))
        localStorage.setItem(AT_KEY, at)
      } catch {
        /* ignore quota */
      }
      setTemplateMap(map)
      setFetchedAt(at)
      setStatus('idle')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setStatus('idle')
        return
      }
      setStatus((err as Error)?.name === 'HevyAuthError' ? 'auth' : 'error')
    }
  }, [])

  // Auto-fetch once on mount if the cache is empty or stale.
  useEffect(() => {
    const empty = Object.keys(readMap()).length === 0
    const at = readAt()
    const stale = !at || Date.now() - Date.parse(at) > STALE_MS
    if (empty || stale) {
      const ctrl = new AbortController()
      void refresh(ctrl.signal)
      return () => ctrl.abort()
    }
  }, [refresh])

  return { templateMap, fetchedAt, status, refresh }
}
