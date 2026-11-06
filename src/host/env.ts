/**
 * Profile-specific environment and path handling for Windows bash.
 *
 * Git for Windows and MSYS2 need different `MSYSTEM`/`PATH` layouts even when
 * both end up executing the same `bash.exe` filename. These helpers are pure
 * (except for `os`/`path`), so they are unit-testable without DSH.
 */
import { existsSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { normalize, resolve, sep } from 'node:path'
import { stripMatchingQuotes } from '../shared/protocol.ts'
import type { BashProfile } from './discover.ts'

/** A workdir the caller asked for cannot be represented as a Windows cwd. */
export class BashPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BashPathError'
  }
}

/** Model-friendly environment overrides shared by both flavors. */
export const ENV_OVERRIDES = {
  NO_COLOR: '1',
  TERM: 'dumb',
  PAGER: 'cat',
  GIT_PAGER: 'cat',
  CHERE_INVOKING: '1',
} as const

/** PATH entries the profile needs in front of the inherited PATH. */
export function profilePathEntries(profile: BashProfile): string[] {
  if (profile.flavor === 'git') {
    const entries = [join(profile.root, 'bin'), join(profile.root, 'usr', 'bin')]
    // Git for Windows 2.5x uses ucrt64; older installs use mingw64/mingw32.
    for (const env of ['ucrt64', 'mingw64', 'mingw32']) {
      const dir = join(profile.root, env, 'bin')
      if (existsSync(dir)) entries.push(dir)
    }
    return entries
  }
  if (profile.flavor === 'cygwin') {
    return [join(profile.root, 'bin')]
  }
  const entries: string[] = []
  if (profile.environmentRoot !== undefined) entries.push(join(profile.environmentRoot, 'bin'))
  entries.push(join(profile.root, 'usr', 'bin'))
  entries.push(join(profile.root, 'usr', 'local', 'bin'))
  return entries
}

/** Join with `\`, normalizing either input separator. */
function join(base: string, ...parts: string[]): string {
  return normalize([base.replace(/[\\/]+$/, ''), ...parts].join(sep))
}

/** Normalize a PATH entry for comparison. */
function pathKey(path: string): string {
  return normalize(path).replaceAll('/', '\\').toLowerCase()
}

/** True when `entry` is `root` or below it. */
function underRoot(entry: string, root: string): boolean {
  const key = pathKey(entry)
  const base = pathKey(root)
  return key === base || key.startsWith(`${base}\\`)
}

/**
 * Deduplicate a PATH list case-insensitively and drop entries that belong to
 * another bash installation. Mixing Git's `usr\bin` into MSYS2 (or MSYS2's
 * `usr\bin` into Git) silently swaps DLLs and tools; the selected profile must
 * own the front of PATH.
 */
export function composePath(
  profile: BashProfile,
  inherited: string | undefined,
  foreignRoots: readonly string[] = [],
): string {
  const selected = new Set(profilePathEntries(profile).map(pathKey))
  const seen = new Set<string>()
  const out: string[] = []
  const push = (entry: string): void => {
    const trimmed = stripMatchingQuotes(entry)
    if (trimmed.length === 0) return
    const key = pathKey(trimmed)
    if (seen.has(key)) return
    if (foreignRoots.some(root => underRoot(trimmed, root))) return
    // Static guards for standard installs the cache did not enumerate. Match
    // the install directory on any drive, not only C:.
    const underSelected = underRoot(trimmed, profile.root)
    const msysRoot = !underSelected && (
      key.includes('\\msys64\\') || key.includes('\\msys32\\')
      || key.includes('\\cygwin\\') || key.includes('\\cygwin64\\') || key.includes('\\cygwin32\\')
      || key.endsWith('\\cygwin') || key.endsWith('\\cygwin64') || key.endsWith('\\cygwin32')
    )
    if (profile.flavor === 'git' && msysRoot) return
    if (profile.flavor === 'msys2' && key.includes('\\program files\\git\\')) return
    if (profile.flavor === 'cygwin' && (msysRoot || key.includes('\\program files\\git\\'))) return
    // Keep only this MSYS2 environment's own bin dirs; drop sibling envs.
    if (profile.flavor === 'msys2' && underRoot(trimmed, profile.root) && ![...selected].some(prefix => key === prefix)) return
    seen.add(key)
    out.push(trimmed)
  }
  for (const entry of profilePathEntries(profile)) push(entry)
  for (const entry of (inherited ?? '').split(';')) push(entry)
  return out.join(';')
}

/**
 * Build the child environment for one execution.
 *
 * The subprocess service merges this after its credential scrub, then merges
 * the managed `dshEnv` snapshot last, so `DSH_*` facts always win.
 */
export function composeEnv(
  profile: BashProfile,
  inherited: NodeJS.ProcessEnv,
  dshEnv?: Record<string, string>,
  foreignRoots: readonly string[] = [],
): NodeJS.ProcessEnv {
  // The host process may export a Windows `PWD` (for example `D:\work`). Bash
  // trusts an inherited `PWD` when it matches the cwd and then reports that
  // Windows form as `$PWD`/`pwd`, breaking POSIX path expectations. Explicit
  // `undefined` tombstones make the subprocess service drop the ambient values
  // so the shell derives the POSIX path from its real cwd. The same tombstone
  // keeps an inherited `MSYSTEM`/`MSYS2_PATH_TYPE` out of a Cygwin (or a
  // mismatched) session; each flavor that needs them sets its own.
  const env: NodeJS.ProcessEnv = {
    ...ENV_OVERRIDES,
    PWD: undefined,
    OLDPWD: undefined,
    MSYSTEM: undefined,
    MSYS2_PATH_TYPE: undefined,
  }
  if (profile.flavor === 'git') {
    env.MSYSTEM = 'MINGW64'
  } else if (profile.flavor === 'msys2') {
    if (profile.msystem === undefined) {
      throw new BashPathError('MSYS2 profile is missing its environment (UCRT64 / MINGW64 / …)')
    }
    env.MSYSTEM = profile.msystem
    env.MSYS2_PATH_TYPE = 'inherit'
  }
  env.PATH = composePath(profile, inherited.PATH ?? inherited.Path, foreignRoots)
  return { ...env, ...dshEnv }
}

/**
 * Convert a model-supplied POSIX path to a Windows absolute path.
 *
 * Supported: `/c/...`, `/cygdrive/c/...`, `/tmp/...`, `~`, `~/...`.
 * An absolute POSIX path without a drive mapping (`/home/...`) throws: Git's
 * `/home` mapping differs from MSYS2's, so guessing would be worse than a
 * clear error.
 */
export function posixToWindows(input: string): string {
  if (input === '/tmp' || input.startsWith('/tmp/')) {
    return resolve(tmpdir(), input.slice('/tmp/'.length).replaceAll('/', sep))
  }
  if (input === '~' || input.startsWith('~/')) {
    return resolve(homedir(), input.slice(2).replaceAll('/', sep))
  }
  const cygdrive = /^\/cygdrive\/([a-zA-Z])(\/.*)?$/.exec(input)
  if (cygdrive?.[1] !== undefined) {
    return `${cygdrive[1].toUpperCase()}:${(cygdrive[2] ?? '\\').replaceAll('/', sep)}`
  }
  const drive = /^\/([a-zA-Z])(\/.*)?$/.exec(input)
  if (drive?.[1] !== undefined) {
    return `${drive[1].toUpperCase()}:${(drive[2] ?? '\\').replaceAll('/', sep)}`
  }
  return input
}

/** True for a Windows drive/UNC absolute path. */
export function isWindowsAbsolute(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\')
}

/** True for a POSIX absolute path. */
function isPosixAbsolute(path: string): boolean {
  return path.startsWith('/')
}

/**
 * Resolve the effective spawn cwd (always a Windows absolute path).
 *
 * @param requested - the model's `workdir` argument, if any.
 * @param sessionCwd - the session's current directory from `workingDirectory`.
 * @returns the absolute Windows directory, normalized.
 * @throws BashPathError when the directory does not exist or cannot be mapped.
 */
export function resolveWorkdir(requested: string | undefined, sessionCwd: string | undefined): string {
  if (requested === undefined || requested.trim().length === 0) {
    const base = sessionCwd !== undefined && sessionCwd.length > 0 ? sessionCwd : process.cwd()
    return assertDirectory(base)
  }
  const value = stripMatchingQuotes(requested)
  if (/^[a-zA-Z]:/.test(value) && !isWindowsAbsolute(value)) {
    throw new BashPathError(
      `workdir ${JSON.stringify(value)} is drive-relative; use an absolute path such as C:\\... or a path relative to the session cwd`,
    )
  }
  let windows: string | undefined
  if (isWindowsAbsolute(value)) {
    windows = value
  } else if (isPosixAbsolute(value)) {
    const converted = posixToWindows(value)
    if (!isWindowsAbsolute(converted)) {
      throw new BashPathError(
        `workdir ${JSON.stringify(value)} is an absolute POSIX path without a drive mapping; `
        + 'use a Windows path (C:\\...) or a path under /c, /d, /tmp, or ~',
      )
    }
    windows = converted
  } else {
    const base = sessionCwd !== undefined && sessionCwd.length > 0 ? sessionCwd : process.cwd()
    windows = resolve(base, value)
  }
  return assertDirectory(windows)
}

/** Normalize and require an existing directory. */
function assertDirectory(path: string): string {
  const absolute = normalize(path)
  try {
    if (!existsSync(absolute)) {
      throw new BashPathError(`workdir does not exist: ${absolute}`)
    }
    if (!statSync(absolute).isDirectory()) {
      throw new BashPathError(`workdir is not a directory: ${absolute}`)
    }
  } catch (error) {
    if (error instanceof BashPathError) throw error
    throw new BashPathError(`workdir is not accessible: ${absolute}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return absolute
}
