/** Same-origin `/api/dsh-gitbash/*` calls (the carrier owns auth). */
import { ROUTE_DISCOVER, ROUTE_STATE, ROUTE_VALIDATE } from '../shared/protocol.ts'
import type { DiscoverView, StateView, ValidateView } from '../shared/protocol.ts'

/** Bound one local Host round trip so a hung route cannot freeze the row. */
const REQUEST_TIMEOUT_MS = 20_000

/** POST JSON and unwrap the route's typed payload. */
async function post<T>(path: string, body: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const timeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      ...timeout !== undefined ? { signal: timeout } : {},
    })
  } catch (error) {
    const detail = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message)
      : String(error)
    throw new Error(`request failed: ${path}: ${detail}`)
  }
  const text = await response.text()
  if (text.length === 0) {
    // Carrier auth fences often answer with an empty body; keep the status.
    throw new Error(`request failed: ${path} (${response.status}): empty response`)
  }
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    // The auth fence and carrier errors are plain text, not JSON. Surface the
    // status and a bounded body instead of a JSON.parse SyntaxError.
    throw new Error(`request failed: ${path} (${response.status}): ${text.slice(0, 200)}`)
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error(`unexpected response from ${path} (${response.status})`)
  }
  const record = payload as { ok?: unknown; error?: unknown }
  if (!response.ok) {
    throw new Error(
      typeof record.error === 'string'
        ? record.error
        : `request failed: ${path} (${response.status})`,
    )
  }
  if (record.ok !== true) {
    throw new Error(
      typeof record.error === 'string'
        ? record.error
        : `request failed: ${path}: unexpected response envelope`,
    )
  }
  return payload as T
}

/** Read the current state. */
export function fetchState(): Promise<StateView> {
  return post<StateView>(ROUTE_STATE, {})
}

/** Scan for profiles. */
export function fetchDiscover(savedPath: string): Promise<DiscoverView> {
  // A synchronous full scan can legitimately take longer than a state read.
  return post<DiscoverView>(ROUTE_DISCOVER, { savedPath }, 60_000)
}

/** Validate one path/environment. */
export function fetchValidate(path: string, msystem: string): Promise<ValidateView> {
  return post<ValidateView>(ROUTE_VALIDATE, { path, msystem })
}
