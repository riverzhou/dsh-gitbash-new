/**
 * Model-facing rendering for the bash tool.
 *
 * The Web UI does not call `presentResult`; it derives the terminal card from
 * the tool name (`bash`), the raw args, the result text markers, and
 * `meta.cwd`. The marker strings below are therefore part of the UI contract,
 * not cosmetic: `[exit code: N]` and `[killed by signal: X]` must stay the last
 * line, `[stderr]` must head the merged error section, and the truncation note
 * must carry the spill path.
 */

/** One captured stream. */
export interface CollectedOutputLike {
  text: string
  truncated: boolean
  spillPath?: string
}

/** Sandbox facts for one run. */
export interface SandboxInfoLike {
  mode: string
  denied: boolean
  enforcement?: string
  runnerFailed?: boolean
}

/** The canonical foreground value. */
export interface ForegroundValue {
  kind: 'foreground'
  cwd: string
  exitCode: number | null
  signal: string | null
  timedOut: boolean
  aborted: boolean
  stopped?: string
  timeoutMs: number
  stdout: CollectedOutputLike
  stderr: CollectedOutputLike
  sandbox?: SandboxInfoLike
  /** True when Git Bash ran outside the DSH sandbox (compat mode). */
  compat?: boolean
  /** The session's requested sandbox mode when `compat` is true. */
  sessionMode?: string
}

/** A promoted foreground call. */
export interface PromotedValue {
  kind: 'promoted'
  cwd: string
  jobId: string
  timeoutMs: number
  output: string
  compat?: boolean
  sessionMode?: string
}

/** A background acknowledgement. */
export interface BackgroundValue {
  kind: 'background'
  jobId: string
  cwd: string
  compat?: boolean
  sessionMode?: string
}

export type BashValue = ForegroundValue | PromotedValue | BackgroundValue

/** Append the truncation notice with the spill path. */
export function streamText(output: CollectedOutputLike): string {
  if (!output.truncated) return output.text
  return `${output.text}\n[output truncated; full output: ${output.spillPath ?? '(unavailable)'}]`
}

/** The compat-mode note, inserted before the terminal markers. */
export function compatNote(value: { compat?: boolean; sessionMode?: string }): string | undefined {
  if (value.compat !== true) return undefined
  return `[compat: bash runs outside the DSH file sandbox (session mode ${value.sessionMode ?? 'workspace-write'})]`
}

/**
 * Split the rendered text into the output body and the terminal exit status.
 * The consumed marker is removed because the card shows it as a pill.
 */
export function parseExitStatus(text: string): { body: string } & ({ exitCode: number } | { signal: string }) {
  const signal = /\n\[killed by signal: ([^\]\n]+)\]$/.exec(text)
  if (signal?.[1] !== undefined) return { body: text.slice(0, signal.index), signal: signal[1] }
  const exit = /\n\[exit code: (\d+)\]$/.exec(text)
  if (exit?.[1] !== undefined) return { body: text.slice(0, exit.index), exitCode: Number(exit[1]) }
  return { body: text, exitCode: 0 }
}

/** Render one settled foreground result for the model. */
export function renderResult(result: ForegroundValue): string {
  const out = streamText(result.stdout)
  const err = streamText(result.stderr)
  let body = out
  if (err.length > 0) {
    if (body.length > 0 && !body.endsWith('\n')) body += '\n'
    body += `[stderr]\n${err}`
  }
  if (body.length === 0) body = '(no output)'
  const notes: string[] = []
  const compat = compatNote(result)
  if (compat !== undefined) notes.push(compat)
  if (result.timedOut) notes.push(`[timed out after ${result.timeoutMs}ms]`)
  if (result.stopped !== undefined) notes.push(`[stopped: ${result.stopped}]`)
  if (result.signal !== null) notes.push(`[killed by signal: ${result.signal}]`)
  else if (result.exitCode !== 0) notes.push(`[exit code: ${result.exitCode}]`)
  if (notes.length === 0) return body
  if (!body.endsWith('\n')) body += '\n'
  return body + notes.join('\n')
}

/** Render a foreground call that stopped waiting and moved to a background job. */
export function renderPromoted(promoted: PromotedValue): string {
  const body = promoted.output.length > 0
    ? promoted.output.endsWith('\n') ? promoted.output : `${promoted.output}\n`
    : ''
  const compat = compatNote(promoted)
  return `${body}${compat !== undefined ? `${compat}\n` : ''}[still running after ${promoted.timeoutMs}ms; moved to background job ${promoted.jobId}]\n`
    + 'The command keeps running in the background. You will be notified when it finishes; '
    + 'read newer output with job_output, stop it with job_kill.'
}

/** Render a background job's later output read (used by job tools, not this tool). */
export function renderJobRead(delta: string, lossy: boolean, spillPaths: readonly string[]): string {
  if (!lossy) return delta
  const notice = `[some output was dropped from memory; full output: ${spillPaths.length > 0 ? spillPaths.join(', ') : '(unavailable)'}]`
  return `${delta}${delta.length > 0 && !delta.endsWith('\n') ? '\n' : ''}${notice}`
}

/** Merge a job's ring chunks the way the tool's promoted output reads. */
export function ringDelta(chunks: readonly { text: string; channel?: string }[]): string {
  const out = chunks.filter(chunk => chunk.channel !== 'stderr').map(chunk => chunk.text).join('')
  const err = chunks.filter(chunk => chunk.channel === 'stderr').map(chunk => chunk.text).join('')
  const separator = out.length > 0 && !out.endsWith('\n') ? '\n' : ''
  return out + (err.length > 0 ? `${separator}[stderr]\n${err}` : '')
}

/** Detect the MSYS2 startup failure that can masquerade as exit 0 with no output. */
export function detectStartupFailure(stderr: string): string | undefined {
  if (/\*\*\* fatal error\s*-/.test(stderr)) return firstLine(stderr)
  if (/couldn't create signal pipe/i.test(stderr)) return firstLine(stderr)
  if (/CreateFileMapping .*Win32 error 5/i.test(stderr)) return firstLine(stderr)
  return undefined
}

/** First non-empty line, bounded for a marker. */
function firstLine(text: string): string | undefined {
  const line = text.split(/\r?\n/).map(item => item.trim()).find(item => item.length > 0)
  return line === undefined ? undefined : line.slice(0, 300)
}

/** Job outcome text for both startup and exit. */
export function outcomeDetail(status: 'completed' | 'killed' | 'failed', exitCode: number | null, signal: string | null): string {
  if (status === 'killed') return signal !== null ? `signal: ${signal}` : 'killed before exit'
  if (status === 'failed') return 'failed before exit'
  return `exit code: ${exitCode ?? 0}`
}
