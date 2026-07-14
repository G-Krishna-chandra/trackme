import { useRef, useState } from 'react'
import { todayISO } from '../lib/date'
import { exportAll, parseBackup, importAll, hasAnyData } from '../lib/backup'
import { capabilities, DEPLOY_TARGET } from '../lib/capabilities'

export function DataView() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const doExport = () => {
    const backup = exportAll()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trackme-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ kind: 'ok', text: 'Exported. Keep this file safe — it is your only backup.' })
  }

  const onFile = async (file: File) => {
    setMessage(null)
    const text = await file.text()
    const result = parseBackup(text)
    if (!result.ok) {
      setMessage({ kind: 'err', text: result.error })
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const count = Object.keys(result.backup.data).length
    const ok = window.confirm(
      `Import will REPLACE all TrackMe data in this browser with the backup ` +
        `(${count} data set${count === 1 ? '' : 's'}, exported ${result.backup.exportedAt.slice(0, 10)}). ` +
        `This cannot be undone. Continue?`,
    )
    if (fileRef.current) fileRef.current.value = ''
    if (!ok) return
    importAll(result.backup)
    // Reload so every habit view re-reads the restored data from localStorage.
    window.location.reload()
  }

  return (
    <>
      <p className="mb-6 mt-1 text-[14px] text-[#656d76]">
        Your data lives only in this browser. Back it up here — with no account,
        this file is your only copy.
      </p>

      <section className="mb-6 rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="mb-1 text-[14px] font-semibold text-[#1f2328]">
          Backup &amp; restore
        </h2>
        <p className="mb-3 text-[12px] text-[#656d76]">
          Export downloads one JSON file with every habit's data (reading, gym,
          guitar, chess, cardistry, plus caches &amp; settings). Import{' '}
          <strong>replaces</strong> all current data in this browser.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={doExport}
            className="rounded-md bg-[#1f883d] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a7f37]"
          >
            Export all data
          </button>
          <label className="cursor-pointer rounded-md border border-[#d0d7de] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1f2328] hover:bg-[#f3f4f6]">
            Import data…
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }}
            />
          </label>
          {!hasAnyData() ? (
            <span className="text-[12px] text-[#8c959f]">No data logged yet.</span>
          ) : null}
        </div>
        {message ? (
          <div
            className={`mt-2 text-[12px] ${message.kind === 'ok' ? 'text-[#1a7f37]' : 'text-[#cf222e]'}`}
          >
            {message.text}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="mb-1 text-[14px] font-semibold text-[#1f2328]">Privacy</h2>
        <ul className="ml-4 list-disc space-y-1 text-[12px] text-[#656d76]">
          <li>
            All your habit data is stored only in this browser's localStorage.
            There is no account, no server storing your data, and no analytics or
            tracking.
          </li>
          <li>
            A few features make outbound requests you should know about: book
            search sends your query to Google Books and Open Library; cover
            images load from Open Library{capabilities.longitoodCovers ? ' and a cover proxy' : ''};
            chess sync fetches your public games from Chess.com.
            {capabilities.hevyApiSync
              ? ' Hevy sync goes through this machine’s local dev proxy (your key stays server-side).'
              : ''}
          </li>
          <li>Clearing this browser's site data erases everything — export first.</li>
        </ul>
        <p className="mt-2 text-[11px] text-[#8c959f]">Build: {DEPLOY_TARGET}</p>
      </section>
    </>
  )
}
