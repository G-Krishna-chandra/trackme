import { useRef, useState } from 'react'
import { formatLong } from '../lib/date'
import { HevyAuthError, type SyncResult } from '../lib/hevySync'

interface GymSyncProps {
  lastSyncedAt?: string
  onSync: (
    onProgress: (done: number, total: number) => void,
    signal: AbortSignal,
  ) => Promise<SyncResult>
}

type Phase = 'idle' | 'syncing' | 'done' | 'auth' | 'error' | 'shape'

function isAuthError(err: unknown): boolean {
  return err instanceof HevyAuthError || (err as Error)?.name === 'HevyAuthError'
}

export function GymSync({ lastSyncedAt, onSync }: GymSyncProps) {
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
      if (result.sessions.length === 0 && result.total > 0) {
        // Workouts came back but none mapped — surface the raw shape, don't guess.
        setSample(JSON.stringify(result.sampleWorkout, null, 2))
        setPhase('shape')
        return
      }
      setMessage(
        `Synced ${result.sessions.length} workout${result.sessions.length === 1 ? '' : 's'}.`,
      )
      setPhase('done')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setPhase('idle')
        return
      }
      if (isAuthError(err)) {
        setPhase('auth')
        return
      }
      setMessage((err as Error)?.message ?? 'Sync failed.')
      setPhase('error')
    }
  }

  const cancel = () => abortRef.current?.abort()

  return (
    <div className="mb-6 rounded-lg border border-[#d0d7de] bg-white p-4">
      <div className="mb-1 text-[13px] font-semibold text-[#1f2328]">
        Sync from Hevy{' '}
        <span className="font-normal text-[#8c959f]">(optional, requires Hevy Pro)</span>
      </div>
      <p className="mb-3 text-[12px] text-[#656d76]">
        Pulls your workouts from the Hevy API through the local dev proxy — your
        key stays server-side and is never sent to the browser. Works when
        running <code>npm run dev</code>.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sync}
          disabled={phase === 'syncing'}
          className="rounded-md bg-[#8250df] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#6f42c1] disabled:opacity-60"
        >
          {phase === 'syncing' ? 'Syncing…' : 'Sync from Hevy'}
        </button>

        {phase === 'syncing' ? (
          <>
            <span className="text-[13px] text-[#656d76]">
              Syncing… {progress.done}
              {progress.total ? ` of ${progress.total}` : ''} workouts
            </span>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-[#d0d7de] px-2 py-1 text-[12px] text-[#1f2328] hover:bg-[#f3f4f6]"
            >
              Cancel
            </button>
          </>
        ) : null}

        {phase === 'done' ? (
          <span className="text-[13px] text-[#1a7f37]">{message}</span>
        ) : null}

        {phase !== 'syncing' && lastSyncedAt ? (
          <span className="text-[12px] text-[#8c959f]">
            Last synced {formatLong(lastSyncedAt.slice(0, 10))}
          </span>
        ) : null}
      </div>

      {phase === 'auth' ? (
        <div className="mt-3 rounded-md border border-[#d0a215] bg-[#fff8c5] p-3 text-[12px] text-[#1f2328]">
          Couldn't authenticate. Add your Hevy Pro API key to{' '}
          <code>.env.local</code> as <code>HEVY_API_KEY=…</code> (get it at{' '}
          <a
            href="https://hevy.com/settings?developer"
            target="_blank"
            rel="noreferrer"
            className="text-[#0969da] underline"
          >
            hevy.com/settings?developer
          </a>
          ), then restart the dev server.
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="mt-3 text-[12px] text-[#cf222e]">{message}</div>
      ) : null}

      {phase === 'shape' ? (
        <div className="mt-3">
          <div className="mb-1 text-[12px] font-medium text-[#cf222e]">
            Workouts were returned but none could be mapped — the API shape may
            differ. First workout's JSON:
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-[#f6f8fa] p-2 text-[11px] text-[#1f2328]">
            {sample}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
