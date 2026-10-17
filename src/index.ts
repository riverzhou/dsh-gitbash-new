/**
 * dsh-gitbash host entry.
 *
 * Installs a per-agent `bash` tool that replaces the preset's `pwsh`, backed by
 * a selected Git for Windows / MSYS2 profile. See docs/DESIGN.md for the
 * platform constraint and the security model.
 */
import { Config, readSettings } from './host/settings.ts'
import { createDiscoveryCache, resolveEffectiveProfile } from './host/discover.ts'
import { registerReplacement } from './host/replace.ts'
import { registerRoutes } from './host/routes.ts'
import { diag, diagFile } from './host/diag.ts'
import type { HostContextLike, ShellServiceLike } from './host/types.ts'
import type { CapabilityView, ReplaceView } from './shared/protocol.ts'

/** No hard dependencies: missing optional services degrade instead of vetoing. */
export const inject: string[] = []

/** Read a service without throwing. */
function readService<T>(ctx: HostContextLike, name: string): T | undefined {
  try {
    const value = ctx.get(name)
    return value === undefined || value === null ? undefined : value as T
  } catch {
    return undefined
  }
}

/** The deployment capability facts the settings row renders. */
export function probeDeploymentCapability(ctx: HostContextLike): CapabilityView {
  const shell = readService<ShellServiceLike>(ctx, 'shell')
  const jobs = readService<{ start?: unknown }>(ctx, 'jobs')
  const supported = process.platform === 'win32' && readService(ctx, 'subprocess') !== undefined
  return {
    supported,
    ...(!supported
      ? {
          reason: process.platform !== 'win32'
            ? 'bash replacement is Windows-only'
            : 'this DSH composition is missing ctx.subprocess',
        }
      : {}),
    ...shell?.sandboxMode !== undefined ? { shellSandboxMode: shell.sandboxMode } : {},
    backgroundJobs: jobs !== undefined && typeof jobs.start === 'function',
    bashAvailable: false,
  }
}

/**
 * Host plugin body.
 * @param ctx - host root context.
 * @param config - the resolved entry Config (volatile references).
 */
export function apply(ctx: HostContextLike, config?: unknown): void {
  if (process.platform !== 'win32') {
    diag('apply: skipped, platform is not win32')
    return
  }

  const cache = createDiscoveryCache()
  const state: { lastReplace?: ReplaceView | undefined; applied: boolean; agents: number } = {
    applied: false,
    agents: 0,
  }
  const settingsForSession = () => readSettings(config)
  const initial = settingsForSession()
  diag(`apply: pid=${process.pid} settings=${JSON.stringify({ bashPath: initial.bashPath, msystem: initial.msystem, compat: initial.compat })} log=${diagFile()}`)

  // Warm the cache once so the first agent creation does not pay for a full
  // registry/where scan inside the serial listener.
  try {
    const scan = cache.get()
    diag(`discover: ${scan.candidates.length} profile(s), recommended=${scan.recommended?.id ?? '(none)'}`)
    if (scan.recommended === undefined) diag(`discover: ${scan.notes.join('; ') || 'no usable profile'}`)
  } catch (error) {
    diag(`discover: scan failed: ${messageOf(error)}`)
  }

  const capability = (): CapabilityView => {
    const base = probeDeploymentCapability(ctx)
    const resolved = resolveEffectiveProfile(settingsForSession(), cache, false)
    return { ...base, bashAvailable: resolved.profile !== undefined }
  }

  registerRoutes(ctx, {
    readSettings: settingsForSession,
    cache,
    settingsAvailable: () => true,
    capability,
    lastReplace: () => state.lastReplace,
  })

  const dispose = registerReplacement({
    host: ctx,
    settings: settingsForSession,
    cache,
    onAttempt: (attempt, agent) => {
      state.agents += 1
      state.lastReplace = {
        at: Date.now(),
        applied: attempt.applied,
        ...attempt.reason !== undefined ? { reason: attempt.reason } : {},
      }
      if (attempt.applied) state.applied = true
      else diag(`replace: skipped agent=${agent.id} reason=${attempt.reason ?? 'unknown'}`)
    },
  })
  ctx.effect?.(() => dispose, 'dsh-gitbash: agent/created listener')
}

/** One-line error text. */
function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error)
}

export { Config, readSettings }
export { discoverBash, createDiscoveryCache, resolveEffectiveProfile, profileFromPath, profilesForRoot, detectFlavor, parseBashVersion, isBlockedBash, deriveRootFromBash, deriveRootFromGit, defaultMsystemFor, environmentRootFor } from './host/discover.ts'
export { composeEnv, composePath, posixToWindows, resolveWorkdir, ENV_OVERRIDES } from './host/env.ts'
export { createBashExecution, clampTimeout, EXEC_DEFAULTS, BashSpawnError } from './host/executor.ts'
export { createBashTool } from './host/bash-tool.ts'
export { renderResult, renderPromoted, parseExitStatus, compatNote } from './host/render.ts'
export { approveEscalation, ESCALATION_TARGETS, WIDER_MODES, validateEscalationArgs, sandboxPermissionsDescription, sandboxDenialMarker, escalationHintMarker } from './host/escalation.ts'
export { registerReplacement, replaceTerminalTool, probeCapability, PWSH_TOOL_NAME } from './host/replace.ts'
export { registerRoutes } from './host/routes.ts'
export { diag, diagFile } from './host/diag.ts'
