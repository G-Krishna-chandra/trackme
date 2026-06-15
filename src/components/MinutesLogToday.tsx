import { useState } from 'react'
import type { Entry } from '../types'
import { formatLong } from '../lib/date'

interface MinutesLogTodayProps {
  today: string
  unit: string
  entry: Entry | undefined
  onSave: (date: string, value: number, note: string) => void
}

/** "Log today" control for a plain value-per-day habit (minutes, etc.). */
export function MinutesLogToday({ today, unit, entry, onSave }: MinutesLogTodayProps) {
  const [value, setValue] = useState(
    entry && entry.value > 0 ? String(entry.value) : '',
  )
  const [note, setNote] = useState(entry?.note ?? '')

  const submit = () => {
    onSave(today, value.trim() === '' ? 0 : Number(value), note)
  }

  const label = unit.charAt(0).toUpperCase() + unit.slice(1)

  return (
    <div className="rounded-lg border border-[#d0d7de] bg-white p-4">
      <div className="mb-3 text-[13px] font-semibold text-[#1f2328]">
        Log today{' '}
        <span className="font-normal text-[#656d76]">· {formatLong(today)}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:w-32">
          <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
            {label}
          </label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="0"
            className="w-full rounded-md border border-[#d0d7de] px-2 py-1.5 text-[14px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
            Note <span className="font-normal text-[#8c959f]">(optional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. what you worked on"
            className="w-full rounded-md border border-[#d0d7de] px-2 py-1.5 text-[14px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          className="rounded-md bg-[#1f883d] px-4 py-1.5 text-[14px] font-semibold text-white hover:bg-[#1a7f37]"
        >
          Save
        </button>
      </div>
    </div>
  )
}
