/**
 * Per-agent replacement: hide the preset's `pwsh`, register this plugin's
 * `bash`, and shadow the PowerShell prompt section.
 *
 * `agent/created` is serial and awaited by the agent runtime, so the tool and
 * prompt are installed before the first model request. Every action is scoped
 * to `agent.ctx`; child agents inherit the result and are skipped by the
 * `restrict({ deny: ['pwsh'] })` failure path.
 */
import type { TerminalToolSettings } from './types.ts'
import type { BashProfile, DiscoveryCache } from './discover.ts'
import { normalizePathKey, resolveEffectiveProfile } from './discover.ts'
import { readSettings } from './settings.ts'
import { createBashTool, type BashToolRuntime } from './bash-tool.ts'
import { diag } from './diag.ts'
import type {
  AgentContextLike,
  AgentLike,
  ApprovalServiceLike,
  HostContextLike,
  JobRegistryLike,
  SandboxPolicyServiceLike,
  ShellEnvServiceLike,
  ShellServiceLike,
  SubprocessServiceLike,
  SystemPromptLike,
  ToolRuntimeLike,
  WorkingDirectoryServiceLike,
} from './types.ts'

/** The preset's Windows terminal tool name. */
export const PWSH_TOOL_NAME = 'pwsh'

/** Official prompt-section names/orders (0.2.1). */
export const ORDER_TOOL_BASH = 1000
export const ORDER_TOOL_PWSH = 1010

/** The official bash prompt sentence. */
export const TOOL_BASH_TEXT = 'Check the [exit code: N] marker on every bash result; investigate failures before moving on.'

/** One replacement attempt. */
export interface ReplaceAttempt {
  readonly applied: boolean
  readonly reason?: string
}

/** Services visible from the agent scope. */
interface Capability {
  readonly tools?: ToolRuntimeLike
  readonly systemPrompt?: SystemPromptLike
}

/** Read a service without letting a missing/thorowing `get` break the listener. */
function readService<T>(ctx: { get?(name: string): unknown }, name: string): T | undefined {
  try {
    const value = typeof ctx.get === 'function' ? ctx.get(name) : undefined
    return value === undefined || value === null ? undefined : value as T
  } catch {
    return undefined
  }
}

/** Probe the scoped services required for replacement. */
export function probeCapability(agentCtx: AgentContextLike): Capability {
  const tools = readService<ToolRuntimeLike>(agentCtx, 'tools')
  const systemPrompt = readService<SystemPromptLike>(agentCtx, 'systemPrompt')
  const usableTools = tools !== undefined
    && typeof tools.register === 'function'
    && typeof tools.restrict === 'function'
    ? tools
    : undefined
  const usablePrompt = systemPrompt !== undefined && typeof systemPrompt.section === 'function'
    ? systemPrompt
    : undefined
  return {
    ...usableTools !== undefined ? { tools: usableTools } : {},
    ...usablePrompt !== undefined ? { systemPrompt: usablePrompt } : {},
  }
}

/** Read a prompt order, falling back to the 0.2.1 constant. */
function sectionOrder(prompt: SystemPromptLike, name: string, fallback: number): number {
  try {
    const value = prompt.getSectionOrder(name)
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  } catch {
    return fallback
  }
}

/** Build the tool's runtime from the host services. */
function buildToolRuntime(
  host: HostContextLike,
  profile: BashProfile,
  settings: TerminalToolSettings,
  foreignRoots: readonly string[],
): BashToolRuntime | undefined {
  const subprocess = readService<SubprocessServiceLike>(host, 'subprocess')
  if (subprocess === undefined || typeof subprocess.spawn !== 'function') return undefined
  const jobs = readService<JobRegistryLike>(host, 'jobs')
  const sandboxPolicy = readService<SandboxPolicyServiceLike>(host, 'sandboxPolicy')
  const shell = readService<ShellServiceLike>(host, 'shell')
  const shellEnv = readService<ShellEnvServiceLike>(host, 'shellEnv')
  const workingDirectory = readService<WorkingDirectoryServiceLike>(host, 'workingDirectory')
  const approval = readService<ApprovalServiceLike>(host, 'approval')
  return {
    subprocess,
    profile,
    compat: settings.compat,
    ...jobs !== undefined && typeof jobs.start === 'function' ? { jobs } : {},
    ...sandboxPolicy !== undefined && typeof sandboxPolicy.resolve === 'function' ? { sandboxPolicy } : {},
    ...shell !== undefined ? { shell } : {},
    ...shellEnv !== undefined && typeof shellEnv.collect === 'function' ? { shellEnv } : {},
    ...workingDirectory !== undefined && typeof workingDirectory.ensure === 'function' ? { workingDirectory } : {},
    ...approval !== undefined && typeof approval.request === 'function' ? { approval } : {},
    foreignRoots,
    warn: (message: string) => diag(`tool: ${message}`),
  }
}

/** Register everything for one agent, rolling back on a partial failure. */
export function replaceTerminalTool(
  host: HostContextLike,
  agent: AgentLike,
  settings: TerminalToolSettings,
  profile: BashProfile,
  foreignRoots: readonly string[] = [],
): ReplaceAttempt {
  if (process.platform !== 'win32') return { applied: false, reason: 'platform is not win32' }
  if (!profile.valid) return { applied: false, reason: profile.problem ?? 'bash profile is invalid' }
  const agentCtx = agent.ctx
  if (agentCtx === undefined || agentCtx === null) return { applied: false, reason: 'agent has no scoped context' }
  const capability = probeCapability(agentCtx)
  if (capability.tools === undefined) return { applied: false, reason: 'ctx.tools.register/restrict is not available' }
  if (capability.systemPrompt === undefined) return { applied: false, reason: 'ctx.systemPrompt.section is not available' }
  const runtime = buildToolRuntime(host, profile, settings, foreignRoots)
  if (runtime === undefined) return { applied: false, reason: 'ctx.subprocess.spawn is not available' }

  let releaseRestriction: (() => void) | undefined
  try {
    releaseRestriction = capability.tools.restrict({ deny: [PWSH_TOOL_NAME] })
  } catch (error) {
    return { applied: false, reason: `pwsh is not restrictable here (already hidden?): ${messageOf(error)}` }
  }

  const releases: (() => void)[] = [releaseRestriction]
  try {
    const tool = createBashTool(runtime)
    releases.push(capability.tools.register(tool))
    const orderPwsh = sectionOrder(capability.systemPrompt, 'TOOL_PWSH', ORDER_TOOL_PWSH)
    const orderBash = sectionOrder(capability.systemPrompt, 'TOOL_BASH', ORDER_TOOL_BASH)
    releases.push(capability.systemPrompt.section({ name: 'tool:pwsh', order: orderPwsh, text: '' }))
    releases.push(capability.systemPrompt.section({ name: 'tool:bash', order: orderBash, text: TOOL_BASH_TEXT }))
    const windowsText = settings.compat === 'auto'
      ? 'Git Bash on Windows runs outside the DSH file sandbox when the session mode is workspace-write, because the MSYS2 runtime cannot start under the Windows restricted token. Do not write outside the workspace; treat outside paths as read-only unless the user explicitly asks otherwise.'
      : 'Bash is available only under danger-full-access in this deployment; under read-only/workspace-write the bash tool refuses instead of widening permissions.'
    releases.push(capability.systemPrompt.section({
      name: 'tool:bash:windows',
      order: orderBash + 1,
      text: windowsText,
    }))
    for (const release of releases) {
      try {
        agentCtx.effect?.(() => release, 'dsh-gitbash: replacement')
      } catch {
        // The registrations are already live; scope disposal still frees them.
      }
    }
    diag(`replace: applied agent=${agent.id} profile=${profile.id} compat=${settings.compat}`)
    return { applied: true }
  } catch (error) {
    for (const release of [...releases].reverse()) {
      try {
        release()
      } catch {
        // Keep rolling back the rest.
      }
    }
    diag(`replace: failed agent=${agent.id}: ${messageOf(error)}`)
    return { applied: false, reason: messageOf(error) }
  }
}

/** Options for the `agent/created` listener. */
export interface ReplaceListenerOptions {
  readonly host: HostContextLike
  /** The live config reader (volatile fields are stable references). */
  readonly settings: () => TerminalToolSettings
  readonly cache: DiscoveryCache
  readonly onAttempt: (attempt: ReplaceAttempt, agent: AgentLike) => void
  readonly seen?: WeakSet<object>
}

/** Extract the agent from an `agent/created` payload. */
function readAgent(payload: unknown): AgentLike | null {
  if (typeof payload !== 'object' || payload === null) return null
  const agent = (payload as Record<string, unknown>).agent
  if (typeof agent !== 'object' || agent === null) return null
  const record = agent as Record<string, unknown>
  if (typeof record.id !== 'string') return null
  if (typeof record.ctx !== 'object' || record.ctx === null) return null
  if (typeof record.session !== 'object' || record.session === null) return null
  return agent as unknown as AgentLike
}

/** Register the per-agent listener. */
export function registerReplacement(options: ReplaceListenerOptions): () => void {
  const seen = options.seen ?? new WeakSet<object>()
  const listener = (payload: unknown): void => {
    try {
      const agent = readAgent(payload)
      if (agent === null) return
      if (seen.has(agent as object)) return
      seen.add(agent as object)
      const settings = options.settings()
      const resolved = resolveEffectiveProfile(settings, options.cache, false)
      if (resolved.profile === undefined) {
        const attempt: ReplaceAttempt = { applied: false, reason: resolved.problem ?? 'no usable bash profile' }
        diag(`replace: skipped agent=${agent.id}: ${attempt.reason ?? 'unknown'}`)
        options.onAttempt(attempt, agent)
        return
      }
      const profile = resolved.profile
      const roots = [...new Set(options.cache.get().candidates.map(candidate => candidate.root))]
      const foreignRoots = roots.filter(root => normalizePathKey(root) !== normalizePathKey(profile.root))
      const attempt = replaceTerminalTool(options.host, agent, settings, profile, foreignRoots)
      options.onAttempt(attempt, agent)
    } catch (error) {
      // A notification listener must never break agent creation.
      diag(`replace: listener failed: ${messageOf(error)}`)
    }
  }
  const dispose = options.host.on('agent/created', listener)
  return typeof dispose === 'function' ? dispose as () => void : () => undefined
}

/** One-line error text. */
function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error)
}

/** Re-export for tests. */
export { readSettings }
