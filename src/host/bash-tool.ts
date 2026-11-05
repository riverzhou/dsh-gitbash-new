/**
 * The model-facing `bash` tool.
 *
 * It mirrors the official `@deepseek-ai/dsh-tool-bash` contract: the same
 * parameter vocabulary, the same closed output union, the same marker strings,
 * the same job/promote choreography, and the same `presentationMeta.cwd`. The
 * only deliberate divergence is the Windows sandbox story: Git Bash/MSYS2
 * cannot start under DSH's ACL restricted token, so the tool runs bash
 * unconfined and says so, instead of pretending to be confined.
 */
import type { BashProfile } from './discover.ts'
import { composeEnv, resolveWorkdir } from './env.ts'
import {
  approvalFor,
  approveEscalation,
  ESCALATION_TARGETS,
  escalationHintMarker,
  sandboxPermissionsDescription,
  validateEscalationArgs,
  type SandboxMode,
} from './escalation.ts'
import { clampTimeout, createBashExecution, type BashExecution } from './executor.ts'
import { processJob, processOutcome, processSources, ringDelta } from './jobs.ts'
import {
  compatNote,
  parseExitStatus,
  renderPromoted,
  renderResult,
  type BackgroundValue,
  type BashValue,
  type ForegroundValue,
  type PromotedValue,
  type SandboxInfoLike,
} from './render.ts'
import type {
  ApprovalServiceLike,
  ContentBlockLike,
  GenericCallViewLike,
  GenericResultViewLike,
  JobReadLike,
  JobRegistryLike,
  JobViewLike,
  ParameterSpecLike,
  SandboxPolicyLike,
  SandboxPolicyServiceLike,
  ShellEnvServiceLike,
  ShellServiceLike,
  SubprocessServiceLike,
  TerminalCallViewLike,
  TerminalResultViewLike,
  ToolCallViewLike,
  ToolDefinitionLike,
  ToolExecutionLike,
  ToolResultLike,
  ToolResultViewLike,
  WorkingDirectoryServiceLike,
} from './types.ts'
import type { CompatMode } from '../shared/protocol.ts'

/** Runtime services the tool needs; all but subprocess are optional. */
export interface BashToolRuntime {
  readonly subprocess: SubprocessServiceLike
  readonly profile: BashProfile
  readonly compat: CompatMode
  readonly jobs?: JobRegistryLike | undefined
  readonly sandboxPolicy?: SandboxPolicyServiceLike | undefined
  readonly shell?: ShellServiceLike | undefined
  readonly shellEnv?: ShellEnvServiceLike | undefined
  readonly workingDirectory?: WorkingDirectoryServiceLike | undefined
  readonly approval?: ApprovalServiceLike | undefined
  /** Other bash install roots whose PATH entries must not leak into this profile. */
  readonly foreignRoots?: readonly string[] | undefined
  readonly warn?: (message: string) => void
}

/** Parsed tool arguments. */
interface BashArgs {
  command: string
  description: string
  timeoutMs?: number
  workdir?: string
  run_in_background?: boolean
  sandbox_permissions?: string
  justification?: string
}

interface StartedJob {
  readonly id: string
  readonly process: () => BashExecution | undefined
  readonly stopped: () => string | undefined
}

/** A structured abort recognized by the dispatcher. */
function toolAborted(): Error {
  const error = new Error('tool call aborted')
  error.name = 'AbortError'
  ;(error as { code?: string }).code = 'ABORTED'
  return error
}

/** Validate everything the parameter schema cannot express. */
function validateBashArgs(args: BashArgs, effectiveMode: SandboxMode | undefined): void {
  if (args.command.trim().length === 0) throw new Error('invalid command: expected a non-empty string')
  if (args.description.trim().length === 0) throw new Error('invalid description: expected a non-empty string')
  if (args.timeoutMs !== undefined && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
    throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(args.timeoutMs)}`)
  }
  // The official rule: repeating the call's effective mode needs no pairing.
  if (args.sandbox_permissions !== undefined && args.sandbox_permissions === effectiveMode) return
  const justification = args.sandbox_permissions === undefined && args.justification?.trim() === ''
    ? undefined
    : args.justification
  validateEscalationArgs(args.sandbox_permissions, justification)
}

/** Read the typed arguments from the dispatcher's raw record. */
function parseArgs(raw: Record<string, unknown>): BashArgs {
  const string = (key: string): string | undefined => {
    const value = raw[key]
    if (value === undefined) return undefined
    if (typeof value !== 'string') throw new Error(`invalid ${key}: expected a string`)
    return value
  }
  const description = string('description')
  const command = string('command')
  if (description === undefined) throw new Error('missing required argument: description')
  if (command === undefined) throw new Error('missing required argument: command')
  const timeout = raw.timeoutMs
  if (timeout !== undefined && typeof timeout !== 'number') throw new Error('invalid timeoutMs: expected a number')
  const background = raw.run_in_background
  if (background !== undefined && typeof background !== 'boolean') {
    throw new Error('invalid run_in_background: expected a boolean')
  }
  const workdir = string('workdir')
  const sandboxPermissions = string('sandbox_permissions')
  const justification = string('justification')
  return {
    command,
    description,
    ...timeout !== undefined ? { timeoutMs: timeout } : {},
    ...workdir !== undefined ? { workdir } : {},
    ...background !== undefined ? { run_in_background: background } : {},
    ...sandboxPermissions !== undefined ? { sandbox_permissions: sandboxPermissions } : {},
    ...justification !== undefined ? { justification } : {},
  }
}

/** The model-facing description, adapted to the features actually available. */
function bashDescription(runtime: BashToolRuntime, background: boolean, promote: boolean, escalation: boolean): string {
  const profile = runtime.profile
  const features: string[] = [
    `Execute a bash command (\`bash -c\`) through ${profile.label} on Windows and return its stdout/stderr.`,
    'Each call runs in a fresh shell; pass `workdir` instead of using `cd`.',
    'Use POSIX paths (`/c/...`, `/d/...`) and `$VAR`; do not use PowerShell syntax or `C:\\` backslash paths.',
    'Managed `$DSH_*` variables expose current harness environment facts.',
    'Long output is truncated to its tail; the full output is saved to a file whose path is reported when available.',
    'Provide `description` before `command` in the arguments.',
    'Before any delete or move, verify that the resolved absolute target path is the intended one; never run it against a computed path you have not checked.',
    'An unset variable expands to an empty string, so guard variables in such paths with `${VAR:?}`.',
  ]
  if (background) {
    features.push('Use `run_in_background` for long-running work; collect with job_output and stop with job_kill.')
  }
  if (promote) {
    features.push('When a foreground call reaches its timeout, the command moves to the background instead of being killed.')
  }
  if (escalation) {
    features.push('If the session policy blocks this command, retry once with `sandbox_permissions` (the narrowest wider mode) plus a one-sentence `justification`; the user is asked for approval.')
  }
  if (runtime.compat === 'auto') {
    features.push('This deployment runs bash outside the DSH file sandbox when the session mode is workspace-write, because the MSYS2 runtime cannot start under the Windows restricted token. A trailing `[compat: ...]` line is a deployment notice, not command output. Treat paths outside the workspace as read-only unless the user explicitly asks otherwise.')
  } else {
    features.push('This deployment allows bash only under danger-full-access; under read-only/workspace-write the call is refused instead of silently widening permissions.')
  }
  return features.join(' ')
}

/** Parameter JSON Schema (the tool registry takes raw JSON Schema here). */
function bashParameters(background: boolean, promotion: boolean, escalation: readonly SandboxMode[]): unknown {
  const properties: Record<string, unknown> = {
    description: {
      type: 'string',
      description: 'Clear, concise description of what this command does in active voice, 5-10 words (shown in the UI). '
        + 'Examples: "ls" → "List files in current directory"; "git status" → "Show working tree status".',
    },
    command: { type: 'string', description: 'The bash command to execute.' },
    timeoutMs: {
      type: 'number',
      description: promotion
        ? 'Timeout in milliseconds. The executor applies its configured default and cap; on expiry the command moves to the background as a job instead of being killed.'
        : 'Timeout in milliseconds. The executor applies its configured default and cap, and kills the command on expiry.',
    },
    workdir: {
      type: 'string',
      description: 'Working directory for this command. Defaults to the session workspace; a relative path is resolved against it.',
    },
  }
  if (background) {
    properties.run_in_background = {
      type: 'boolean',
      description: 'Run in the background and return a job id immediately (collect with job_output, stop with job_kill). No timeout applies.',
    }
  }
  if (escalation.length > 0) {
    properties.sandbox_permissions = {
      type: 'string',
      enum: [...escalation],
      description: sandboxPermissionsDescription('command'),
    }
    properties.justification = {
      type: 'string',
      description: 'Required with sandbox_permissions: one sentence for the user explaining why this exact command needs the wider access. Use the language of the user’s current request.',
    }
  }
  return { type: 'object', properties, required: ['command', 'description'] }
}

/** The closed output schema (standard JSON Schema; output schemas are not the parameter DSL). */
function bashOutputSchema(): unknown {
  const compatProperties = {
    compat: { type: 'boolean' },
    sessionMode: { type: 'string' },
  }
  return {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'jobId', 'cwd'],
        properties: {
          kind: { type: 'string', const: 'background' },
          jobId: { type: 'string' },
          cwd: { type: 'string' },
          ...compatProperties,
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'cwd', 'jobId', 'timeoutMs', 'output'],
        properties: {
          kind: { type: 'string', const: 'promoted' },
          cwd: { type: 'string' },
          jobId: { type: 'string' },
          timeoutMs: { type: 'number' },
          output: { type: 'string' },
          ...compatProperties,
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'cwd', 'exitCode', 'signal', 'timedOut', 'aborted', 'timeoutMs', 'stdout', 'stderr'],
        properties: {
          kind: { type: 'string', const: 'foreground' },
          cwd: { type: 'string' },
          exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
          signal: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          timedOut: { type: 'boolean' },
          aborted: { type: 'boolean' },
          stopped: { type: 'string' },
          timeoutMs: { type: 'number' },
          stdout: {
            type: 'object',
            additionalProperties: false,
            required: ['text', 'truncated'],
            properties: {
              text: { type: 'string' },
              truncated: { type: 'boolean' },
              spillPath: { type: 'string' },
            },
          },
          stderr: {
            type: 'object',
            additionalProperties: false,
            required: ['text', 'truncated'],
            properties: {
              text: { type: 'string' },
              truncated: { type: 'boolean' },
              spillPath: { type: 'string' },
            },
          },
          sandbox: {
            type: 'object',
            additionalProperties: false,
            required: ['mode', 'denied'],
            properties: {
              mode: { type: 'string' },
              denied: { type: 'boolean' },
              enforcement: { type: 'string' },
              runnerFailed: { type: 'boolean' },
            },
          },
          ...compatProperties,
        },
      },
    ],
  }
}

/** Present a call to external UI bridges. The Web UI derives its own card. */
function presentCall(args: unknown): ToolCallViewLike {
  const record = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {}
  const command = typeof record.command === 'string' ? record.command : ''
  const description = typeof record.description === 'string' ? record.description : ''
  if (record.run_in_background === true) {
    const view: GenericCallViewLike = {
      card: 'generic',
      title: command,
      kind: 'execute',
      rawInput: command,
      content: [{ type: 'text', text: description }],
    }
    return view
  }
  const view: TerminalCallViewLike = {
    card: 'terminal',
    title: command,
    description,
    ...typeof record.workdir === 'string' ? { cwd: record.workdir } : {},
  }
  return view
}

/** Present a completed result to external UI bridges. */
function presentResult(args: unknown, result: ToolResultLike): ToolResultViewLike | undefined {
  const block = result.content.length === 1 ? result.content[0] : undefined
  if (block === undefined || block.type !== 'text') return undefined
  const raw = block.text
  const record = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {}
  const isBackground = record.run_in_background === true
  const isPromoted = (result.value as { kind?: unknown } | undefined)?.kind === 'promoted'
  if (isBackground || isPromoted || result.isError === true) {
    const view: GenericResultViewLike = {
      card: 'generic',
      content: [{ type: 'text', text: `\`\`\`console\n${raw.replace(/\n+$/, '')}\n\`\`\`` }],
    }
    return view
  }
  const parsed = parseExitStatus(raw)
  const view: TerminalResultViewLike = 'signal' in parsed
    ? { card: 'terminal', output: parsed.body, signal: parsed.signal }
    : 'unavailable' in parsed
      ? { card: 'terminal', output: parsed.body }
      : { card: 'terminal', output: parsed.body, exitCode: parsed.exitCode }
  return view
}

/** The runtime result of one tool execution. */
export function createBashTool(runtime: BashToolRuntime): ToolDefinitionLike {
  const backgroundEnabled = runtime.jobs !== undefined && typeof runtime.jobs.start === 'function'
  const promote = backgroundEnabled && typeof runtime.jobs?.wait === 'function'
    && typeof runtime.jobs?.read === 'function'
    && typeof runtime.jobs?.kill === 'function'
    && typeof runtime.jobs?.remove === 'function'
  const escalationModes: readonly SandboxMode[] = runtime.shell?.sandboxMode !== undefined && runtime.sandboxPolicy !== undefined
    ? ESCALATION_TARGETS
    : []
  const description = bashDescription(runtime, backgroundEnabled, promote, escalationModes.length > 0)
  const parameters = bashParameters(backgroundEnabled, promote, escalationModes)
  const outputSchema = bashOutputSchema()

  const resolvePolicy = (exec: ToolExecutionLike): SandboxPolicyLike => {
    if (runtime.sandboxPolicy === undefined) {
      throw new Error(
        'sandbox policy service is unavailable; refusing to run bash without a known session mode '
        + '(read-only / workspace-write / danger-full-access)',
      )
    }
    const resolved = runtime.sandboxPolicy.resolve(exec.agent !== undefined ? { session: exec.agent.session } : {})
    const validModes: readonly SandboxMode[] = ['read-only', 'workspace-write', 'danger-full-access']
    if (resolved === undefined || resolved === null || !validModes.includes(resolved.mode as SandboxMode)) {
      throw new Error(
        'sandbox policy is unavailable or invalid; refusing to run bash without a known session mode '
        + '(read-only / workspace-write / danger-full-access)',
      )
    }
    return resolved
  }

  const resolveCwd = async (exec: ToolExecutionLike): Promise<string> => {
    let cwd: string | undefined
    if (exec.agent !== undefined && runtime.workingDirectory !== undefined) {
      try {
        cwd = await runtime.workingDirectory.ensure(exec.agent, exec.signal)
      } catch (error) {
        if (exec.signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw toolAborted()
        cwd = undefined
      }
    }
    if (cwd === undefined) cwd = exec.agent?.session.header?.cwd
    return cwd ?? process.cwd()
  }

  const collectDshEnv = (exec: ToolExecutionLike): Record<string, string> => {
    try {
      return runtime.shellEnv?.collect(exec) ?? {}
    } catch {
      return {}
    }
  }

  const startJob = (args: BashArgs, exec: ToolExecutionLike, env: NodeJS.ProcessEnv, cwd: string, timeoutMs: number): StartedJob => {
    const registry = runtime.jobs
    if (registry === undefined) throw new Error('background jobs unavailable: the job registry is not composed')
    let process: BashExecution | undefined
    let stopped: string | undefined
    const owner = exec.agent?.id
    const id = registry.start({
      kind: 'bash',
      label: args.command,
      ...owner !== undefined ? { owner } : {},
      toolCall: { callId: exec.callId, rootCallId: exec.rootCallId ?? exec.callId },
      output: processSources(() => process),
      run: () => {
        const hooks = processJob(
          async (signal) => {
            process = createBashExecution(runtime.subprocess, runtime.profile, {
              command: args.command,
              cwd,
              env,
              onExpiry: 'none',
              timeoutMs,
              signal,
            })
            return process
          },
          processOutcome,
        )
        return {
          done: hooks.done,
          cancel: (reason) => {
            stopped = reason
            hooks.cancel(reason)
          },
        }
      },
    })
    return { id, process: () => process, stopped: () => stopped }
  }

  const stopJob = async (registry: JobRegistryLike, id: string, owner: string | undefined): Promise<JobViewLike> => {
    try {
      registry.kill(id, owner, 'tool call aborted')
    } catch {
      // The job may already be gone; the wait below decides its state.
    }
    try {
      const settled = await registry.wait(id, 10_000, owner)
      if (settled.status !== 'running' && settled.status !== 'stopping') {
        try {
          registry.remove(id, owner)
        } catch {
          // Cleanup is best-effort; the process is already settled.
        }
      }
      return settled
    } catch {
      return { id, kind: 'bash', label: '', status: 'killed', startedAt: Date.now(), output: { total: 0, earliest: 0 } }
    }
  }

  const waitOnJob = async (
    registry: JobRegistryLike,
    attached: StartedJob,
    exec: ToolExecutionLike,
    timeoutMs: number,
    cwd: string,
    compat: boolean,
    sessionMode: string | undefined,
  ): Promise<BashValue> => {
    const owner = exec.agent?.id
    let view: JobViewLike
    try {
      view = await registry.wait(attached.id, timeoutMs, owner, exec.signal)
    } catch (error) {
      await stopJob(registry, attached.id, owner)
      if (exec.signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw toolAborted()
      throw error instanceof Error ? error : new Error(String(error))
    }
    if (view.status === 'running' || view.status === 'stopping') {
      if (attached.process() === undefined) {
        await stopJob(registry, attached.id, owner)
        const synthetic: ForegroundValue = {
          kind: 'foreground',
          cwd,
          exitCode: null,
          signal: null,
          timedOut: true,
          aborted: false,
          timeoutMs,
          stdout: { text: '', truncated: false },
          stderr: { text: '', truncated: false },
          sandbox: { mode: 'danger-full-access', denied: false },
          ...compat ? { compat: true, ...sessionMode !== undefined ? { sessionMode } : {} } : {},
        }
        return synthetic
      }
      let read: JobReadLike
      try {
        read = registry.read(attached.id, owner)
      } catch {
        read = { chunks: [], lossy: false, job: view }
      }
      const output = ringDelta(read.chunks)
      const lossy = read.lossy
      const spill = read.job.output.spillPaths ?? []
      const promoted: PromotedValue = {
        kind: 'promoted',
        cwd,
        jobId: attached.id,
        timeoutMs,
        output: lossy
          ? `${output}${output.length > 0 && !output.endsWith('\n') ? '\n' : ''}[some output was dropped from memory; full output: ${spill.length > 0 ? spill.join(', ') : '(unavailable)'}]`
          : output,
        ...compat ? { compat: true, ...sessionMode !== undefined ? { sessionMode } : {} } : {},
      }
      return promoted
    }
    try {
      registry.remove(attached.id, owner)
    } catch {
      // The registry may have removed the settled job itself.
    }
    const process = attached.process()
    if (process === undefined) throw new Error(view.detail ?? 'the bash job failed before its process was published')
    const result = await process.result()
    const stopped = attached.stopped()
    return {
      ...result,
      sandbox: { mode: 'danger-full-access', denied: false },
      ...stopped !== undefined ? { stopped } : {},
      ...compat ? { compat: true, ...sessionMode !== undefined ? { sessionMode } : {} } : {},
    }
  }

  return {
    name: 'bash',
    description,
    parameters,
    output: {
      schema: outputSchema,
      render(_args: unknown, value: unknown): readonly ContentBlockLike[] {
        const typed = value as BashValue
        const backgroundNote = typed.kind === 'background' ? compatNote(typed) : undefined
        const text = typed.kind === 'background'
          ? `started background job ${typed.jobId}${backgroundNote !== undefined ? `\n${backgroundNote}` : ''}`
          : typed.kind === 'promoted'
            ? renderPromoted(typed)
            : renderResult(typed)
        return [{ type: 'text', text }]
      },
      presentationMeta(_args: unknown, value: unknown): unknown {
        const cwd = (value as { cwd?: unknown } | undefined)?.cwd
        return typeof cwd === 'string' ? { cwd } : undefined
      },
    },
    async execute(rawArgs: Record<string, unknown>, exec: ToolExecutionLike): Promise<BashValue> {
      const args = parseArgs(rawArgs)
      const standingPolicy = resolvePolicy(exec)
      const standingMode: SandboxMode = standingPolicy.mode
      validateBashArgs(args, standingMode)
      if (args.sandbox_permissions !== undefined && escalationModes.length === 0) {
        throw new Error('sandbox_permissions is not available in this composition (no sandboxing executor to escalate)')
      }
      let approvedMode: SandboxMode | undefined
      if (args.sandbox_permissions !== undefined && args.justification !== undefined) {
        approvedMode = await approveEscalation(
          {
            requestedMode: args.sandbox_permissions,
            justification: args.justification,
            effectiveMode: standingMode,
            subject: 'command',
          },
          approvalFor(exec, runtime.approval),
        )
      }
      const mode = approvedMode ?? standingMode
      let compat = false
      let sessionMode: string | undefined
      if (mode === 'read-only') {
        throw new Error(
          'bash cannot run in a read-only session: the Windows sandbox cannot start the MSYS2 runtime, and running unconfined would break the read-only promise. '
          + 'Switch the session permission to workspace-write (compatibility mode) or danger-full-access, or retry with sandbox_permissions: "workspace-write"/"danger-full-access" plus a justification.',
        )
      }
      if (mode === 'workspace-write') {
        if (runtime.compat === 'strict') {
          throw new Error(
            'bash cannot run under the Windows file sandbox: the MSYS2 runtime is blocked by the restricted token. '
            + 'This deployment is in strict compatibility mode. Set Settings → General → Terminal tool → Compatibility to auto, switch the session to danger-full-access, '
            + 'or retry with sandbox_permissions: "danger-full-access" plus a one-sentence justification.',
          )
        }
        compat = true
        sessionMode = mode
      }
      const cwd = resolveWorkdir(args.workdir, await resolveCwd(exec))
      const env = composeEnv(runtime.profile, process.env, collectDshEnv(exec), runtime.foreignRoots ?? [])
      const timeoutMs = clampTimeout(args.timeoutMs)
      const sandbox: SandboxInfoLike = { mode: 'danger-full-access', denied: false }

      if (args.run_in_background === true) {
        if (!backgroundEnabled) throw new Error('run_in_background is disabled for this deployment')
        if (exec.signal.aborted) throw toolAborted()
        const attached = startJob(args, exec, env, cwd, timeoutMs)
        const value: BackgroundValue = {
          kind: 'background',
          jobId: attached.id,
          cwd,
          ...compat ? { compat: true, ...sessionMode !== undefined ? { sessionMode } : {} } : {},
        }
        return value
      }

      if (promote && runtime.jobs !== undefined) {
        let attached: StartedJob | undefined
        try {
          attached = startJob(args, exec, env, cwd, timeoutMs)
        } catch (error) {
          runtime.warn?.(`bash: job registration refused, running in the foreground with the timeout kill instead: ${String(error)}`)
        }
        if (attached !== undefined) {
          return await waitOnJob(runtime.jobs, attached, exec, timeoutMs, cwd, compat, sessionMode)
        }
      }

      const execution = createBashExecution(runtime.subprocess, runtime.profile, {
        command: args.command,
        cwd,
        env,
        onExpiry: 'kill',
        timeoutMs,
        signal: exec.signal,
      })
      const result = await execution.result()
      if (result.aborted) throw toolAborted()
      return {
        ...result,
        sandbox,
        ...compat ? { compat: true, ...sessionMode !== undefined ? { sessionMode } : {} } : {},
      }
    },
    presentCall,
    presentResult,
  }
}

/** Re-exported for tests and the compat checker. */
export { ESCALATION_TARGETS, escalationHintMarker }
