import type { Level } from '../types'
import { cellColor } from '../lib/colors'
import { MUSCLE_SVG } from './bodyMuscleData'

// Anatomical muscle map. Contoured per-muscle paths are vendored from
// react-native-body-highlighter (MIT, © 2022 ELABBASSI Hicham) in
// ./bodyMuscleData; here we map the asset's slugs onto our Hevy muscle keys and
// drive fill + hover ourselves (the data layer is unchanged — levelOf/onEnter
// still speak Hevy keys).
//
// Correctness rule: a region only shows its own label/intensity when Hevy
// distinguishes that group. Asset regions FINER than Hevy fold into the Hevy
// group (obliques→abdominals "Abs", tibialis→calves "Calves"; quad/delt shapes
// already share one slug). Where the asset is COARSER than Hevy (no separate
// lats; no abductor shape) two Hevy groups share one region, colored/labeled by
// the harder-trained of the two — never inventing a finer label.

// asset slug → Hevy key, or [keys] meaning "pick the dominant".
const FRONT_MAP: Record<string, string | string[]> = {
  chest: 'chest',
  deltoids: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearm: 'forearms',
  abs: 'abdominals',
  obliques: 'abdominals', // Hevy has no obliques → folded into Abs
  quadriceps: 'quadriceps',
  adductors: 'adductors', // distinct inner-thigh group (the fix)
  calves: 'calves',
  tibialis: 'calves', // Hevy has no tibialis → folded into Calves
  trapezius: 'traps',
}

const BACK_MAP: Record<string, string | string[]> = {
  trapezius: 'traps',
  'upper-back': ['lats', 'upper_back'], // asset has no separate lats → dominant
  'lower-back': 'lower_back',
  deltoids: 'shoulders',
  triceps: 'triceps',
  forearm: 'forearms',
  gluteal: ['glutes', 'abductors'], // asset has no hip-abductor shape → dominant
  hamstring: 'hamstrings',
  adductors: 'adductors',
  calves: 'calves',
}

// Non-muscle slugs — drawn faint to complete the figure, not interactive.
const SILHOUETTE_SLUGS = new Set(['head', 'hair', 'neck', 'knees', 'ankles', 'feet', 'hands'])

interface BodyMapProps {
  view: 'front' | 'back'
  color: string
  levelOf: (muscle: string) => Level
  onEnter: (muscle: string, rect: DOMRect) => void
  onLeave: () => void
}

export function BodyMap({ view, color, levelOf, onEnter, onLeave }: BodyMapProps) {
  const regions = view === 'front' ? MUSCLE_SVG.front : MUSCLE_SVG.back
  const map = view === 'front' ? FRONT_MAP : BACK_MAP
  const viewBox = view === 'front' ? MUSCLE_SVG.viewBoxFront : MUSCLE_SVG.viewBoxBack
  const faint = cellColor(color, 0)

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={viewBox}
        className="w-full max-w-[150px]"
        role="img"
        aria-label={`${view} muscle map`}
      >
        {Object.entries(regions).map(([slug, paths]) => {
          const target = map[slug]

          if (!target || SILHOUETTE_SLUGS.has(slug)) {
            return (
              <g key={slug} aria-hidden>
                {paths.map((d, i) => (
                  <path key={i} d={d} fill={faint} />
                ))}
              </g>
            )
          }

          // Hevy key driving this region (the dominant one if several share it).
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
              {paths.map((d, i) => (
                <path key={i} d={d} fill={fill} stroke="#ffffff" strokeWidth={2} />
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
