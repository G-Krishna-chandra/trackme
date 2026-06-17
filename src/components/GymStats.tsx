import type { ReactNode } from 'react'
import type { GymType } from '../types'
import { GYM_TYPE_LABELS, GYM_TYPES } from '../lib/gym'

interface GymStatsProps {
  sessionsThisWeek: number
  volumeThisWeek: number
  bestByType: Record<GymType, number>
  weightUnit: 'kg' | 'lbs'
}

function StatCard({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex-1 rounded-lg border border-[#d0d7de] bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#656d76]">
        {label}
      </div>
      {children}
    </div>
  )
}

export function GymStats({
  sessionsThisWeek,
  volumeThisWeek,
  bestByType,
  weightUnit,
}: GymStatsProps) {
  const typesWithData = GYM_TYPES.filter((t) => bestByType[t] > 0)

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <StatCard label="Sessions this week">
        <div className="mt-1 text-2xl font-semibold tabular-nums text-[#1f2328]">
          {sessionsThisWeek}
        </div>
        <div className="text-[11px] text-[#8c959f]">since Sunday</div>
      </StatCard>

      <StatCard label="Volume this week">
        <div className="mt-1 text-2xl font-semibold tabular-nums text-[#1f2328]">
          {Math.round(volumeThisWeek).toLocaleString()}
        </div>
        <div className="text-[11px] text-[#8c959f]">{weightUnit} · since Sunday</div>
      </StatCard>

      <StatCard label="Best volume by type">
        {typesWithData.length === 0 ? (
          <div className="mt-1 text-[13px] text-[#8c959f]">No sessions yet</div>
        ) : (
          <div className="mt-1 flex flex-col gap-0.5">
            {typesWithData.map((t) => (
              <div
                key={t}
                className="flex items-baseline justify-between text-[12px]"
              >
                <span className="text-[#656d76]">{GYM_TYPE_LABELS[t]}</span>
                <span className="font-semibold tabular-nums text-[#1f2328]">
                  {Math.round(bestByType[t]).toLocaleString()} {weightUnit}
                </span>
              </div>
            ))}
          </div>
        )}
      </StatCard>
    </div>
  )
}
