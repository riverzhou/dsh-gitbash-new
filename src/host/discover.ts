/**
 * Git for Windows / MSYS2 / Cygwin discovery and validation.
 *
 * A "shell profile" is the unit the user selects: flavor + install root +
 * MSYS2 environment. MSYS2 shares one `usr\bin\bash.exe` across environments,
 * so the path alone is not enough — `msystem` is part of the identity.
 *
 * The scanner is filesystem-first. Registry and `where.exe` are consulted only
 * during a full scan (plugin start / the settings "discover" button); agent
 * creation uses the cached result and never spawns.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { basename, normalize } from 'node:path'
import type { BashFlavor, BashProfileView, Msystem, MsystemSetting } from '../shared/protocol.ts'
import { FLAVOR_LABELS, MSYSTEMS, stripMatchingQuotes } from '../shared/protocol.ts'
import type { TerminalToolSettings } from './types.ts'

/** A validated shell profile, with its install/environment facts. */
export interface BashProfile extends BashProfileView {
  readonly flavor: BashFlavor
  readonly root: string
  readonly msystem?: Msystem
  readonly environmentRoot?: string
  readonly valid: boolean
}

/** Result of a discovery pass. */
export interface DiscoverResult {
  readonly candidates: readonly BashProfile[]
  readonly recommended?: BashProfile
  readonly notes: readonly string[]
}

/** Result of resolving the configured/auto profile. */
export interface ResolveProfileResult {
  readonly profile?: BashProfile
  readonly problem?: string
}

/** MSYS2 environments, in preference order; `dir` is the install subdirectory. */
const MSYS2_ENVIRONMENTS: readonly { readonly msystem: Msystem; readonly dir: string }[] = MSYSTEMS.map(msystem => ({
  msystem,
  dir: msystem === 'MSYS' ? '' : msystem.toLowerCase(),
}))

/** Normalize a path for identity comparisons (Windows semantics). */
export function normalizePathKey(path: string): string {
  return normalize(path).replaceAll('/', '\\').toLowerCase()
}

/** Exe name test for a bash candidate. */
export function isBashFilename(path: string): boolean {
  const name = basename(path).toLowerCase()
  return name === 'bash' || name === 'bash.exe'
}

/**
 * WSL's bash is not Git Bash and cannot run with this plugin's environment.
 * Exclude the System32/Sysnative/WindowsApps shims and any `\\wsl$` path.
 */
export function isBlockedBash(path: string): boolean {
  const key = normalizePathKey(path)
  if (key.startsWith('\\\\wsl$\\') || key.startsWith('\\\\wsl.localhost\\')) return true
  if (key.includes('\\windows\\system32\\bash.exe')) return true
  if (key.includes('\\windows\\sysnative\\bash.exe')) return true
  if (key.includes('\\windowsapps\\')) return true
  if (key.endsWith('\\wsl.exe')) return true
  return false
}

/** True for a Windows drive or UNC absolute path (host-platform independent). */
function isWindowsAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\')
}

/** True when `path` is an existing regular file. */
function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile()
  } catch {
    return false
  }
}

/** True when `path` is an existing directory. */
function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** `C:\a\b\bash.exe` → `C:\a\b`; tolerant of forward slashes. */
function winDirname(path: string): string {
  const index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return index <= 0 ? path : path.slice(0, index)
}

/** Join with the host separator, accepting either input separator. */
function winJoin(base: string, ...parts: string[]): string {
  let out = base.replace(/[\\/]+$/, '')
  for (const part of parts) out = `${out}\\${part.replace(/^[\\/]+/, '')}`
  return out
}

/** Install root of a bash.exe path, or undefined when the layout is unknown. */
export function deriveRootFromBash(path: string): string | undefined {
  const key = normalizePathKey(path)
  if (key.endsWith('\\usr\\bin\\bash.exe')) return winDirname(winDirname(winDirname(path)))
  // Some distributions also place bash in an environment bin (ucrt64, …).
  for (const env of MSYS2_ENVIRONMENTS) {
    if (env.dir !== '' && key.endsWith(`\\${env.dir}\\bin\\bash.exe`)) {
      return winDirname(winDirname(winDirname(path)))
    }
  }
  if (key.endsWith('\\bin\\bash.exe')) return winDirname(winDirname(path))
  return undefined
}

/** Install root of a git.exe path, or undefined. */
export function deriveRootFromGit(path: string): string | undefined {
  const key = normalizePathKey(path)
  // MSYS2 exposes git under usr/bin and under each environment bin. Those
  // paths also end with `\bin\git.exe`, but their true root is three levels up.
  if (key.endsWith('\\usr\\bin\\git.exe')) return winDirname(winDirname(winDirname(path)))
  for (const env of MSYS2_ENVIRONMENTS) {
    if (env.dir !== '' && key.endsWith(`\\${env.dir}\\bin\\git.exe`)) {
      return winDirname(winDirname(winDirname(path)))
    }
  }
  if (key.endsWith('\\cmd\\git.exe')) return winDirname(winDirname(path))
  if (key.endsWith('\\bin\\git.exe')) return winDirname(winDirname(path))
  return undefined
}

/** Detect the flavor from install markers; falls back to the directory name. */
export function detectFlavor(root: string): BashFlavor {
  if (
    isFile(winJoin(root, 'msys2.exe'))
    || isFile(winJoin(root, 'usr', 'bin', 'pacman.exe'))
    || isFile(winJoin(root, 'etc', 'msys2-release'))
  ) {
    return 'msys2'
  }
  if (isFile(winJoin(root, 'bin', 'cygwin1.dll')) || isFile(winJoin(root, 'etc', 'setup'))) {
    return 'cygwin'
  }
  if (isFile(winJoin(root, 'cmd', 'git.exe')) || isFile(winJoin(root, 'mingw64', 'bin', 'git.exe'))) {
    return 'git'
  }
  const name = basename(root).toLowerCase()
  if (name.includes('msys')) return 'msys2'
  if (name.includes('cygwin')) return 'cygwin'
  return 'git'
}

/** MSYS2 environment root for a selected environment. */
export function environmentRootFor(root: string, msystem: Msystem): string | undefined {
  const env = MSYS2_ENVIRONMENTS.find(entry => entry.msystem === msystem)
  if (env === undefined) return undefined
  return env.dir === '' ? winJoin(root, 'usr') : winJoin(root, env.dir)
}

/** First existing MSYS2 environment, in preference order. */
export function defaultMsystemFor(root: string): Msystem {
  for (const env of MSYS2_ENVIRONMENTS) {
    if (env.dir === '') return 'MSYS'
    if (isDirectory(winJoin(root, env.dir, 'bin'))) return env.msystem
  }
  return 'MSYS'
}

/** Bash path inside an install root. */
function bashPathFor(root: string): string | undefined {
  const usr = winJoin(root, 'usr', 'bin', 'bash.exe')
  if (isFile(usr)) return usr
  const bin = winJoin(root, 'bin', 'bash.exe')
  if (isFile(bin)) return bin
  return undefined
}

/** Parse `GNU bash, version 5.3.15(2)-release (…)`. */
export function parseBashVersion(output: string): string | undefined {
  const match = /GNU bash,\s*version\s+([^\s(]+)/i.exec(output)
  return match?.[1]
}

/** Spawn `bash --version` with a short, non-blocking timeout. */
export function probeBashVersion(path: string, timeoutMs = 2000): { version?: string; problem?: string } {
  try {
    const result = spawnSync(path, ['--version'], {
      timeout: timeoutMs,
      windowsHide: true,
      encoding: 'utf8',
      // Discovery may execute an executable found on PATH. Do not hand it the
      // host's environment (credentials, tokens); `bash --version` needs none.
      env: {},
    })
    if (result.error !== undefined && result.error !== null) {
      return { problem: result.error.message }
    }
    if (result.status !== 0) {
      return { problem: (result.stderr || result.stdout || `exit ${String(result.status)}`).trim().slice(0, 300) }
    }
    const version = parseBashVersion(result.stdout ?? '')
    return version === undefined ? { problem: 'not a GNU bash build' } : { version }
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) }
  }
}

/** Build one profile, validating its path/environment (and optionally its version). */
function makeProfile(
  flavor: BashFlavor,
  root: string,
  path: string,
  msystem: Msystem | undefined,
  probe: boolean,
): BashProfile {
  const id = `${flavor}|${normalizePathKey(root)}|${msystem ?? ''}`
  const label = flavor === 'msys2'
    ? `${FLAVOR_LABELS.msys2} ${msystem ?? 'MSYS'}`
    : FLAVOR_LABELS[flavor]
  let problem: string | undefined
  if (isBlockedBash(path)) problem = 'WSL bash is not supported'
  else if (!isBashFilename(path)) problem = 'not a bash executable'
  else if (!isFile(path)) problem = 'bash.exe does not exist'
  if (problem === undefined && flavor === 'msys2') {
    const envRoot = msystem === undefined ? undefined : environmentRootFor(root, msystem)
    if (envRoot === undefined || !isDirectory(winJoin(envRoot, 'bin'))) {
      problem = `MSYS2 environment ${msystem ?? '(unknown)'} is not installed (${envRoot ?? 'unknown root'})`
    }
  }
  let version: string | undefined
  if (problem === undefined && probe) {
    const result = probeBashVersion(path)
    if (result.problem !== undefined) problem = result.problem
    else version = result.version
  }
  const environmentRoot = flavor === 'msys2' && msystem !== undefined
    ? environmentRootFor(root, msystem)
    : undefined
  return {
    id,
    flavor,
    path,
    root,
    ...msystem !== undefined ? { msystem } : {},
    ...environmentRoot !== undefined ? { environmentRoot } : {},
    label,
    ...version !== undefined ? { version } : {},
    valid: problem === undefined,
    ...problem !== undefined ? { problem } : {},
  }
}

/** Enumerate the profiles an install root can provide. */
export function profilesForRoot(root: string, probe = false): BashProfile[] {
  if (!isDirectory(root)) return []
  const flavor = detectFlavor(root)
  const bash = bashPathFor(root)
  if (bash === undefined) return []
  if (flavor === 'git') {
    return [makeProfile('git', root, bash, 'MINGW64', probe)]
  }
  if (flavor === 'cygwin') {
    return [makeProfile('cygwin', root, bash, undefined, probe)]
  }
  const profiles: BashProfile[] = []
  for (const env of MSYS2_ENVIRONMENTS) {
    if (env.dir !== '' && !isDirectory(winJoin(root, env.dir, 'bin'))) continue
    profiles.push(makeProfile('msys2', root, bash, env.msystem, probe))
  }
  return profiles
}

/**
 * Git for Windows ships two `bash.exe` files: `bin\bash.exe` is a launcher
 * that resets `MSYSTEM`/PATH from the installation (Git 2.56 uses UCRT64),
 * while `usr\bin\bash.exe` honors the environment we compose. Normalize the
 * former to the latter when it exists, so `MSYSTEM=MINGW64` and our PATH
 * isolation actually apply.
 * @param path - the user-provided bash path.
 * @param root - the derived install root.
 * @returns the canonical `usr\bin\bash.exe` when present, else the input.
 */
function canonicalGitBash(path: string, root: string): string {
  if (!normalizePathKey(path).endsWith('\\bin\\bash.exe')) return path
  const usr = winJoin(root, 'usr', 'bin', 'bash.exe')
  return isFile(usr) ? usr : path
}

/** Resolve a user-provided bash path to a profile (no auto fallback). */
export function profileFromPath(
  path: string,
  msystem: MsystemSetting,
  probe = false,
): ResolveProfileResult {
  const trimmed = stripMatchingQuotes(path)
  if (trimmed.length === 0) return { problem: 'bashPath is empty' }
  if (isBlockedBash(trimmed)) return { problem: 'WSL bash is not supported' }
  if (!isBashFilename(trimmed)) return { problem: 'path must point to bash.exe' }
  if (!isWindowsAbsolutePath(trimmed)) return { problem: `bashPath must be an absolute path: ${trimmed}` }
  if (!isFile(trimmed)) return { problem: `bash.exe does not exist: ${trimmed}` }
  const root = deriveRootFromBash(trimmed)
  if (root === undefined) {
    return { problem: `cannot derive the install root from ${trimmed}; expected <root>\\bin\\bash.exe or <root>\\usr\\bin\\bash.exe` }
  }
  const flavor = detectFlavor(root)
  if (flavor === 'git') {
    if (msystem !== 'auto' && msystem !== 'MINGW64') {
      return { problem: `Git for Windows only supports MSYSTEM=MINGW64, got ${msystem}` }
    }
    return { profile: makeProfile('git', root, canonicalGitBash(trimmed, root), 'MINGW64', probe) }
  }
  if (flavor === 'cygwin') {
    if (msystem !== 'auto') {
      return { problem: `Cygwin does not use MSYSTEM; set msystem to auto, got ${msystem}` }
    }
    return { profile: makeProfile('cygwin', root, trimmed, undefined, probe) }
  }
  const selected = msystem === 'auto' ? defaultMsystemFor(root) : msystem
  const envRoot = environmentRootFor(root, selected)
  if (envRoot === undefined || !isDirectory(winJoin(envRoot, 'bin'))) {
    return { problem: `MSYS2 environment ${selected} is not installed under ${root}` }
  }
  return { profile: makeProfile('msys2', root, trimmed, selected, probe) }
}

/** `where.exe` output lines that look like absolute paths. */
function wherePaths(name: string): string[] {
  try {
    const result = spawnSync('where.exe', [name], { timeout: 2000, windowsHide: true, encoding: 'utf8' })
    if (result.status !== 0 || typeof result.stdout !== 'string') return []
    return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(line => /^[a-zA-Z]:\\/.test(line))
  } catch {
    return []
  }
}

/** Registry `InstallPath` values for Git for Windows. */
function registryGitRoots(): string[] {
  const roots: string[] = []
  for (const key of ['HKLM\\SOFTWARE\\GitForWindows', 'HKCU\\SOFTWARE\\GitForWindows']) {
    try {
      const result = spawnSync('reg.exe', ['query', key, '/v', 'InstallPath'], {
        timeout: 2000,
        windowsHide: true,
        encoding: 'utf8',
      })
      if (result.status !== 0 || typeof result.stdout !== 'string') continue
      const match = /InstallPath\s+REG_SZ\s+(.+)/i.exec(result.stdout)
      const value = match?.[1]?.trim()
      if (value !== undefined && value.length > 0) roots.push(value)
    } catch {
      // Registry is optional; a locked/absent key is not an error.
    }
  }
  return roots
}

/** Standard install roots, derived from the ambient environment. */
function knownRoots(env: NodeJS.ProcessEnv): string[] {
  const roots: string[] = []
  const programFiles = env.ProgramFiles ?? env.PROGRAMFILES
  const programFilesX86 = env['ProgramFiles(x86)'] ?? env['PROGRAMFILES(X86)']
  const localAppData = env.LOCALAPPDATA
  const systemDrive = env.SystemDrive ?? 'C:'
  if (programFiles !== undefined) {
    roots.push(winJoin(programFiles, 'Git'))
    roots.push(winJoin(programFiles, 'Git for Windows'))
  }
  if (programFilesX86 !== undefined) roots.push(winJoin(programFilesX86, 'Git'))
  if (localAppData !== undefined) {
    roots.push(winJoin(localAppData, 'Programs', 'Git'))
    roots.push(winJoin(localAppData, 'msys64'))
  }
  roots.push(
    'C:\\Git',
    'D:\\Git',
    'C:\\msys64',
    'D:\\msys64',
    'C:\\msys32',
    'C:\\cygwin64',
    'C:\\cygwin',
    winJoin(systemDrive, 'msys64'),
  )
  return roots
}

/** Candidate install roots from PATH entries (dir itself or its install root). */
function rootsFromPath(env: NodeJS.ProcessEnv): string[] {
  const roots: string[] = []
  const path = env.PATH ?? env.Path ?? ''
  for (const entry of path.split(';')) {
    const dir = entry.trim().replace(/^"|"$/g, '')
    if (dir.length === 0) continue
    if (isFile(winJoin(dir, 'bash.exe'))) {
      const root = deriveRootFromBash(winJoin(dir, 'bash.exe'))
      if (root !== undefined) roots.push(root)
    }
    if (isFile(winJoin(dir, 'git.exe'))) {
      const root = deriveRootFromGit(winJoin(dir, 'git.exe'))
      if (root !== undefined) roots.push(root)
    }
  }
  return roots
}

/** Merge duplicate roots case-insensitively, preserving order. */
function uniqueRoots(roots: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const root of roots) {
    const trimmed = root.trim().replace(/^"|"$/g, '')
    if (trimmed.length === 0) continue
    const key = normalizePathKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/** Sort: Git first, then MSYS2 (UCRT64 first), then Cygwin; valid before invalid. */
function compareProfiles(a: BashProfile, b: BashProfile): number {
  const rank = (profile: BashProfile): number => {
    if (profile.flavor === 'git') return 0
    if (profile.flavor === 'msys2') return 1 + MSYS2_ENVIRONMENTS.findIndex(env => env.msystem === profile.msystem) / 100
    return 2
  }
  const byKind = rank(a) - rank(b)
  if (byKind !== 0) return byKind
  if (a.valid !== b.valid) return a.valid ? -1 : 1
  return a.path.localeCompare(b.path)
}

/** Scan the machine for bash profiles. */
export function discoverBash(options: {
  savedPath?: string
  msystem?: MsystemSetting
  probe?: boolean
  full?: boolean
  env?: NodeJS.ProcessEnv
  platform?: string
} = {}): DiscoverResult {
  const platform = options.platform ?? process.platform
  if (platform !== 'win32') {
    return { candidates: [], notes: [`bash discovery is Windows-only (platform: ${platform})`] }
  }
  const env = options.env ?? process.env
  const probe = options.probe ?? false
  const full = options.full ?? true
  const notes: string[] = []
  const roots: string[] = []

  if (options.savedPath !== undefined && options.savedPath.trim().length > 0) {
    const root = deriveRootFromBash(stripMatchingQuotes(options.savedPath))
    if (root !== undefined) roots.push(root)
  }
  if (full) {
    roots.push(...registryGitRoots())
    for (const path of wherePaths('git')) {
      const root = deriveRootFromGit(path)
      if (root !== undefined) roots.push(root)
    }
    for (const path of wherePaths('bash')) {
      const root = deriveRootFromBash(path)
      if (root !== undefined) roots.push(root)
    }
  }
  roots.push(...knownRoots(env), ...rootsFromPath(env))

  const byId = new Map<string, BashProfile>()
  for (const root of uniqueRoots(roots)) {
    for (const profile of profilesForRoot(root, probe)) {
      const existing = byId.get(profile.id)
      if (existing === undefined) {
        byId.set(profile.id, profile)
      } else if (existing.version === undefined && profile.version !== undefined) {
        byId.set(profile.id, { ...existing, version: profile.version, valid: profile.valid, ...profile.problem !== undefined ? { problem: profile.problem } : {} })
      }
    }
  }

  const candidates = [...byId.values()].sort(compareProfiles)
  if (candidates.length === 0) {
    notes.push('no Git for Windows / MSYS2 / Cygwin installation was found')
  } else if (!candidates.some(profile => profile.valid)) {
    notes.push('installations were found but none is usable; check the path and MSYS2 environment')
  }
  const recommended = candidates.find(profile => profile.valid)
  return { candidates, ...recommended !== undefined ? { recommended } : {}, notes }
}

/** Cached scanner: one full pass at startup, refreshed by the settings button. */
export interface DiscoveryCache {
  get(): DiscoverResult
  refresh(options?: { savedPath?: string; msystem?: MsystemSetting; probe?: boolean }): DiscoverResult
}

/** Create a lazily-filled discovery cache. */
export function createDiscoveryCache(initial?: DiscoverResult): DiscoveryCache {
  let current = initial
  return {
    get() {
      current ??= discoverBash({ full: true })
      return current
    },
    refresh(options = {}) {
      current = discoverBash({ full: true, probe: true, ...options })
      return current
    },
  }
}

/** Resolve the configured path or the cached recommendation. */
export function resolveEffectiveProfile(
  settings: TerminalToolSettings,
  cache: DiscoveryCache,
  probe = false,
): ResolveProfileResult {
  if (settings.bashPath.length > 0) {
    return profileFromPath(settings.bashPath, settings.msystem, probe)
  }
  const discovered = cache.get()
  if (discovered.recommended === undefined) {
    return { problem: discovered.notes[0] ?? 'no usable Git Bash / MSYS2 installation found' }
  }
  return { profile: discovered.recommended }
}
