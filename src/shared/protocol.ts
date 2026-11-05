/**
 * Host ↔ client wire contract. One home for the route paths, the settings
 * namespace (the profile entry id), and the JSON shapes both halves use.
 *
 * Keep this file dependency-free: the client bundle imports it too.
 */

/** Profile entry id; also the settings namespace the client binds. */
export const SETTINGS_NAMESPACE = 'dsh-gitbash'

export const ROUTE_STATE = '/api/dsh-gitbash/state'
export const ROUTE_DISCOVER = '/api/dsh-gitbash/discover'
export const ROUTE_VALIDATE = '/api/dsh-gitbash/validate'

/** Which bash family a profile comes from. */
export type BashFlavor = 'git' | 'msys2' | 'cygwin'

/** Human labels for each family; one home for the host label and the client. */
export const FLAVOR_LABELS: Record<BashFlavor, string> = {
  git: 'Git for Windows',
  msys2: 'MSYS2',
  cygwin: 'Cygwin',
}

/** MSYS2 environments in preference order (also the selectable `MSYSTEM` values). */
export const MSYSTEMS = ['UCRT64', 'MINGW64', 'CLANG64', 'CLANGARM64', 'MINGW32', 'MSYS'] as const

/** MSYS2 environment selection; also the value of `MSYSTEM`. */
export type Msystem = typeof MSYSTEMS[number]

/** `auto` derives the environment from the detected installation. */
export type MsystemSetting = 'auto' | Msystem

/** Every selectable MSYS2 environment setting, `auto` first. */
export const MSYSTEM_SETTINGS: readonly MsystemSetting[] = ['auto', ...MSYSTEMS]

/**
 * Strip one matching pair of single/double quotes around a user/YAML value.
 *
 * Hand-edited profile patches and the settings input may keep the quotes that
 * YAML would otherwise treat as syntax. The host and the browser row share this
 * one normalizer so a saved path is read back exactly as it was written.
 */
export function stripMatchingQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length < 2) return trimmed
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) return trimmed.slice(1, -1).trim()
  return trimmed
}

/** Sandbox behavior under a constrained session. */
export type CompatMode = 'auto' | 'strict'

/** One selectable shell profile discovered on this machine. */
export interface BashProfileView {
  /** Stable identity: flavor|root|msystem. */
  readonly id: string
  readonly flavor: BashFlavor
  /** Absolute path to bash.exe. */
  readonly path: string
  /** Installation root (…\Git, …\msys64, …\cygwin64). */
  readonly root: string
  readonly msystem?: Msystem
  /** MSYS2 environment root (…\ucrt64), when applicable. */
  readonly environmentRoot?: string
  /** Human label, e.g. `Git for Windows 2.56.0` or `MSYS2 UCRT64`. */
  readonly label: string
  readonly version?: string
  /** False when the path exists but the environment is unusable. */
  readonly valid: boolean
  /** Why an invalid candidate is unusable. */
  readonly problem?: string
}

/** Capability facts the settings row shows. */
export interface CapabilityView {
  readonly supported: boolean
  readonly reason?: string
  /** `ctx.shell.sandboxMode` of the mounted executor (the pwsh one). */
  readonly shellSandboxMode?: string
  /** Whether ctx.jobs is visible (background/promote available). */
  readonly backgroundJobs: boolean
  /** Whether a bash path is configured or auto-discovered. */
  readonly bashAvailable: boolean
}

/** Last per-agent replacement attempt. */
export interface ReplaceView {
  readonly at: number
  readonly applied: boolean
  readonly reason?: string
}

/** `POST /api/dsh-gitbash/state` response. */
export interface StateView {
  readonly ok: true
  readonly platform: string
  readonly settingsAvailable: boolean
  readonly bashPath: string
  readonly msystem: MsystemSetting
  readonly compat: CompatMode
  /** Effective profile after applying `auto`; absent when nothing validates. */
  readonly effective?: BashProfileView
  /** Why the configured/effective path is unusable, when it is. */
  readonly problem?: string
  /** Cached profiles, so the row can offer a selector without a scan. */
  readonly candidates: readonly BashProfileView[]
  /** The profile `auto` would pick, when any. */
  readonly recommended?: BashProfileView
  readonly capability: CapabilityView
  readonly lastReplace?: ReplaceView
  /** Config/settings write target the row can use. */
  readonly namespace: string
}

/** `POST /api/dsh-gitbash/discover` response. */
export interface DiscoverView {
  readonly ok: true
  readonly candidates: readonly BashProfileView[]
  /** The profile `auto` would pick, when any. */
  readonly recommended?: BashProfileView
  /** Non-fatal scan notes (registry read failed, etc.). */
  readonly notes: readonly string[]
}

/** `POST /api/dsh-gitbash/validate` response. */
export interface ValidateView {
  readonly ok: true
  readonly profile?: BashProfileView
  readonly problem?: string
}

/** Error body shared by all three routes. */
export interface ErrorView {
  readonly ok: false
  readonly error: string
}
