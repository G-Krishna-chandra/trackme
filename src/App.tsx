import { useState } from 'react'
import { ReadingView } from './components/ReadingView'
import { GymView } from './components/GymView'
import { MinutesHabitView } from './components/MinutesHabitView'
import { ChessView } from './components/ChessView'
import { DataView } from './components/DataView'

type Tab = 'reading' | 'gym' | 'guitar' | 'chess' | 'cardistry' | 'data'

const TABS: { id: Tab; label: string }[] = [
  { id: 'reading', label: 'Reading' },
  { id: 'gym', label: 'Gym' },
  { id: 'guitar', label: 'Guitar' },
  { id: 'chess', label: 'Chess' },
  { id: 'cardistry', label: 'Cardistry' },
  { id: 'data', label: 'Data' },
]

function renderView(tab: Tab) {
  switch (tab) {
    case 'reading':
      return <ReadingView />
    case 'gym':
      return <GymView />
    case 'guitar':
      return <MinutesHabitView habitId="guitar" />
    case 'chess':
      return <ChessView />
    case 'cardistry':
      return <MinutesHabitView habitId="cardistry" />
    case 'data':
      return <DataView />
  }
}

function App() {
  const [tab, setTab] = useState<Tab>('reading')

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#1f2328]">
            TrackMe
          </h1>
          <p className="mt-1 text-[13px] text-[#656d76]">
            A local-first habit tracker. Every day is shaded against your own
            recent baseline — you're only ever competing with recent&#8209;you,
            never a fixed goal.
          </p>
          <nav className="mt-3 flex flex-wrap gap-1 border-b border-[#d0d7de]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-[14px] font-medium ${
                  tab === t.id
                    ? 'border-[#1f2328] text-[#1f2328]'
                    : 'border-transparent text-[#656d76] hover:text-[#1f2328]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        {renderView(tab)}

        <footer className="mt-8 text-center text-[12px] text-[#8c959f]">
          Local-first · your data lives only in this browser — no account, no
          server, no tracking. See the <strong>Data</strong> tab to back up or
          restore.
        </footer>
      </div>
    </div>
  )
}

export default App
