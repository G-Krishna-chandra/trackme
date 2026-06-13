interface HeaderStatsProps {
  currentStreak: number
  longestStreak: number
  total: number
  thisWeek: number
  unit: string
}

interface StatProps {
  label: string
  value: string
  hint: string
}

function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="flex-1 rounded-lg border border-[#d0d7de] bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#656d76]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[#1f2328]">
        {value}
      </div>
      <div className="text-[11px] text-[#8c959f]">{hint}</div>
    </div>
  )
}

export function HeaderStats({
  currentStreak,
  longestStreak,
  total,
  thisWeek,
  unit,
}: HeaderStatsProps) {
  const days = (n: number) => (n === 1 ? 'day' : 'days')
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Stat
        label="Current streak"
        value={`${currentStreak}`}
        hint={`${days(currentStreak)} in a row`}
      />
      <Stat
        label="Longest streak"
        value={`${longestStreak}`}
        hint={`${days(longestStreak)} best`}
      />
      <Stat
        label={`Total ${unit}`}
        value={total.toLocaleString()}
        hint="all time"
      />
      <Stat
        label={`${unit.charAt(0).toUpperCase() + unit.slice(1)} this week`}
        value={thisWeek.toLocaleString()}
        hint="since Sunday"
      />
    </div>
  )
}
