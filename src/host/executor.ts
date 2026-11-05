/**
 * One bash execution over `ctx.subprocess`.
 *
 * This is the only place that spawns a process. It owns the deadline,
 * cancellation cause, collected-output projection, and the MSYS2 startup
 * failure guard. Jobs, rendering, and the tool layer consume its handle.
 */
import { constants } from 'node:os'
import type { BashProfile } from './discover.ts'
import { detectStartupFailure, type CollectedOutputLike, type ForegroundValue } from './render.ts'
import type {
  SubprocessHandleLike,
  SubprocessOutputReaderLike,
  SubprocessServiceLike,
} from './types.ts'

/** A spawn failure that is not a normal command exit. */
export class BashSpawnError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BashSpawnError'
  }
}

/** Inputs for one execution. */
export interface BashExecRequest {
  readonly command: string
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
  /** `kill`: arm this deadline; `none`: the caller owns termination. */
  readonly onExpiry: 'kill' | 'none'
  readonly timeoutMs: number
  readonly signal?: AbortSignal
  readonly graceMs?: number
  readonly stdoutMaxBytes?: number
  readonly maxSpillBytes?: number
}

/** One stream reader pair exposed to the job registry. */
export interface BashObserved {
  readonly stdout: SubprocessOutputReaderLike
  readonly stderr: SubprocessOutputReaderLike
}

/** The handle the tool and jobs consume. */
export interface BashExecution {
  readonly status: 'running' | 'completed' | 'killed'
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  /** MSYS2 startup failure detected from stderr and converted to a failure. */
  readonly startupFailure?: string
  readonly observed: BashObserved
  readonly done: Promise<void>
  kill(): void
  readOutput(): {
    delta: string
    lossy: boolean
    stdoutSpillPath?: string
    stderrSpillPath?: string
  }
  result(): Promise<ForegroundValue>
}

/** Defaults mirrored from the official bash executor. */
export const EXEC_DEFAULTS = {
  timeoutMs: 120_000,
  maxTimeoutMs: 600_000,
  stdoutMaxBytes: 64_000,
  maxSpillBytes: 64 * 1024 * 1024,
  graceMs: 3_000,
} as const

/** Clamp a requested timeout to the executor's default/cap. */
export function clampTimeout(requested: number | undefined): number {
  if (requested === undefined) return EXEC_DEFAULTS.timeoutMs
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(requested)}`)
  }
  return Math.min(requested, EXEC_DEFAULTS.maxTimeoutMs)
}

/** Signal names for the numeric values `os.constants.signals` exposes. */
const SIGNAL_NAMES: ReadonlyMap<number, NodeJS.Signals> = (() => {
  const names = new Map<number, NodeJS.Signals>()
  for (const [name, number] of Object.entries(constants.signals)) {
    if (typeof number !== 'number' || number <= 0 || number > 64 || names.has(number)) continue
    names.set(number, name as NodeJS.Signals)
  }
  return names
})()

/**
 * Normalize a Windows process outcome.
 *
 * MSYS2 and Git Bash encode death-by-signal as `signalNumber << 8` in the
 * Windows exit code (`kill -TERM $$` → 3840, `kill -KILL $$` → 2304), while
 * Node always reports `signal: null` on Windows. A normal `exit N` is masked
 * to 0..255, so a non-zero multiple of 256 is the signal encoding. Without
 * this, the tool renders `[exit code: 3840]` and jobs look completed.
 *
 * @param exitCode - the Windows process exit code, or null when unknown.
 * @param signal - the provider's signal, null on Windows.
 * @param platform - override for tests.
 * @returns a POSIX-shaped exit code or signal name.
 */
export function normalizeWindowsExit(
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  platform: NodeJS.Platform = process.platform,
): { exitCode: number | null; signal: NodeJS.Signals | null } {
  if (platform !== 'win32' || signal !== null || exitCode === null || exitCode <= 0xFF) {
    return { exitCode, signal }
  }
  if (exitCode % 0x100 !== 0) return { exitCode, signal }
  const name = SIGNAL_NAMES.get(exitCode >>> 8)
  return name === undefined ? { exitCode, signal } : { exitCode: null, signal: name }
}

/** Empty reader used only when the provider drops a requested collect stream. */
const EMPTY_READER: SubprocessOutputReaderLike = {
  readFrom: from => ({ text: '', nextOffset: from, lossy: false }),
}

/** Spawn bash and return its live handle. */
export function createBashExecution(
  subprocess: SubprocessServiceLike,
  profile: BashProfile,
  request: BashExecRequest,
): BashExecution {
  if (request.signal?.aborted === true) {
    throw request.signal.reason instanceof Error ? request.signal.reason : new Error('tool call aborted')
  }
  const stdoutMaxBytes = request.stdoutMaxBytes ?? EXEC_DEFAULTS.stdoutMaxBytes
  const maxSpillBytes = request.maxSpillBytes ?? EXEC_DEFAULTS.maxSpillBytes
  const graceMs = request.graceMs ?? EXEC_DEFAULTS.graceMs
  const controller = new AbortController()
  let handle: SubprocessHandleLike
  try {
    handle = subprocess.spawn({
      argv: [profile.path, '-c', request.command],
      cwd: request.cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: stdoutMaxBytes, spill: { maxBytes: maxSpillBytes } },
        stderr: { maxBytes: stdoutMaxBytes, spill: { maxBytes: maxSpillBytes } },
      },
      graceMs,
      signal: controller.signal,
      env: request.env,
    })
  } catch (error) {
    throw new BashSpawnError(spawnMessage(profile, error))
  }

  let status: 'running' | 'completed' | 'killed' = 'running'
  let exitCode: number | null = null
  let signal: NodeJS.Signals | null = null
  let timedOut = false
  let aborted = false
  let externalKill = false
  let finished = false
  let startupFailure: string | undefined
  let providerError: unknown
  let stdoutOffset = 0
  let stderrOffset = 0
  let timer: NodeJS.Timeout | undefined

  const stdout = handle.collected.stdout ?? EMPTY_READER
  const stderr = handle.collected.stderr ?? EMPTY_READER

  const stop = (): void => {
    try {
      controller.abort()
    } catch {
      // Aborting the spawn signal is best-effort; terminate is the fallback.
    }
    try {
      handle.terminate()
    } catch {
      // terminate is idempotent; a provider-side failure surfaces on done.
    }
  }

  const onAbort = (): void => {
    if (finished) return
    if (!timedOut) aborted = true
    stop()
  }

  const onTimeout = (): void => {
    // First cause wins: an abort or an external kill that already stopped the
    // process must not retroactively become a timeout.
    if (finished || aborted || externalKill) return
    timedOut = true
    stop()
  }

  if (request.signal !== undefined) {
    request.signal.addEventListener('abort', onAbort, { once: true })
  }
  if (request.onExpiry === 'kill') {
    timer = setTimeout(onTimeout, request.timeoutMs)
    timer.unref?.()
  }

  const done = (async (): Promise<void> => {
    try {
      const outcome = await handle.done
      const normalized = normalizeWindowsExit(outcome.exitCode, outcome.signal)
      exitCode = normalized.exitCode
      signal = normalized.signal
      // Startup failures can masquerade as exit 0 with no stdout. Detect them
      // here (not only in result()) so jobs report the same failure.
      if ((exitCode === 0 || exitCode === null) && stdout.readFrom(0).text.length === 0) {
        const failure = detectStartupFailure(stderr.readFrom(0).text)
        if (failure !== undefined) {
          startupFailure = failure
          exitCode = 1
        }
      }
      if (timedOut || aborted || externalKill || signal !== null) status = 'killed'
      else status = 'completed'
    } catch (error) {
      // Aborting the spawn signal can make the provider reject `done`; that is
      // the expected cancellation path, not a spawn failure.
      if (!timedOut && !aborted && !externalKill) providerError = error
      status = 'killed'
    } finally {
      finished = true
      if (timer !== undefined) clearTimeout(timer)
      request.signal?.removeEventListener('abort', onAbort)
    }
  })()

  return {
    get status() { return status },
    get exitCode() { return exitCode },
    get signal() { return signal },
    get startupFailure() { return startupFailure },
    observed: { stdout, stderr },
    done,
    kill() {
      if (finished) return
      externalKill = true
      stop()
    },
    readOutput() {
      const out = stdout.readFrom(stdoutOffset)
      const err = stderr.readFrom(stderrOffset)
      stdoutOffset = out.nextOffset
      stderrOffset = err.nextOffset
      const separator = out.text.length > 0 && !out.text.endsWith('\n') ? '\n' : ''
      const delta = out.text + (err.text.length > 0 ? `${separator}[stderr]\n${err.text}` : '')
      return {
        delta,
        lossy: out.lossy || err.lossy,
        ...out.spillPath !== undefined ? { stdoutSpillPath: out.spillPath } : {},
        ...err.spillPath !== undefined ? { stderrSpillPath: err.spillPath } : {},
      }
    },
    async result(): Promise<ForegroundValue> {
      await done
      if (providerError !== undefined) {
        throw new BashSpawnError(spawnMessage(profile, providerError))
      }
      const out = collect(stdout)
      let err = collect(stderr)
      if (startupFailure !== undefined) {
        err = { ...err, text: `${err.text}\n[bash startup failed: ${startupFailure}]` }
      }
      const value: ForegroundValue = {
        kind: 'foreground',
        cwd: request.cwd,
        exitCode,
        signal,
        timedOut,
        aborted,
        timeoutMs: request.timeoutMs,
        stdout: out,
        stderr: err,
      }
      return value
    },
  }
}

/** Project one collect reader into the canonical collected output. */
function collect(reader: SubprocessOutputReaderLike): CollectedOutputLike {
  const read = reader.readFrom(0)
  return {
    text: read.text,
    truncated: read.lossy,
    ...read.spillPath !== undefined ? { spillPath: read.spillPath } : {},
  }
}

/** Build a concise, actionable spawn error. */
function spawnMessage(profile: BashProfile, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  return `bash could not start (${profile.label} at ${profile.path}): ${detail}. `
    + 'Re-run "auto discover" in Settings → General → Terminal tool, or fix the path.'
}
