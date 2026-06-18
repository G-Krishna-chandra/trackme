import { rampFor } from '../lib/colors'
import { formatShort } from '../lib/date'

interface RatingLineProps {
  points: { date: string; rating: number }[]
  /** Habit color key for the stroke. */
  color: string
  label: string
}

const W = 720
const H = 120
const PAD_X = 8
const PAD_TOP = 16
const PAD_BOTTOM = 14

/**
 * Rating-over-time line — the absolute "Elo climb", deliberately separate from
 * the relative activity grid. Scaled to [min, max] of the ratings (not zero-
 * based), since what matters is the trajectory, not the absolute floor.
 */
export function RatingLine({ points, color, label }: RatingLineProps) {
  if (points.length < 2) {
    return (
      <div className="flex h-28 items-center justify-center text-[13px] text-[#8c959f]">
        Not enough rated {label} games yet to plot a rating line.
      </div>
    )
  }

  const ratings = points.map((p) => p.rating)
  const min = Math.min(...ratings)
  const max = Math.max(...ratings)
  const span = Math.max(max - min, 1)
  const n = points.length
  const innerW = W - 2 * PAD_X
  const innerH = H - PAD_TOP - PAD_BOTTOM

  const x = (i: number) => PAD_X + (n === 1 ? 0 : (i * innerW) / (n - 1))
  const y = (r: number) => PAD_TOP + innerH * (1 - (r - min) / span)

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.rating)}`)
    .join(' ')
  const last = points[n - 1]
  const stroke = rampFor(color)[4]

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`${label} rating over time`}
      >
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={x(n - 1)} cy={y(last.rating)} r={3} fill={stroke} />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-[#8c959f]">
        <span>
          {formatShort(points[0].date)} · low {min}
        </span>
        <span className="font-semibold text-[#1f2328]">
          {last.rating} now · peak {max}
        </span>
        <span>{formatShort(last.date)}</span>
      </div>
    </div>
  )
}
