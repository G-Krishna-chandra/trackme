import { useId, useState } from 'react'
import type { GymExercise, GymSession, GymType } from '../types'
import { GYM_TYPES, GYM_TYPE_LABELS, volumeOfExercises } from '../lib/gym'
import { formatLong } from '../lib/date'

// Form-internal shapes keep reps/weight as strings while editing (so a field can
// be empty); they're parsed to numbers on save.
interface FormSet {
  reps: string
  weight: string
  warmup: boolean
}
interface FormExercise {
  name: string
  isBodyweight: boolean
  sets: FormSet[]
}

interface GymSessionFormProps {
  date: string
  /** Existing session for this date, to prefill (view/edit). */
  initial: GymSession | undefined
  weightUnit: 'kg' | 'lbs'
  bodyweight: number
  rememberedNames: string[]
  variant: 'inline' | 'modal'
  onSave: (
    date: string,
    type: GymType,
    exercises: GymExercise[],
    note: string,
  ) => void
  onDelete?: (date: string) => void
  onCancel?: () => void
}

function blankSet(): FormSet {
  return { reps: '', weight: '', warmup: false }
}
function blankExercise(): FormExercise {
  return { name: '', isBodyweight: false, sets: [blankSet()] }
}

function toFormExercises(session: GymSession | undefined): FormExercise[] {
  if (!session || session.exercises.length === 0) return [blankExercise()]
  return session.exercises.map((ex) => ({
    name: ex.name,
    isBodyweight: ex.isBodyweight,
    sets:
      ex.sets.length > 0
        ? ex.sets.map((s) => ({
            reps: String(s.reps),
            weight: String(s.weight),
            warmup: s.warmup,
          }))
        : [blankSet()],
  }))
}

export function GymSessionForm({
  date,
  initial,
  weightUnit,
  bodyweight,
  rememberedNames,
  variant,
  onSave,
  onDelete,
  onCancel,
}: GymSessionFormProps) {
  const datalistId = useId()
  const [type, setType] = useState<GymType>(initial?.type ?? 'push')
  const [exercises, setExercises] = useState<FormExercise[]>(() =>
    toFormExercises(initial),
  )
  const [note, setNote] = useState(initial?.note ?? '')

  const updateExercise = (i: number, patch: Partial<FormExercise>) => {
    setExercises((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  }
  const updateSet = (ei: number, si: number, patch: Partial<FormSet>) => {
    setExercises((xs) =>
      xs.map((x, k) =>
        k === ei
          ? { ...x, sets: x.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }
          : x,
      ),
    )
  }
  const addSet = (ei: number) => {
    setExercises((xs) =>
      xs.map((x, k) => {
        if (k !== ei) return x
        const prev = x.sets[x.sets.length - 1]
        // "Add set" copies the previous set's reps & weight (straight sets).
        const next: FormSet = {
          reps: prev?.reps ?? '',
          weight: prev?.weight ?? '',
          warmup: false,
        }
        return { ...x, sets: [...x.sets, next] }
      }),
    )
  }
  const removeSet = (ei: number, si: number) => {
    setExercises((xs) =>
      xs.map((x, k) =>
        k === ei ? { ...x, sets: x.sets.filter((_, j) => j !== si) } : x,
      ),
    )
  }
  const addExercise = () => setExercises((xs) => [...xs, blankExercise()])
  const removeExercise = (ei: number) =>
    setExercises((xs) => xs.filter((_, k) => k !== ei))

  // Live working volume preview (parsed, warmups excluded).
  const liveVolume = volumeOfExercises(
    exercises.map((x) => ({
      name: x.name,
      isBodyweight: x.isBodyweight,
      sets: x.sets.map((s) => ({
        reps: Math.max(0, Math.floor(Number(s.reps) || 0)),
        weight: Math.max(0, Number(s.weight) || 0),
        warmup: s.warmup,
      })),
    })),
    bodyweight,
  )

  const submit = () => {
    const built: GymExercise[] = exercises
      .map((x) => ({
        name: x.name.trim(),
        isBodyweight: x.isBodyweight,
        sets: x.sets
          .map((s) => ({
            reps: Math.max(0, Math.floor(Number(s.reps) || 0)),
            weight: Math.max(0, Number(s.weight) || 0),
            warmup: s.warmup,
          }))
          .filter((s) => s.reps > 0),
      }))
      .filter((x) => x.name !== '' && x.sets.length > 0)
    onSave(date, type, built, note)
  }

  const inputCls =
    'rounded-md border border-[#d0d7de] px-2 py-1 text-[13px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]'

  return (
    <div>
      <datalist id={datalistId}>
        {rememberedNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-[#1f2328]">
          {variant === 'inline' ? 'Log a session' : 'Edit session'}
          <span className="ml-1 font-normal text-[#656d76]">
            · {formatLong(date)}
          </span>
        </div>
        {variant === 'modal' && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded px-1.5 py-0.5 text-[#656d76] hover:bg-[#eaeef2]"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* Training type */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {GYM_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-md border px-2.5 py-1 text-[12px] font-medium ${
              type === t
                ? 'border-[#8250df] bg-[#8250df] text-white'
                : 'border-[#d0d7de] bg-white text-[#1f2328] hover:bg-[#f3f4f6]'
            }`}
          >
            {GYM_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Exercises */}
      <div className="flex flex-col gap-3">
        {exercises.map((ex, ei) => (
          <div
            key={ei}
            className="rounded-md border border-[#d0d7de] bg-[#f6f8fa] p-2.5"
          >
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                list={datalistId}
                value={ex.name}
                onChange={(e) => updateExercise(ei, { name: e.target.value })}
                placeholder="Exercise name"
                className={`${inputCls} min-w-0 flex-1 bg-white`}
              />
              <label className="flex shrink-0 items-center gap-1 text-[12px] text-[#656d76]">
                <input
                  type="checkbox"
                  checked={ex.isBodyweight}
                  onChange={(e) =>
                    updateExercise(ei, { isBodyweight: e.target.checked })
                  }
                />
                Bodyweight
              </label>
              <button
                type="button"
                onClick={() => removeExercise(ei)}
                aria-label="Remove exercise"
                className="shrink-0 rounded px-1.5 py-0.5 text-[#656d76] hover:bg-[#eaeef2] hover:text-[#cf222e]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {ex.sets.map((s, si) => (
                <div key={si} className="flex items-center gap-2 text-[12px]">
                  <span className="w-4 shrink-0 text-right text-[#8c959f]">
                    {si + 1}
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={s.reps}
                    onChange={(e) => updateSet(ei, si, { reps: e.target.value })}
                    placeholder="reps"
                    className={`${inputCls} w-16 bg-white`}
                  />
                  <span className="text-[#8c959f]">×</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    inputMode="decimal"
                    value={s.weight}
                    onChange={(e) =>
                      updateSet(ei, si, { weight: e.target.value })
                    }
                    placeholder={ex.isBodyweight ? '+kg' : 'weight'}
                    className={`${inputCls} w-20 bg-white`}
                  />
                  <span className="w-6 text-[#8c959f]">{weightUnit}</span>
                  <label className="flex items-center gap-1 text-[#656d76]">
                    <input
                      type="checkbox"
                      checked={s.warmup}
                      onChange={(e) =>
                        updateSet(ei, si, { warmup: e.target.checked })
                      }
                    />
                    warmup
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSet(ei, si)}
                    aria-label="Remove set"
                    className="ml-auto rounded px-1.5 text-[#656d76] hover:text-[#cf222e]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addSet(ei)}
              className="mt-2 rounded-md border border-[#d0d7de] bg-white px-2 py-1 text-[12px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]"
            >
              + Add set
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addExercise}
        className="mt-3 rounded-md border border-[#d0d7de] bg-white px-2.5 py-1 text-[12px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]"
      >
        + Add exercise
      </button>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
          Note <span className="font-normal text-[#8c959f]">(optional)</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. felt strong, tweaked shoulder"
          className={`${inputCls} w-full`}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-[12px] text-[#656d76]">
          Working volume:{' '}
          <span className="font-semibold tabular-nums text-[#1f2328]">
            {Math.round(liveVolume).toLocaleString()} {weightUnit}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {initial && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(date)}
              className="rounded-md px-2 py-1 text-[12px] font-medium text-[#cf222e] hover:bg-[#cf222e]/10"
            >
              Delete
            </button>
          ) : null}
          {variant === 'modal' && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-[#d0d7de] px-2.5 py-1 text-[12px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={submit}
            className="rounded-md bg-[#1f883d] px-3 py-1 text-[13px] font-semibold text-white hover:bg-[#1a7f37]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
