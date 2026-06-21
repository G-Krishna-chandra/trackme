import type { Level } from '../types'
import { cellColor } from '../lib/colors'
import { MUSCLE_SVG } from './bodyMuscleData'

// Anatomical muscle map. The contoured per-muscle polygons are vendored from
// react-body-highlighter (MIT, © GV79) in ./bodyMuscleData; here we map the
// asset's muscle slugs onto our Hevy muscle keys and drive fill + hover
// ourselves (the data layer is unchanged — levelOf/onEnter still speak Hevy
// keys). Where the asset splits a group finer (deltoids front/back, abs +
// obliques, calves + soleus) every sub-region takes the group's single
// intensity. Where it's coarser than our data (lats + upper_back share one
// "upper-back" region) we color by — and hover reports — the harder-trained of
// the two.

// asset slug → our Hevy muscle key(s). An array means "pick the dominant".
const ANTERIOR_MAP: Record<string, string | string[]> = {
  chest: 'chest',
  'front-deltoids': 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearm: 'forearms',
  abs: 'abdominals',
  obliques: 'abdominals',
  quadriceps: 'quadriceps',
  abductors: 'abductors',
  calves: 'calves',
}

const POSTERIOR_MAP: Record<string, string | string[]> = {
  trapezius: 'traps',
  'upper-back': ['lats', 'upper_back'],
  'lower-back': 'lower_back',
  'back-deltoids': 'shoulders',
  triceps: 'triceps',
  forearm: 'forearms',
  gluteal: 'glutes',
  hamstring: 'hamstrings',
  adductor: 'adductors',
  calves: 'calves',
  'left-soleus': 'calves',
  'right-soleus': 'calves',
}

// Non-muscle slugs from the asset — drawn faint to complete the figure.
const SILHOUETTE_SLUGS = new Set(['head', 'neck', 'knees'])

interface BodyMapProps {
  view: 'front' | 'back'
  color: string
  levelOf: (muscle: string) => Level
  onEnter: (muscle: string, rect: DOMRect) => void
  onLeave: () => void
}

export function BodyMap({ view, color, levelOf, onEnter, onLeave }: BodyMapProps) {
  const regions = view === 'front' ? MUSCLE_SVG.anterior : MUSCLE_SVG.posterior
  const map = view === 'front' ? ANTERIOR_MAP : POSTERIOR_MAP

  const faint = cellColor(color, 0)

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={MUSCLE_SVG.viewBox}
        className="w-full max-w-[150px]"
        role="img"
        aria-label={`${view} muscle map`}
      >
        {Object.entries(regions).map(([slug, polys]) => {
          const target = map[slug]

          // Non-muscle / unmapped → faint silhouette, not interactive.
          if (!target || SILHOUETTE_SLUGS.has(slug)) {
            return (
              <g key={slug} aria-hidden>
                {polys.map((points, i) => (
                  <polygon key={i} points={points} fill={faint} />
                ))}
              </g>
            )
          }

          // Resolve the Hevy key driving this region (dominant one if several).
          const candidates = Array.isArray(target) ? target : [target]
          let pick = candidates[0]
          for (const c of candidates) if (levelOf(c) > levelOf(pick)) pick = c
          const fill = cellColor(color, levelOf(pick))

          return (
            <g
              key={slug}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => onEnter(pick, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={onLeave}
            >
              {polys.map((points, i) => (
                <polygon
                  key={i}
                  points={points}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={0.3}
                />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="text-[11px] font-medium text-[#656d76]">
        {view === 'front' ? 'Front' : 'Back'}
      </div>
    </div>
  )
}
