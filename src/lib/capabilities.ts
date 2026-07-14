// One codebase, two build targets. The LOCAL build is today's app (dev server,
// dev proxy, Hevy API sync, personal keys). The HOSTED build is the same app as
// a secretless static site (no server, no account). Every gated feature reads
// the `capabilities` object below — there are no scattered import.meta.env
// checks in components.

export type DeployTarget = 'local' | 'hosted'
export type Tier = 'free' | 'paid'

export interface Capabilities {
  /** Live Hevy API sync — needs the Vite dev proxy, absent in a static build. */
  hevyApiSync: boolean
  /** Client-side Hevy CSV/TSV export import — works anywhere, no key, no Pro. */
  hevyCsvImport: boolean
  /** longitood cover proxy — a third-party hobby service, local-only (see cover.ts). */
  longitoodCovers: boolean
  /** Accounts — phase 2. Flag exists now so phase 2 needs no restructure. */
  accounts: boolean
  /** Cloud sync — phase 2. */
  cloudSync: boolean
}

export function getCapabilities(
  target: DeployTarget,
  tier: Tier = 'free',
): Capabilities {
  void tier // reserved for the paid tier; unused for now, kept so it slots in later
  return {
    hevyApiSync: target === 'local',
    hevyCsvImport: true,
    longitoodCovers: target === 'local',
    accounts: false,
    cloudSync: false,
  }
}

/** Build target from env, defaulting to 'local' so dev behavior is unchanged. */
export const DEPLOY_TARGET: DeployTarget =
  import.meta.env.VITE_DEPLOY_TARGET === 'hosted' ? 'hosted' : 'local'

/** Resolved capabilities for this build. Import this everywhere. */
export const capabilities: Capabilities = getCapabilities(DEPLOY_TARGET)
