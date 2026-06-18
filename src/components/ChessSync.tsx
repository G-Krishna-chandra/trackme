import { useRef, useState } from 'react'
import { formatLong } from '../lib/date'
import { ChessNotFoundError, type ChessSyncResult } from '../lib/chess'

interface ChessSyncProps {
  username: string
  lastSyncedAt?: string
  onSetUsername: (username: string) => void
  onSync: (
    onProgress: (done: number, total: number) => void,
    signal: AbortSignal,
  ) => Promise<ChessSyncResult>
}

type Phase = 'idle' | 'syncing' | 'done' | 'notfound' | 'empty' | 'error' | 'shape'

export function ChessSync({
  username,
  lastSyncedAt,
  onSetUsername,
  onSync,
}: ChessSyncProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [message, setMessage] = useState('')
  const [sample, setSample] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const sync = async () => {
    setPhase('syncing')
    setProgress({ done: 0, total: 0 })
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const result = await onSync(
        (done, total) => setProgress({ done, total }),
        ctrl.signal,
      )
      if (result.totalGames > 0 && result.days.length === 0) {
        setSample(JSON.stringify(result.sampleGame, null, 2))
        setPhase('shape')
        return
      }
      if (result.totalGames === 0) {
        setPhase('empty')
        return
      }
      setMessage(`Synced ${result.days.length} active days from ${result.totalGames} rated games.`)
      setPhase('done')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setPhase('idle')
        return
      }
      if (err instanceof ChessNotFoundError) {
        setPhase('notfound')
        return
      }
      setMessage((err as Error)?.message ?? 'Sync failed.')
      setPhase('error')
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-[#d0d7de] bg-white p-4">
      <div className="mb-1 text-[13px] font-semibold text-[#1f2328]">
        Sync from Chess.com
      </div>
      <p className="mb-3 text-[12px] text-[#656d76]">
        Public data — no key or login needed. Enter your Chess.com username; it's
        fetched directly in your browser and stored only on this device.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#656d76]">
            Username
          </label>
          <input
            type="text"
            value={username}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => onSetUsername(e.target.value)}
            placeholder="e.g. hikaru"
            className="w-48 rounded-md border border-[#d0d7de] px-2 py-1.5 text-[14px] outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={phase === 'syncing' || username.trim() === ''}
          className="rounded-md bg-[#218bff] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0969da] disabled:opacity-60"
        >
          {phase === 'syncing' ? 'Syncing…' : 'Sync from Chess.com'}
        </button>

        {phase === 'syncing' ? (
          <>
            <span className="text-[13px] text-[#656d76]">
              Syncing… {progress.done}
              {progress.total ? ` of ${progress.total}` : ''} months
            </span>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-md border border-[#d0d7de] px-2 py-1 text-[12px] text-[#1f2328] hover:bg-[#f3f4f6]"
            >
              Cancel
            </button>
          </>
        ) : null}

        {phase === 'done' ? (
          <span className="text-[13px] text-[#0a7c2f]">{message}</span>
        ) : null}

        {phase !== 'syncing' && lastSyncedAt ? (
          <span className="text-[12px] text-[#8c959f]">
            Last synced {formatLong(lastSyncedAt.slice(0, 10))}
          </span>
        ) : null}
      </div>

      {phase === 'notfound' ? (
        <div className="mt-3 text-[12px] text-[#cf222e]">
          No Chess.com player named “{username}”. Check the spelling (it's your
          username, not your display name).
        </div>
      ) : null}

      {phase === 'empty' ? (
        <div className="mt-3 text-[12px] text-[#9a6700]">
          No rated standard games found in the last 14 months for “{username}”.
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="mt-3 text-[12px] text-[#cf222e]">{message}</div>
      ) : null}

      {phase === 'shape' ? (
        <div className="mt-3">
          <div className="mb-1 text-[12px] font-medium text-[#cf222e]">
            Games were returned but none could be mapped — the API shape may
            differ. First game's JSON:
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-[#f6f8fa] p-2 text-[11px] text-[#1f2328]">
            {sample}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
