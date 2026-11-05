/**
 * Sandbox escalation semantics, mirrored from `@deepseek-ai/dsh-sandbox`.
 *
 * The plugin cannot import the official package (third-party plugins do not get
 * the host's node_modules), so the small, stable decision surface is reproduced
 * here verbatim: the closed target vocabulary, the strictly-wider ladder, the
 * argument pairing, the model-facing markers, and the fail-closed approval
 * sequence. `scripts/compatcheck.mjs` asserts the strings against the deployed
 * runtime when available.
 */
import type { ApprovalServiceLike, AgentLike, ToolExecutionLike } from './types.ts'

export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

/** The closed escalation-target vocabulary. */
export const ESCALATION_TARGETS: readonly SandboxMode[] = ['workspace-write', 'danger-full-access']

/** What a call whose effective mode is the key may escalate to. */
export const WIDER_MODES: Record<string, readonly SandboxMode[]> = {
  'read-only': ['workspace-write', 'danger-full-access'],
  'workspace-write': ['danger-full-access'],
}

/** Validate the `sandbox_permissions` ⇔ `justification` pairing. */
export function validateEscalationArgs(sandboxPermissions: string | undefined, justification: string | undefined): void {
  if (sandboxPermissions !== undefined && justification === undefined) {
    throw new Error('invalid escalation: sandbox_permissions requires a justification')
  }
  if (justification !== undefined && sandboxPermissions === undefined) {
    throw new Error('invalid escalation: justification is only valid together with sandbox_permissions')
  }
  if (justification !== undefined && justification.trim().length === 0) {
    throw new Error('invalid justification: expected a non-empty sentence')
  }
}

/** The model-facing denial marker. */
export function sandboxDenialMarker(mode: SandboxMode): string {
  return `[sandbox: file access denied under ${mode} mode]`
}

/** The same-turn escalation hint. */
export function escalationHintMarker(subject: string): string {
  return `[sandbox: escalation available — retry this exact ${subject} once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]`
}

/** The `sandbox_permissions` parameter description. */
export function sandboxPermissionsDescription(subject: string): string {
  return `The narrowest wider sandbox mode for a one-shot retry of the exact ${subject} the sandbox just denied; the retry asks the user for approval.`
}

/**
 * The localized escalation approval text, mirrored from
 * `@deepseek-ai/dsh-sandbox` 0.2.2 (`escalationDisplayReason`). DSH ships eight
 * locales; a request that carries only en/zh leaves every other UI language on
 * the English fallback. The audit reason (`reason`) stays locale-neutral.
 */
export function escalationDisplayReason(mode: string, justification: string): Record<'en' | 'zh' | 'ja' | 'es' | 'fr' | 'de' | 'ru' | 'pt', string> {
  return {
    en: `Allow this operation with ${mode} permissions: ${justification}`,
    zh: `允许本次操作使用 ${mode} 权限：${justification}`,
    ja: `${mode} 権限でこの操作を許可します：${justification}`,
    es: `Permitir esta operación con permisos ${mode}: ${justification}`,
    fr: `Autoriser cette opération avec les permissions ${mode} : ${justification}`,
    de: `Diesen Vorgang mit ${mode}-Berechtigungen zulassen: ${justification}`,
    ru: `Разрешить эту операцию с правами ${mode}: ${justification}`,
    pt: `Permitir esta operação com permissões ${mode}: ${justification}`,
  }
}

/** The approval ingredients this tool supplies. */
export interface EscalationApproval {
  approver: ApprovalServiceLike | undefined
  agent: AgentLike | undefined
  callId: string
  toolName: string
  signal?: AbortSignal
}

/** One escalation request. */
export interface EscalationRequest {
  requestedMode: string
  justification: string
  effectiveMode: SandboxMode
  subject: string
}

/**
 * Resolve a sandbox escalation before execution. Repeating the effective mode
 * needs no approval; a strictly wider mode asks the human. Anything else fails
 * closed before the command runs.
 */
export async function approveEscalation(
  request: EscalationRequest,
  approval: EscalationApproval,
): Promise<SandboxMode> {
  const { requestedMode: mode, effectiveMode, justification, subject } = request
  if (mode === effectiveMode) return effectiveMode
  if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode as SandboxMode)) {
    throw new Error(`sandbox escalation to "${mode}" is not strictly wider than this call's current "${effectiveMode}" mode`)
  }
  if (approval.approver === undefined) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`)
  }
  if (approval.agent === undefined) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but the call has no agent to route it through`)
  }
  const outcome = await approval.approver.request({
    agent: approval.agent,
    toolName: approval.toolName,
    callId: approval.callId,
    reason: `escalate sandbox to ${mode}: ${justification}`,
    displayReason: escalationDisplayReason(mode, justification),
    ...approval.signal !== undefined ? { signal: approval.signal } : {},
  })
  switch (outcome) {
    case 'allowed-once':
      return mode as SandboxMode
    case 'rejected':
      throw new Error(`the user rejected escalating this ${subject} to "${mode}"; it stays denied, so stop and explain instead of working around it`)
    case 'cancelled':
      throw new Error(`approval for escalating to "${mode}" was cancelled`)
    case 'unavailable':
      throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`)
    default:
      throw new Error(`unknown approval outcome: ${String(outcome)}`)
  }
}

/** Build the approval ingredients for one tool execution. */
export function approvalFor(exec: ToolExecutionLike, approver: ApprovalServiceLike | undefined): EscalationApproval {
  return {
    approver,
    agent: exec.agent,
    callId: exec.callId,
    toolName: 'bash',
    signal: exec.signal,
  }
}
