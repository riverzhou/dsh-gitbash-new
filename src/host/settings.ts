/**
 * The plugin's entry Config (the settings row) and its pure resolver.
 *
 * DSH 0.2.2 settings = the plugin's own profile-entry Config, namespace = entry
 * id (`dsh-gitbash`). Only `.volatile()` fields are projected into the settings
 * form and may be written at runtime; the Loader updates those references in
 * place, so `apply` reads a fresh value on every `agent/created` without a
 * watcher or a restart.
 */
import z from '@deepseek-ai/schemastery'
import type { CompatMode, MsystemSetting } from '../shared/protocol.ts'
import type { TerminalToolSettings, VolatileLike } from './types.ts'

/** MSYS2 environments the UI may pin; `auto` derives one from the install. */
export const MSYSTEM_SETTINGS: readonly MsystemSetting[] = [
  'auto',
  'UCRT64',
  'MINGW64',
  'CLANG64',
  'CLANGARM64',
  'MINGW32',
  'MSYS',
]

export const COMPAT_MODES: readonly CompatMode[] = ['auto', 'strict']

export const SETTINGS_DEFAULTS: TerminalToolSettings = {
  bashPath: '',
  msystem: 'auto',
  compat: 'auto',
}

/**
 * The editable config. Field names are the persisted patch paths and the
 * client's `set(...)` keys — changing one is a persisted-contract change.
 */
export const Config = z.object({
  /** Empty means "auto-discover the best profile". */
  bashPath: z.string().default(SETTINGS_DEFAULTS.bashPath).volatile(),
  /** Only meaningful for MSYS2; Git for Windows always runs MINGW64. */
  msystem: z.union(MSYSTEM_SETTINGS).default(SETTINGS_DEFAULTS.msystem).volatile(),
  /** `auto`: workspace-write sessions run bash unconfined; `strict`: refuse. */
  compat: z.union(COMPAT_MODES).default(SETTINGS_DEFAULTS.compat).volatile(),
})

/** Strip the whitespace and matching YAML quotes a hand-edited patch may carry. */
export function normalizeBashPath(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/** Read a volatile field; plain values are accepted for unit tests. */
function readField<T>(value: unknown, fallback: T): T {
  if (value !== null && typeof value === 'object' && typeof (value as VolatileLike<T>).get === 'function') {
    const current = (value as VolatileLike<T>).get()
    return current === undefined || current === null ? fallback : current
  }
  return value === undefined || value === null ? fallback : (value as T)
}

/**
 * Normalize a settings snapshot. Unknown or malformed fields fall back to the
 * defaults; cross-field validation (does the path run?) belongs to the use
 * site, because the schema cannot express it.
 */
export function resolveSettings(input: unknown): TerminalToolSettings {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const rawPath = record.bashPath
  const rawMsystem = record.msystem
  const rawCompat = record.compat
  return {
    bashPath: typeof rawPath === 'string' ? normalizeBashPath(rawPath) : SETTINGS_DEFAULTS.bashPath,
    msystem: typeof rawMsystem === 'string' && (MSYSTEM_SETTINGS as readonly string[]).includes(rawMsystem)
      ? (rawMsystem as MsystemSetting)
      : SETTINGS_DEFAULTS.msystem,
    // An unknown non-empty mode is a typo/old value: keep the safer `strict`
    // rather than silently weakening an intended strict deployment to auto.
    compat: typeof rawCompat === 'string'
      ? (COMPAT_MODES as readonly string[]).includes(rawCompat)
        ? rawCompat as CompatMode
        : rawCompat.trim().length > 0 ? 'strict' : SETTINGS_DEFAULTS.compat
      : SETTINGS_DEFAULTS.compat,
  }
}

/** Read the live settings from the config `apply` received. */
export function readSettings(config: unknown): TerminalToolSettings {
  if (typeof config !== 'object' || config === null) return { ...SETTINGS_DEFAULTS }
  const record = config as Record<string, unknown>
  return resolveSettings({
    bashPath: readField(record.bashPath, SETTINGS_DEFAULTS.bashPath),
    msystem: readField(record.msystem, SETTINGS_DEFAULTS.msystem),
    compat: readField(record.compat, SETTINGS_DEFAULTS.compat),
  })
}
