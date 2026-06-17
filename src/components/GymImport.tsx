import { useMemo, useRef, useState } from 'react'
import type { GymSession, GymType } from '../types'
import { GYM_TYPES, GYM_TYPE_LABELS } from '../lib/gym'
import { formatShort } from '../lib/date'
import {
  convertSessionsUnit,
  countConflicts,
  parseHevyExport,
  type HevyParseResult,
  type WeightUnit,
} from '../lib/hevyImport'

interface GymImportProps {
  existingSessions: GymSession[]
  currentUnit: WeightUnit
  /** Commit imported sessions; setUnit is provided only when adopting it. */
  onImport: (sessions: GymSession[], setUnit?: WeightUnit) => void
}

type Phase = 'idle' | 'parsing' | 'preview' | 'error'

interface Plan {
  detectedUnit: WeightUnit
  targetUnit: WeightUnit
  willSetUnit: boolean
}

function setCountOf(s: GymSession): number {
  return s.exercises.reduce((n, e) => n + e.sets.length, 0)
}

export function GymImport({ existingSessions, currentUnit, onImport }: GymImportProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<HevyParseResult | null>(null)
  const [sessions, setSessions] = useState<GymSession[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const conflicts = useMemo(
    () => countConflicts(sessions, existingSessions),
    [sessions, existingSessions],
  )

  const reset = () => {
    setPhase('idle')
    setResult(null)
    setSessions([])
    setPlan(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onFile = async (file: File) => {
    setPhase('parsing')
    let text = ''
    try {
      text = await file.text()
    } catch {
      setResult({
        ...EMPTY_ERR,
        error: 'Could not read the file.',
      })
      setPhase('error')
      return
    }
    const res = parseHevyExport(text)
    if (!res.ok) {
      setResult(res)
      setPhase('error')
      return
    }
    const empty = existingSessions.length === 0
    const targetUnit: WeightUnit = empty ? res.detectedUnit : currentUnit
    const willSetUnit = empty && res.detectedUnit !== currentUnit
    setResult(res)
    setSessions(convertSessionsUnit(res.sessions, res.detectedUnit, targetUnit))
    setPlan({ detectedUnit: res.detectedUnit, targetUnit, willSetUnit })
    setPhase('preview')
  }

  const setType = (i: number, t: GymType) =>
    setSessions((ss) => ss.map((s, k) => (k === i ? { ...s, type: t } : s)))

  const confirm = () => {
    onImport(sessions, plan?.willSetUnit ? plan.detectedUnit : undefined)
    reset()
  }

  return (
    <div className="mb-6 rounded-lg border border-[#d0d7de] bg-white p-4">
      <div className="mb-1 text-[13px] font-semibold text-[#1f2328]">
        Import from Hevy
      </div>
      <p className="mb-3 text-[12px] text-[#656d76]">
        Hevy → Profile → Settings → Export &amp; Import Data → Export Workouts
        (it's emailed to you). Pick the <code>.csv</code> or <code>.tsv</code>{' '}
        file below — it's parsed in your browser and never uploaded anywhere.
      </p>

      {phase === 'idle' || phase === 'parsing' ? (
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-md border border-[#d0d7de] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]">
            Choose file…
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }}
            />
          </label>
          {phase === 'parsing' ? (
            <span className="text-[13px] text-[#656d76]">Parsing…</span>
          ) : null}
        </div>
      ) : null}

      {phase === 'error' && result ? (
        <div>
          <div className="mb-2 text-[13px] font-medium text-[#cf222e]">
            {result.error}
          </div>
          {result.headerLine ? (
            <div className="mb-2">
              <div className="text-[11px] font-medium text-[#656d76]">
                Header row:
              </div>
              <pre className="overflow-x-auto rounded bg-[#f6f8fa] p-2 text-[11px] text-[#1f2328]">
                {result.headerLine}
              </pre>
              {result.sampleLine ? (
                <>
                  <div className="text-[11px] font-medium text-[#656d76]">
                    Sample row:
                  </div>
                  <pre className="overflow-x-auto rounded bg-[#f6f8fa] p-2 text-[11px] text-[#1f2328]">
                    {result.sampleLine}
                  </pre>
                </>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-[#d0d7de] px-2.5 py-1 text-[12px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]"
          >
            Try another file
          </button>
        </div>
      ) : null}

      {phase === 'preview' && result && plan ? (
        <div>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#1f2328]">
            <span>
              <strong>{sessions.length}</strong> session
              {sessions.length === 1 ? '' : 's'}
            </span>
            {result.dateFrom ? (
              <span className="text-[#656d76]">
                {formatShort(result.dateFrom)} – {formatShort(result.dateTo!)}
              </span>
            ) : null}
            <span className="text-[#656d76]">{result.totalSets} sets</span>
            <span className="text-[#656d76]">
              unit: {plan.detectedUnit}
              {plan.willSetUnit
                ? ` (your unit will switch to ${plan.detectedUnit})`
                : plan.detectedUnit !== plan.targetUnit
                  ? ` → converted to your ${plan.targetUnit}`
                  : ''}
            </span>
            <span className="text-[#656d76]">
              {result.bodyweightExerciseNames.length} bodyweight exercise
              {result.bodyweightExerciseNames.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#8c959f]">
            {conflicts > 0 ? (
              <span className="text-[#9a6700]">
                {conflicts} existing day{conflicts === 1 ? '' : 's'} will be
                replaced
              </span>
            ) : (
              <span>no existing days affected</span>
            )}
            {result.multiWorkoutDays > 0 ? (
              <span>
                {result.multiWorkoutDays} day
                {result.multiWorkoutDays === 1 ? '' : 's'} had multiple workouts
                (merged)
              </span>
            ) : null}
            {result.skippedNoReps > 0 ? (
              <span>{result.skippedNoReps} repless rows skipped</span>
            ) : null}
          </div>

          <p className="mb-2 text-[11px] text-[#8c959f]">
            Training type is guessed from the workout name — correct any below;
            you can also edit type and bodyweight per session later in the grid.
          </p>

          <div className="max-h-64 overflow-y-auto rounded-md border border-[#d0d7de]">
            {sessions.map((s, i) => (
              <div
                key={s.date}
                className="flex items-center gap-2 border-b border-[#eaeef2] px-2.5 py-1.5 text-[12px] last:border-b-0"
              >
                <span className="w-16 shrink-0 tabular-nums text-[#656d76]">
                  {formatShort(s.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[#1f2328]">
                  {result.titleByDate[s.date] ?? ''}
                </span>
                <span className="w-12 shrink-0 text-right text-[#8c959f]">
                  {setCountOf(s)} sets
                </span>
                <select
                  value={s.type}
                  onChange={(e) => setType(i, e.target.value as GymType)}
                  className="shrink-0 rounded-md border border-[#d0d7de] bg-white px-1.5 py-0.5 text-[12px] outline-none focus:border-[#0969da]"
                >
                  {GYM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {GYM_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-[#d0d7de] px-2.5 py-1 text-[12px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              className="rounded-md bg-[#1f883d] px-3 py-1 text-[13px] font-semibold text-white hover:bg-[#1a7f37]"
            >
              Import {sessions.length} session{sessions.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const EMPTY_ERR: HevyParseResult = {
  ok: false,
  sessions: [],
  detectedUnit: 'kg',
  totalSets: 0,
  skippedNoReps: 0,
  parseFailedRows: 0,
  multiWorkoutDays: 0,
  bodyweightExerciseNames: [],
  titleByDate: {},
  dateFrom: null,
  dateTo: null,
}
