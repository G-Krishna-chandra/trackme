import { useEffect, useRef, useState } from 'react'
import type { Entry } from '../types'
import { formatLong } from '../lib/date'

interface MinutesCellEditorProps {
  date: string
  unit: string
  entry: Entry | undefined
  /** Anchor rect (viewport coords) of the clicked cell. */
  rect: DOMRect
  onSave: (date: string, value: number, note: string) => void
  onClear: (date: string) => void
  onClose: () => void
}

const CARD_W = 232
const EST_H = 188

/** Small popover to set/edit one day's value + note. Generic over the unit. */
export function MinutesCellEditor({
  date,
  unit,
  entry,
  rect,
  onSave,
  onClear,
  onClose,
}: MinutesCellEditorProps) {
  const [value, setValue] = useState(
    entry && entry.value > 0 ? String(entry.value) : '',
  )
  const [note, setNote] = useState(entry?.note ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const placeAbove = rect.bottom + 10 + EST_H > window.innerHeight
  const top = placeAbove ? rect.top - 10 : rect.bottom + 10
  const rawLeft = rect.left + rect.width / 2 - CARD_W / 2
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - CARD_W - 8))

  const submit = () => {
    onSave(date, value.trim() === '' ? 0 : Number(value), note)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-[232px] rounded-lg border border-[#d0d7de] bg-white p-3 shadow-xl"
        style={{
          top,
          left,
          transform: placeAbove ? 'translateY(-100%)' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-[13px] font-semibold text-[#1f2328]">
          {formatLong(date)}
        </div>

        <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
          {unit.charAt(0).toUpperCase() + unit.slice(1)}
        </label>
        <input
          ref={inputRef}
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="0"
          className="mb-2 w-full rounded-md border border-[#d0d7de] px-2 py-1 text-[13px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
        />

        <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
          Note <span className="font-normal text-[#8c959f]">(optional)</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. what you worked on"
          className="mb-3 w-full rounded-md border border-[#d0d7de] px-2 py-1 text-[13px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
        />

        <div className="flex items-center justify-between gap-2">
          {entry ? (
            <button
              type="button"
              onClick={() => onClear(date)}
              className="rounded-md px-2 py-1 text-[12px] font-medium text-[#cf222e] hover:bg-[#cf222e]/10"
            >
              Clear
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#d0d7de] px-2.5 py-1 text-[12px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-[#1f883d] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-[#1a7f37]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
