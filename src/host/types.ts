/**
 * Structural projections of the DSH host contracts this plugin consumes.
 *
 * Third-party plugins cannot import `@deepseek-ai/*` host packages: the profile
 * installs only the plugin's own dependencies, and the host runtime lives
 * inside the DSH installation. Every shape below is therefore a *narrowed
 * projection* of the 0.2.2 runtime contract, not an import. When DSH changes a
 * shape, `scripts/compatcheck.mjs` should fail and this file is the one place
 * to update.
 *
 * Discipline: no runtime import from `@deepseek-ai/*` in this file. Type-only
 * declarations only.
 */

import type { BashFlavor, CompatMode, MsystemSetting } from '../shared/protocol.ts'

/** A schemastery volatile field as the Loader hands it to `apply`. */
export interface VolatileLike<T> {
  get(): T
}

/** The resolved entry Config this plugin declares. */
export interface TerminalToolSettings {
  /** Empty means auto-discover. */
  readonly bashPath: string
  readonly msystem: MsystemSetting
  readonly compat: CompatMode
}

/** One text block the tool result/content vocabulary uses. */
export interface TextBlockLike {
  readonly type: 'text'
  readonly text: string
}

export type ContentBlockLike = TextBlockLike

/** A tool result as the dispatcher passes it to `presentResult`. */
export interface ToolResultLike {
  readonly content: readonly ContentBlockLike[]
  readonly value?: unknown
  readonly isError?: boolean
}

/** The tool runtime (`ctx.tools`) as reachable from an agent scope. */
export interface ToolRuntimeLike {
  register(definition: unknown): () => void
  restrict(filter: { allow?: readonly string[]; deny?: readonly string[] }): () => void
}

/** The system-prompt service (`ctx.systemPrompt`). */
export interface SystemPromptLike {
  section(entry: { name: string; order: number; text: string }): () => void
  getSectionOrder(name: string): number
}

/** One collected stream read. */
export interface SubprocessOutputReadLike {
  readonly text: string
  readonly nextOffset: number
  readonly lossy: boolean
  readonly spillPath?: string
}

/** Offset-based reader over a collected stream. */
export interface SubprocessOutputReaderLike {
  readFrom(fromByte: number): SubprocessOutputReadLike
}

/** Per-stream collection request. */
export interface SubprocessCollectLike {
  maxBytes: number
  spill?: { maxBytes: number }
}

/** stdio dispositions used by this plugin. */
export interface SubprocessStdioLike {
  stdin: 'ignore'
  stdout: SubprocessCollectLike
  stderr: SubprocessCollectLike
}

/** Spawn spec subset. */
export interface SubprocessSpawnSpecLike {
  argv: readonly string[]
  cwd: string
  stdio: SubprocessStdioLike
  graceMs: number
  signal?: AbortSignal
  env?: NodeJS.ProcessEnv
}

/** Exit facts of one closed process. */
export interface SubprocessOutcomeLike {
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
}

/** The live subprocess handle subset this plugin uses. */
export interface SubprocessHandleLike {
  readonly collected: {
    readonly stdout?: SubprocessOutputReaderLike
    readonly stderr?: SubprocessOutputReaderLike
  }
  readonly done: Promise<SubprocessOutcomeLike>
  terminate(): void
}

/** The subprocess service (`ctx.subprocess`). */
export interface SubprocessServiceLike {
  spawn(spec: SubprocessSpawnSpecLike): SubprocessHandleLike
}

/** One job output pull source. */
export interface JobOutputSourceLike {
  readonly channel?: 'stdout' | 'stderr' | 'log'
  read(fromByte: number): {
    text: string
    nextOffset: number
    lossy: boolean
    spillPath?: string
  }
}

/** Terminal outcome supplied by a producer. */
export interface JobOutcomeLike {
  status: 'completed' | 'killed' | 'failed'
  detail?: string
  result?: string
}

/** Producer hooks returned by `run`. */
export interface JobHooksLike {
  cancel(reason?: string): void
  done: Promise<JobOutcomeLike>
}

/** Producer face handed to `run`. */
export interface JobHandleLike {
  readonly id: string
  append(text: string, options?: { channel?: 'stdout' | 'stderr' | 'log'; gapBefore?: true }): void
  updateProgress(line: string): void
}

/** Job registration spec subset. */
export interface JobSpecLike {
  kind: string
  label: string
  owner?: string
  toolCall?: { callId: string; rootCallId: string }
  outputLimitBytes?: number
  output?: readonly JobOutputSourceLike[]
  run(job: JobHandleLike): JobHooksLike
}

/** Read-only projection of one job. */
export interface JobViewLike {
  readonly id: string
  readonly kind: string
  readonly label: string
  readonly owner?: string
  readonly status: 'running' | 'stopping' | 'completed' | 'killed' | 'failed'
  readonly progress?: string
  readonly detail?: string
  readonly startedAt: number
  readonly finishedAt?: number
  readonly output: { readonly total: number; readonly earliest: number; readonly spillPaths?: readonly string[] }
}

/** One chunk of a job's output ring. */
export interface JobChunkLike {
  readonly at: number
  readonly text: string
  readonly channel?: 'stdout' | 'stderr' | 'log'
  readonly gapBefore?: true
}

/** One consuming job read. */
export interface JobReadLike {
  readonly chunks: readonly JobChunkLike[]
  readonly lossy: boolean
  readonly result?: string
  readonly job: JobViewLike
}

/** The job registry (`ctx.jobs`), when composed. */
export interface JobRegistryLike {
  start(spec: JobSpecLike): string
  wait(id: string, timeoutMs: number, caller?: string, signal?: AbortSignal): Promise<JobViewLike>
  read(id: string, caller?: string): JobReadLike
  kill(id: string, caller?: string, reason?: string): 'requested' | 'already-finished'
  remove(id: string, caller?: string): void
}

/** The per-call sandbox policy resolved by `ctx.sandboxPolicy`. */
export interface SandboxPolicyLike {
  readonly mode: 'read-only' | 'workspace-write' | 'danger-full-access'
  readonly workspaceRoot: string
}

/** The sandbox-policy service (`ctx.sandboxPolicy`). */
export interface SandboxPolicyServiceLike {
  resolve(request?: { session?: object; mode?: string }): SandboxPolicyLike
}

/** The mounted shell executor's capability facts (`ctx.shell`). */
export interface ShellServiceLike {
  readonly sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'
}

/** The managed `DSH_*` environment snapshot (`ctx.shellEnv`). */
export interface ShellEnvServiceLike {
  collect(exec: unknown): Record<string, string>
}

/** The human approval channel (`ctx.approval`). */
export interface ApprovalServiceLike {
  request(request: {
    agent: unknown
    toolName: string
    callId: string
    reason: string
    displayReason?: { readonly en: string; readonly [locale: string]: string }
    signal?: AbortSignal
  }): Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>
}

/** The session working-directory service (`ctx.workingDirectory`). */
export interface WorkingDirectoryServiceLike {
  ensure(agent: unknown, signal?: AbortSignal): Promise<string>
}

/** One `/api` fetch route. */
export interface FetchRouteLike {
  readonly path: string
  readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
  readonly requestBody: 'buffered' | 'streaming'
  fetch(request: Request): Response | Promise<Response>
}

/** The host connection service (`ctx.connection`). */
export interface ConnectionServiceLike {
  readonly fetch?: {
    register(route: FetchRouteLike): (() => void) | Promise<() => void>
  }
}

/** The host logger (`ctx.logger`). */
export interface LoggerLike {
  info?(message: string): void
  warn?(message: string): void
  error?(message: string): void
}

/** The agent surface this plugin reads. */
export interface AgentLike {
  readonly id: string
  readonly session: {
    readonly id?: string
    readonly header?: { readonly cwd?: string }
  }
  readonly ctx: AgentContextLike
}

/** The per-agent scoped context. */
export interface AgentContextLike {
  get?(name: string): unknown
  effect?(callback: () => (() => void) | void, label?: string): unknown
}

/** The host root context subset. */
export interface HostContextLike {
  get(name: string): unknown
  on(event: string, listener: (payload: unknown) => unknown): unknown
  inject?(services: readonly string[], callback: (ctx: HostContextLike) => void): unknown
  effect?(callback: () => (() => void) | void, label?: string): unknown
  logger?: LoggerLike
}

/** The tool execution context the dispatcher passes to `execute`. */
export interface ToolExecutionLike {
  readonly agent?: AgentLike
  readonly callId: string
  readonly rootCallId?: string
  readonly signal: AbortSignal
}

/** A call card the external UI bridges render. */
export interface GenericCallViewLike {
  card: 'generic'
  title: string
  kind?: string
  rawInput?: unknown
  content?: readonly ContentBlockLike[]
}

export interface TerminalCallViewLike {
  card: 'terminal'
  title: string
  description?: string
  cwd?: string
}

export type ToolCallViewLike = GenericCallViewLike | TerminalCallViewLike

export interface TerminalResultViewLike {
  card: 'terminal'
  output: string
  exitCode?: number
  signal?: string
}

export interface GenericResultViewLike {
  card: 'generic'
  content?: readonly ContentBlockLike[]
}

export type ToolResultViewLike = TerminalResultViewLike | GenericResultViewLike

/** Parameter spec accepted by the tool registry. */
export interface ParameterSpecLike {
  type: 'string' | 'number' | 'boolean'
  required?: boolean
  description?: string
  enum?: readonly string[]
  const?: string
}

/** Tool definition projection. */
export interface ToolDefinitionLike {
  name: string
  description: string
  parameters: unknown
  output: {
    schema: unknown
    render(args: unknown, value: unknown): readonly ContentBlockLike[]
    presentationMeta?(args: unknown, value: unknown): unknown
  }
  execute(args: Record<string, unknown>, exec: ToolExecutionLike): Promise<unknown>
  presentCall?(args: unknown): ToolCallViewLike
  presentResult?(args: unknown, result: ToolResultLike): ToolResultViewLike | undefined
}

/** Flavor labels used by diagnostics. */
export const FLAVOR_LABELS: Record<BashFlavor, string> = {
  git: 'Git for Windows',
  msys2: 'MSYS2',
  cygwin: 'Cygwin',
}
