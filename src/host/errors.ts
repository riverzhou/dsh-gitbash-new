/**
 * Error identities mirrored from DSH 0.2.2-rc.3.
 *
 * A third-party plugin cannot import `@deepseek-ai/dsh-error`, so the tool
 * registry's `error instanceof HarnessError` check never records `error.info`
 * for one of these failures: DSH persists only the message. The `name`/`code`
 * fields still match the official class (ToolArgsError/ToolContextUnavailable/
 * SandboxEscalationError) for diagnostics, unit assertions, and any future
 * duck-typed recorder; they are not a claim that `tool/result.error.info` exists.
 *
 * `scripts/compatcheck.mjs` asserts the official messages/codes against the
 * deployed runtime bundles.
 */

/** Tool argument violations; the official class prefixes `invalid arguments: `. */
export const TOOL_ARGS_ERROR = 'ToolArgsError'
export const INVALID_ARGS = 'INVALID_ARGS'

/** A tool body whose composition lacks required call context. */
export const TOOL_CONTEXT_UNAVAILABLE_ERROR = 'ToolContextUnavailableError'
export const TOOL_CONTEXT_UNAVAILABLE = 'TOOL_CONTEXT_UNAVAILABLE'

/** A `sandbox_permissions` request that produced no grant; nothing executed. */
export const SANDBOX_ESCALATION_ERROR = 'SandboxEscalationError'

/** Every escalation failure code. */
export type SandboxEscalationCode =
  | 'SANDBOX_ESCALATION_INVALID_ARGUMENT'
  | 'SANDBOX_ESCALATION_UNAVAILABLE'
  | 'SANDBOX_ESCALATION_REJECTED'
  | 'SANDBOX_ESCALATION_CANCELLED'

/** The escalation fields are unpaired, blank, or not strictly wider. */
export const SANDBOX_ESCALATION_INVALID_ARGUMENT = 'SANDBOX_ESCALATION_INVALID_ARGUMENT'
/** No sandboxing executor, approval service, calling agent, or approval channel. */
export const SANDBOX_ESCALATION_UNAVAILABLE = 'SANDBOX_ESCALATION_UNAVAILABLE'
/** The user declined the escalation; the operation stays denied. */
export const SANDBOX_ESCALATION_REJECTED = 'SANDBOX_ESCALATION_REJECTED'
/** The approval request ended without a decision while the call itself stayed live. */
export const SANDBOX_ESCALATION_CANCELLED = 'SANDBOX_ESCALATION_CANCELLED'

/**
 * Mirror one official `HarnessError` subclass on a plain Error.
 * @param name - the official class name recorded in `error.name`.
 * @param code - the official closed code recorded in `error.code`.
 * @param message - the official model-facing message, verbatim.
 * @param options - optional `cause` chaining.
 * @returns a plain Error carrying the same visible identity.
 */
export function errorWithIdentity(name: string, code: string, message: string, options?: ErrorOptions): Error {
  const error = new Error(message, options)
  error.name = name
  ;(error as { code?: string }).code = code
  return error
}

/**
 * Build the dispatcher-compatible argument error for one or more violations.
 * @param violations - individual violations in schema-walk order.
 * @returns `ToolArgsError` with the official `invalid arguments: ` prefix.
 */
export function toolArgsError(violations: readonly string[]): Error {
  return errorWithIdentity(TOOL_ARGS_ERROR, INVALID_ARGS, `invalid arguments: ${violations.join('; ')}`)
}

/**
 * Build a missing-context error for a tool body.
 * @param message - names the tool and the missing context.
 */
export function toolContextUnavailableError(message: string): Error {
  return errorWithIdentity(TOOL_CONTEXT_UNAVAILABLE_ERROR, TOOL_CONTEXT_UNAVAILABLE, message)
}

/**
 * Build one escalation failure.
 * @param message - the model-facing explanation and safe next step.
 * @param code - the closed escalation failure code.
 */
export function sandboxEscalationError(message: string, code: SandboxEscalationCode): Error {
  return errorWithIdentity(SANDBOX_ESCALATION_ERROR, code, message)
}
