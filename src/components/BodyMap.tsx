import type { Level } from '../types'
import { cellColor } from '../lib/colors'

// A hand-vendored, stylized front/back body. Each muscle region is a group of
// simple shapes tagged with a Hevy muscle id and filled by its intensity level.
// Not anatomically exact — recognizable enough to read at a glance, and fully
// under our control for intensity + hover (no third-party renderer needed).

type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number }

const SILHOUETTE: Shape[] = [
  { t: 'ellipse', cx: 120, cy: 30, rx: 20, ry: 22 }, // head
  { t: 'rect', x: 108, y: 50, w: 24, h: 12, r: 4 }, // neck
  { t: 'rect', x: 84, y: 60, w: 72, h: 104, r: 16 }, // torso
  { t: 'rect', x: 88, y: 150, w: 64, h: 40, r: 12 }, // hips
  { t: 'rect', x: 58, y: 64, w: 22, h: 98, r: 11 }, // left arm
  { t: 'rect', x: 160, y: 64, w: 22, h: 98, r: 11 }, // right arm
  { t: 'rect', x: 94, y: 184, w: 24, h: 152, r: 11 }, // left leg
  { t: 'rect', x: 122, y: 184, w: 24, h: 152, r: 11 }, // right leg
]

const FRONT: Record<string, Shape[]> = {
  shoulders: [
    { t: 'ellipse', cx: 84, cy: 67, rx: 14, ry: 12 },
    { t: 'ellipse', cx: 156, cy: 67, rx: 14, ry: 12 },
  ],
  chest: [
    { t: 'rect', x: 90, y: 68, w: 28, h: 24, r: 8 },
    { t: 'rect', x: 122, y: 68, w: 28, h: 24, r: 8 },
  ],
  abdominals: [{ t: 'rect', x: 104, y: 98, w: 32, h: 52, r: 8 }],
  biceps: [
    { t: 'rect', x: 60, y: 72, w: 17, h: 40, r: 8 },
    { t: 'rect', x: 163, y: 72, w: 17, h: 40, r: 8 },
  ],
  forearms: [
    { t: 'rect', x: 58, y: 116, w: 17, h: 44, r: 8 },
    { t: 'rect', x: 165, y: 116, w: 17, h: 44, r: 8 },
  ],
  quadriceps: [
    { t: 'rect', x: 96, y: 192, w: 22, h: 84, r: 9 },
    { t: 'rect', x: 122, y: 192, w: 22, h: 84, r: 9 },
  ],
  adductors: [{ t: 'rect', x: 116, y: 192, w: 8, h: 62, r: 4 }],
  abductors: [
    { t: 'rect', x: 90, y: 188, w: 8, h: 52, r: 4 },
    { t: 'rect', x: 142, y: 188, w: 8, h: 52, r: 4 },
  ],
}

const BACK: Record<string, Shape[]> = {
  traps: [{ t: 'rect', x: 102, y: 60, w: 36, h: 22, r: 8 }],
  shoulders: [
    { t: 'ellipse', cx: 84, cy: 70, rx: 14, ry: 12 },
    { t: 'ellipse', cx: 156, cy: 70, rx: 14, ry: 12 },
  ],
  upper_back: [{ t: 'rect', x: 96, y: 84, w: 48, h: 28, r: 8 }],
  lats: [
    { t: 'rect', x: 92, y: 100, w: 18, h: 42, r: 8 },
    { t: 'rect', x: 130, y: 100, w: 18, h: 42, r: 8 },
  ],
  lower_back: [{ t: 'rect', x: 104, y: 144, w: 32, h: 24, r: 8 }],
  triceps: [
    { t: 'rect', x: 60, y: 72, w: 17, h: 42, r: 8 },
    { t: 'rect', x: 163, y: 72, w: 17, h: 42, r: 8 },
  ],
  glutes: [
    { t: 'rect', x: 98, y: 170, w: 20, h: 30, r: 10 },
    { t: 'rect', x: 122, y: 170, w: 20, h: 30, r: 10 },
  ],
  hamstrings: [
    { t: 'rect', x: 96, y: 204, w: 22, h: 68, r: 9 },
    { t: 'rect', x: 122, y: 204, w: 22, h: 68, r: 9 },
  ],
  calves: [
    { t: 'rect', x: 97, y: 278, w: 20, h: 54, r: 9 },
    { t: 'rect', x: 123, y: 278, w: 20, h: 54, r: 9 },
  ],
}

function renderShape(s: Shape, key: number, fill: string, extra?: object) {
  if (s.t === 'ellipse') {
    return <ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} {...extra} />
  }
  return (
    <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} fill={fill} {...extra} />
  )
}

interface BodyMapProps {
  view: 'front' | 'back'
  color: string
  levelOf: (muscle: string) => Level
  onEnter: (muscle: string, rect: DOMRect) => void
  onLeave: () => void
}

export function BodyMap({ view, color, levelOf, onEnter, onLeave }: BodyMapProps) {
  const regions = view === 'front' ? FRONT : BACK
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 348" className="w-full max-w-[170px]" role="img" aria-label={`${view} muscle map`}>
        {SILHOUETTE.map((s, i) => renderShape(s, i, '#e7ebef'))}
        {Object.entries(regions).map(([muscle, shapes]) => (
          <g
            key={muscle}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => onEnter(muscle, e.currentTarget.getBoundingClientRect())}
            onMouseLeave={onLeave}
          >
            {shapes.map((s, i) =>
              renderShape(s, i, cellColor(color, levelOf(muscle)), {
                stroke: '#ffffff',
                strokeWidth: 0.75,
              }),
            )}
          </g>
        ))}
      </svg>
      <div className="text-[11px] font-medium text-[#656d76]">
        {view === 'front' ? 'Front' : 'Back'}
      </div>
    </div>
  )
}
