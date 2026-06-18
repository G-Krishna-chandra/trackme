import { useMemo, useState } from 'react'
import { useGym } from '../store/useGym'
import { todayISO, formatLong } from '../lib/date'
import {
  aggregateByDate,
  bestVolumeByType,
  gymWeeklyTotals,
  sessionsThisWeek,
  volumeThisWeek,
} from '../lib/gym'
import { GymSessionForm } from './GymSessionForm'
import { GymStats } from './GymStats'
import { GymGrid } from './GymGrid'
import { GymSync } from './GymSync'
import { Sparkline } from './Sparkline'

export function GymView() {
  const today = todayISO()
  const {
    habit,
    sessions,
    settings,
    rememberedNames,
    saveSession,
    updateSession,
    deleteSessionById,
    updateSettings,
    runHevySync,
  } = useGym()

  const byDate = useMemo(
    () => aggregateByDate(sessions, settings.bodyweight),
    [sessions, settings.bodyweight],
  )
  const stats = useMemo(
    () => ({
      sessionsWk: sessionsThisWeek(sessions, today),
      volumeWk: volumeThisWeek(sessions, settings.bodyweight, today),
      best: bestVolumeByType(sessions, settings.bodyweight),
      weekly: gymWeeklyTotals(sessions, settings.bodyweight, today),
    }),
    [sessions, settings.bodyweight, today],
  )

  const [logDate, setLogDate] = useState(today)
  const [bw, setBw] = useState(String(settings.bodyweight))

  if (!habit) {
    return <div className="p-8 text-[#1f2328]">No habit configured.</div>
  }

  const logSession = byDate.get(logDate)?.primary
  const logSig = logSession
    ? `${logSession.id}:${logSession.type}:${logSession.exercises.length}:${logSession.exercises.reduce((n, e) => n + e.sets.length, 0)}:${logSession.note ?? ''}`
    : 'new'

  const onBwChange = (v: string) => {
    setBw(v)
    const n = Number(v)
    if (v.trim() !== '' && Number.isFinite(n) && n >= 0) {
      updateSettings({ ...settings, bodyweight: n })
    }
  }

  return (
    <>
      <p className="mb-4 mt-1 text-[14px] text-[#656d76]">
        {habit.name} · per-session working volume (sets × reps × weight). Each
        day is shaded against your recent days <em>of the same training type</em>
        , so a leg day never washes out a push day — staying dark means beating
        recent&#8209;you on that type.
      </p>

      {/* Settings: bodyweight + unit */}
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-[#d0d7de] bg-white p-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
            Bodyweight
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            value={bw}
            onChange={(e) => onBwChange(e.target.value)}
            className="w-24 rounded-md border border-[#d0d7de] px-2 py-1.5 text-[14px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
            Unit
          </label>
          <div className="flex gap-1.5">
            {(['kg', 'lbs'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => updateSettings({ ...settings, weightUnit: u })}
                className={`rounded-md border px-3 py-1.5 text-[13px] font-medium ${
                  settings.weightUnit === u
                    ? 'border-[#8250df] bg-[#8250df] text-white'
                    : 'border-[#d0d7de] bg-white text-[#1f2328] hover:bg-[#f3f4f6]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <p className="flex-1 text-[12px] text-[#8c959f]">
          Used for bodyweight-exercise volume (pullups, dips): each rep counts as
          bodyweight + any added load.
        </p>
      </div>

      {/* Live sync from the Hevy API (manual logger below stays a fallback) */}
      <GymSync lastSyncedAt={settings.lastSyncedAt} onSync={runHevySync} />

      {/* Log a session */}
      <div className="mb-6 rounded-lg border border-[#d0d7de] bg-white p-4">
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
            Date
          </label>
          <input
            type="date"
            value={logDate}
            max={today}
            onChange={(e) => setLogDate(e.target.value || today)}
            className="rounded-md border border-[#d0d7de] px-2 py-1.5 text-[14px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
          {logDate !== today ? (
            <span className="ml-2 text-[12px] text-[#8c959f]">
              {formatLong(logDate)}
            </span>
          ) : null}
        </div>
        <GymSessionForm
          key={`inline:${logDate}:${logSig}`}
          date={logDate}
          initial={logSession}
          weightUnit={settings.weightUnit}
          bodyweight={settings.bodyweight}
          rememberedNames={rememberedNames}
          variant="inline"
          onSave={(date, type, exercises, note) =>
            logSession
              ? updateSession(logSession, type, exercises, note)
              : saveSession(date, type, exercises, note)
          }
          onDelete={() => logSession && deleteSessionById(logSession.id)}
        />
      </div>

      <div className="mb-6">
        <GymStats
          sessionsThisWeek={stats.sessionsWk}
          volumeThisWeek={stats.volumeWk}
          bestByType={stats.best}
          weightUnit={settings.weightUnit}
        />
      </div>

      <section className="mb-6 rounded-lg border border-[#d0d7de] bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold text-[#1f2328]">
            The last 53 weeks
          </h2>
          <span className="text-[12px] text-[#8c959f]">
            Click any day to log or edit · hover for volume &amp; type
          </span>
        </div>
        <GymGrid
          color={habit.color}
          today={today}
          sessions={sessions}
          bodyweight={settings.bodyweight}
          weightUnit={settings.weightUnit}
          rememberedNames={rememberedNames}
          onCreateSession={saveSession}
          onUpdateSession={updateSession}
          onDeleteSession={(s) => deleteSessionById(s.id)}
        />
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold text-[#1f2328]">
            Weekly volume
          </h2>
          <span className="text-[12px] text-[#8c959f]">
            Absolute long-run trend
          </span>
        </div>
        <Sparkline
          data={stats.weekly}
          unit={settings.weightUnit}
          color={habit.color}
        />
      </section>
    </>
  )
}
