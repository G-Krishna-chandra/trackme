import { useMemo } from 'react'
import { useHabit } from '../store/useHabit'
import { PRIMARY_HABIT_ID } from '../data/seed'
import {
  currentStreak,
  indexByDate,
  longestStreak,
  totalValue,
  valueThisWeek,
  weeklyTotals,
} from '../lib/stats'
import { todayISO } from '../lib/date'
import { LogToday } from './LogToday'
import { HeaderStats } from './HeaderStats'
import { ContributionGrid } from './ContributionGrid'
import { Sparkline } from './Sparkline'
import { BookChip } from './BookChip'

/** The Reading habit view — unchanged behavior, lifted out of App so a habit
 *  switcher can sit above it. */
export function ReadingView() {
  const today = todayISO()
  const {
    habit,
    entries,
    booksById,
    activeBook,
    setEntry,
    clearEntry,
    selectBook,
  } = useHabit(PRIMARY_HABIT_ID)

  const byDate = useMemo(() => indexByDate(entries), [entries])
  const stats = useMemo(
    () => ({
      current: currentStreak(byDate, today),
      longest: longestStreak(entries, today),
      total: totalValue(entries),
      week: valueThisWeek(byDate, today),
      weekly: weeklyTotals(entries, today),
    }),
    [byDate, entries, today],
  )

  if (!habit) {
    return <div className="p-8 text-[#1f2328]">No habit configured.</div>
  }

  const todayEntry = byDate.get(today)
  const todayBook = todayEntry?.bookId
    ? booksById.get(todayEntry.bookId)
    : activeBook

  return (
    <>
      <p className="mb-6 mt-1 text-[14px] text-[#656d76]">
        {habit.name} · measured in {habit.unit} per day. Each cell is shaded
        against your last 6 weeks of active days — staying dark means beating
        recent&#8209;you, not hitting a fixed goal.
      </p>

      {activeBook ? (
        <div className="mb-3">
          <BookChip book={activeBook} label="Currently reading" />
        </div>
      ) : null}

      <div className="mb-4">
        <LogToday
          key={`${today}:${todayEntry?.value ?? ''}:${todayEntry?.note ?? ''}:${todayEntry?.bookId ?? ''}`}
          today={today}
          unit={habit.unit}
          entry={todayEntry}
          initialBook={todayBook}
          onSelectBook={selectBook}
          onSave={setEntry}
        />
      </div>

      <div className="mb-6">
        <HeaderStats
          currentStreak={stats.current}
          longestStreak={stats.longest}
          total={stats.total}
          thisWeek={stats.week}
          unit={habit.unit}
        />
      </div>

      <section className="mb-6 rounded-lg border border-[#d0d7de] bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold text-[#1f2328]">
            The last 53 weeks
          </h2>
          <span className="text-[12px] text-[#8c959f]">
            Click any day to log or edit · hover for the raw count
          </span>
        </div>
        <ContributionGrid
          habit={habit}
          entriesByDate={byDate}
          booksById={booksById}
          activeBook={activeBook}
          currentStreak={stats.current}
          today={today}
          onSetEntry={setEntry}
          onClearEntry={clearEntry}
          onSelectBook={selectBook}
        />
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold text-[#1f2328]">
            Weekly {habit.unit}
          </h2>
          <span className="text-[12px] text-[#8c959f]">
            Absolute long-run trend
          </span>
        </div>
        <Sparkline data={stats.weekly} unit={habit.unit} />
      </section>
    </>
  )
}
