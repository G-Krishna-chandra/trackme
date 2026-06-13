import type { WeekTotal } from '../lib/stats'
import { formatShort } from '../lib/date'

interface SparklineProps {
  data: WeekTotal[]
  unit: string
}

const W = 720
const H = 100
const PAD_X = 6
const PAD_TOP = 12
const PAD_BOTTOM = 10

export function Sparkline({ data, unit }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center text-[13px] text-[#8c959f]">
        Not enough data yet — log a few more weeks to see the trend.
      </div>
    )
  }

  const totals = data.map((d) => d.total)
  const max = Math.max(...totals, 1)
  const n = data.length
  const innerW = W - 2 * PAD_X
  const innerH = H - PAD_TOP - PAD_BOTTOM
  const baseY = PAD_TOP + innerH

  const x = (i: number) => PAD_X + (i * innerW) / (n - 1)
  const y = (v: number) => PAD_TOP + innerH * (1 - v / max)

  const pts = data.map((d, i) => [x(i), y(d.total)] as const)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const area = `M ${x(0)} ${baseY} ${pts
    .map((p) => `L ${p[0]} ${p[1]}`)
    .join(' ')} L ${x(n - 1)} ${baseY} Z`

  const last = pts[n - 1]
  const peak = Math.max(...totals)

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label="Weekly total pages over time"
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#40c463" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#40c463" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={PAD_X}
          y1={baseY}
          x2={W - PAD_X}
          y2={baseY}
          stroke="#eaeef2"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <path d={area} fill="url(#spark-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#1f883d"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last[0]} cy={last[1]} r={3} fill="#1f883d" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-[#8c959f]">
        <span>Week of {formatShort(data[0].weekStart)}</span>
        <span>
          Peak {peak.toLocaleString()} {unit}/wk
        </span>
        <span>Week of {formatShort(data[n - 1].weekStart)}</span>
      </div>
    </div>
  )
}
