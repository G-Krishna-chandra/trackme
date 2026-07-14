import { useMemo, useState } from 'react'
import type { GymSession, Level } from '../types'
import { cellColor } from '../lib/colors'
import { formatLong } from '../lib/date'
import { useMuscleMap } from '../store/useMuscleMap'
import {
  attributeMuscles,
  MUSCLE_LABELS,
  muscleLevel,
} from '../lib/muscles'
import { BodyMap } from './BodyMap'
import { capabilities } from '../lib/capabilities'

interface MuscleHeatMapProps {
  sessions: GymSession[]
  bodyweight: number
  weightUnit: 'kg' | 'lbs'
  color: string
}

const WINDOWS = [7, 30, 90] as const

interface Hover {
  muscle: string
  rect: DOMRect
}

export function MuscleHeatMap({
  sessions,
  bodyweight,
  weightUnit,
  color,
}: MuscleHeatMapProps) {
  const { templateMap, fetchedAt, status, refresh } = useMuscleMap()
  const [windowDays, setWindowDays] = useState<number>(30)
  const [hover, setHover] = useState<Hover | null>(null)

  const attribution = useMemo(
    () => attributeMuscles(sessions, windowDays, templateMap, bodyweight),
    [sessions, windowDays, templateMap, bodyweight],
  )

  const levelOf = (muscle: string): Level =>
    muscleLevel(attribution.byMuscle.get(muscle)?.volume ?? 0, attribution.maxVolume)

  const hoverStat = hover ? attribution.byMuscle.get(hover.muscle) : undefined

  return (
    <section className="mt-6 rounded-lg border border-[#d0d7de] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-[#1f2328]">
          Muscle heat map
        </h2>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              className={`rounded-md border px-2 py-0.5 text-[12px] font-medium ${
                windowDays === w
                  ? 'border-[#8250df] bg-[#8250df] text-white'
                  : 'border-[#d0d7de] bg-white text-[#1f2328] hover:bg-[#f3f4f6]'
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-[12px] text-[#656d76]">
        Volume per muscle over the last {windowDays} days, shaded against your
        most-trained muscle — darkest = most worked, faint = neglected.
      </p>

      <div className="flex items-start justify-center gap-6">
        <BodyMap
          view="front"
          color={color}
          levelOf={levelOf}
          onEnter={(muscle, rect) => setHover({ muscle, rect })}
          onLeave={() => setHover(null)}
        />
        <BodyMap
          view="back"
          color={color}
          levelOf={levelOf}
          onEnter={(muscle, rect) => setHover({ muscle, rect })}
          onLeave={() => setHover(null)}
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 text-[11px] text-[#656d76]">
        <span className="mr-1">Less</span>
        {([0, 1, 2, 3, 4] as Level[]).map((l) => (
          <span
            key={l}
            style={{
              width: 11,
              height: 11,
              borderRadius: 2,
              backgroundColor: cellColor(color, l),
              boxShadow: 'inset 0 0 0 1px rgba(27,31,35,0.06)',
            }}
          />
        ))}
        <span className="ml-1">More</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8c959f]">
        <span>
          {status === 'loading'
            ? 'Loading exercise data…'
            : status === 'auth'
              ? 'Add HEVY_API_KEY to .env.local and restart dev to load exercise data.'
              : status === 'error'
                ? 'Could not load exercise data.'
                : fetchedAt
                  ? `Exercise data from ${formatLong(fetchedAt.slice(0, 10))}`
                  : capabilities.hevyApiSync
                    ? 'No exercise data yet — Sync from Hevy first.'
                    : 'Muscle attribution needs Hevy exercise data — import a backup that includes it.'}
          {attribution.unattributedVolume > 0
            ? ` · ${Math.round(attribution.unattributedVolume).toLocaleString()} ${weightUnit} (${attribution.unattributedSets} sets) couldn't be mapped to a muscle`
            : ''}
        </span>
        {capabilities.hevyApiSync ? (
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={status === 'loading'}
            className="rounded-md border border-[#d0d7de] px-2 py-0.5 text-[12px] font-medium text-[#1f2328] hover:bg-[#f3f4f6] disabled:opacity-60"
          >
            Refresh exercise data
          </button>
        ) : null}
      </div>

      {hover ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-[#1f2328] px-2 py-1.5 text-center text-[11px] leading-tight text-white shadow-lg"
          style={{
            top: hover.rect.top - 8,
            left: Math.max(
              72,
              Math.min(hover.rect.left + hover.rect.width / 2, window.innerWidth - 72),
            ),
            maxWidth: 220,
          }}
        >
          <div className="font-semibold">{MUSCLE_LABELS[hover.muscle] ?? hover.muscle}</div>
          <div className="text-[#d0d7de]">
            {Math.round(hoverStat?.volume ?? 0).toLocaleString()} {weightUnit} ·{' '}
            {hoverStat?.sets ?? 0} sets
          </div>
        </div>
      ) : null}
    </section>
  )
}
