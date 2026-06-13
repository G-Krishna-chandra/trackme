// Color intensity for a day-cell. 0 = empty/faint, 1-4 = increasing saturation.
export type Level = 0 | 1 | 2 | 3 | 4

export interface Habit {
  id: string
  name: string
  /** Unit the value is measured in, e.g. "pages". */
  unit: string
  /** Color key driving the cell ramp, e.g. "green". See lib/colors.ts. */
  color: string
}

export interface Entry {
  habitId: string
  /** ISO yyyy-mm-dd, interpreted in the user's local timezone. */
  date: string
  /** Integer amount done that day, e.g. pages read. */
  value: number
  /** Optional freeform note, e.g. the book title. */
  note?: string
}
