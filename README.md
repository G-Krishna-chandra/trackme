# TrackMe

A habit tracker that borrows GitHub's contribution graph and points it at your
own habits. Each day is a small square; the darker the square, the better that
day was — but "better" is judged **against recent you**, not a fixed goal.

v1 ships exactly one habit: **Reading**, measured in **pages per day**.

![grid](https://img.shields.io/badge/grid-7%C3%9753-2ea043) ![local-first](https://img.shields.io/badge/storage-localStorage-30a14e) ![no backend](https://img.shields.io/badge/backend-none-216e39)

---

## The idea: self-relative, rolling-baseline coloring

On GitHub, a green cell means "you committed a lot that day" against a fixed
scale. That doesn't translate to personal habits — 30 pages is huge for one
person and a warm-up for another, and a fixed "good day = 50 pages" target is
just a goal you'll game or quietly abandon.

TrackMe has **no goal**. Instead, every day's color is computed **relative to
the ~6 weeks before that day**, counting only the days you actually read:

```
for an entry on date d with value v (within one habit):

  if v <= 0:                      level = 0          // empty / faint cell
  else:
    window  = active days in [d-42, d-1]             // value > 0 only
    if window is empty:           level = 3          // cold-start default
    else:
      ceiling = max(window values)                   // top of your recent range
      ratio   = min(v / ceiling, 1)                  // matching recent best = full
      level   = clamp(ceil(ratio * 4), 1, 4)         // any active day is >= 1
```

- **42 days = 6 weeks** of trailing context.
- The window counts **only active days** (`value > 0`). Skipped/zero days are
  excluded, so being inconsistent never *darkens* your scale — it just doesn't
  add data.
- Each cell uses **its own trailing window**. Once a day passes, its color only
  changes if data *inside its window* is edited. Editing a past day correctly
  re-colors that day **and the up-to-42 following days** whose window includes
  it — this falls out for free because **levels are derived, never stored**.

### Why this resists gaming

- **Progressive improvement stays dark for free.** Level 4 means you matched or
  beat your recent best. As your baseline climbs, the bar climbs with it — to
  *stay* dark you have to keep beating recent-you. You can't coast.
- **A normal day reads honestly.** A typical day lands mid-tone (2–3), not a
  fake "all green."
- **A few light days are forgiven.** One short day is judged against six weeks
  of context, so it doesn't tank — but a *sustained* decline does fade, because
  the ceiling it's measured against was set by the better recent days.
- **You can't pad with zeros.** Inactive days are excluded from the window, so
  logging "0" to look busy does nothing to the scale.

### The one knob

The ceiling is `max(window)` in v1. That means a single outlier (one 400-page
binge) compresses everything else for 42 days — accepted for now. It's isolated
in a single function, [`windowCeiling`](src/lib/coloring.ts), so it can later be
swapped for, say, the ~90th percentile of the window without touching the rest
of the algorithm.

### Color is self-relative — the raw numbers aren't hidden

Because color is relative, a slow real-world decline could hide behind the
rolling scale. So **hovering any cell shows the absolute number** ("May 14 — 32
pages") and the current streak, and the **weekly sparkline** below the grid plots
raw weekly totals — the absolute long-run trend, deliberately separate from the
self-relative grid.

---

## Stack

- **React + TypeScript + Vite + Tailwind CSS v4**
- **Local-first, no backend.** Data persists to `localStorage` behind a small
  [`EntryRepository`](src/data/EntryRepository.ts) interface, so the backend can
  later become IndexedDB or a synced store without touching the UI or logic.
- **Only raw entries are stored** — one integer (plus optional note) per day.
  Color levels are pure functions of that data, computed at render time.

### Data model

Two stores, multi-habit by design even though v1 surfaces one habit:

- `habits`: `{ id, name, unit, color }` — seeded with one row:
  `{ id: "reading", name: "Reading", unit: "pages", color: "green" }`.
- `entries`: `{ habitId, date (yyyy-mm-dd), value (int), note? }` — one entry per
  `(habitId, date)`.

Adding a second habit later (gym, etc.) is just another `habits` row — no schema
change, and every habit gets its own independent graph (never a composite).

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Build and preview a production bundle:

```bash
npm run build    # type-checks, then builds to dist/
npm run preview
```

### Using it

- **Log today** with the control at the top (pages + optional note, e.g. a book
  title).
- **Click any day** in the grid to add or edit that date's value and note.
- **Hover any day** to see the raw page count, the note, and your current streak.
- Header shows **current streak, longest streak, total pages, and pages this
  week**. A streak is consecutive days with pages > 0; today not-yet-logged
  doesn't break it (today is still open) — only a fully-elapsed zero day does.

Your data lives only in your browser. Clearing site data resets it.

---

## Roadmap

- **More habits.** The data layer is already multi-habit. Next is a habit
  switcher and a way to add habits with their own unit and color. Each keeps its
  own per-habit graph.
- **Gym via progressive-overload-on-rolling-baseline.** The exact same
  self-relative mechanic fits strength training: judge today's working weight /
  volume against your recent range, so the graph rewards steadily overloading
  rather than hitting a fixed number.
- **Smarter ceiling.** Swap `max(window)` for the ~90th percentile so a single
  binge day doesn't compress six weeks of cells.
- **Optional Apple Health sync** for cardio (e.g. running distance / active
  minutes), feeding the same rolling-baseline coloring from real data.
- **Pluggable storage.** Implement `EntryRepository` over IndexedDB or a synced
  backend for multi-device use.

---

## Project layout

```
src/
  types.ts                       Habit / Entry / Level types
  lib/
    coloring.ts                  the rolling self-relative level algorithm
    colors.ts                    color ramps per habit color
    stats.ts                     streaks, totals, weekly aggregation
    grid.ts                      53-week grid geometry
    date.ts                      local-timezone ISO date helpers
  data/
    EntryRepository.ts           storage interface (the swap point)
    LocalStorageRepository.ts    localStorage implementation
    seed.ts                      the seeded Reading habit
  store/useHabit.ts              React hook over the repository
  components/                    grid, cell, editor, stats, log, sparkline
```
