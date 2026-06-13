import type { Level } from '../types'

// 5-step color ramps keyed by a habit's `color`. Index 0 is the faint neutral
// "empty" cell; 1-4 ramp the habit color from light to dark. These map a
// derived Level onto a concrete CSS color at render time — they are presentation
// only and are never persisted.

type Ramp = readonly [string, string, string, string, string]

const RAMPS: Record<string, Ramp> = {
  // GitHub's classic contribution greens.
  green: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  // Provided so future habits can pick a different hue without code changes.
  blue: ['#ebedf0', '#9ecbff', '#54aeff', '#218bff', '#0a3069'],
  orange: ['#ebedf0', '#ffd8a8', '#ffa657', '#ec7813', '#a04100'],
  purple: ['#ebedf0', '#d8b9ff', '#b07cf2', '#8250df', '#5a2da0'],
}

const FALLBACK = RAMPS.green

export function rampFor(color: string): Ramp {
  return RAMPS[color] ?? FALLBACK
}

/** Concrete cell background for a given habit color + derived level. */
export function cellColor(color: string, level: Level): string {
  return rampFor(color)[level]
}
