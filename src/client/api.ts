/** Same-origin `/api/dsh-gitbash/*` calls (the carrier owns auth). */
import { ROUTE_DISCOVER, ROUTE_STATE, ROUTE_VALIDATE } from '../shared/protocol.ts'
import type { DiscoverView, StateView, ValidateView } from '../shared/protocol.ts'

/** POST JSON and unwrap the route's typed payload. */
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let payload: unknown
  try {
    payload = text.length === 0 ? undefined : JSON.parse(text)
  } catch {
    // The auth fence and carrier errors are plain text, not JSON. Surface the
    // status and a bounded body instead of a JSON.parse SyntaxError.
    throw new Error(`request failed: ${path} (${response.status}): ${text.slice(0, 200) || 'empty response'}`)
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error(`unexpected response from ${path}`)
  }
  const record = payload as { ok?: unknown; error?: unknown }
  if (!response.ok) {
    throw new Error(
      typeof record.error === 'string'
        ? record.error
        : `request failed: ${path} (${response.status})`,
    )
  }
  if (record.ok === false) throw new Error(typeof record.error === 'string' ? record.error : `request failed: ${path}`)
  return payload as T
}

/** Read the current state. */
export function fetchState(): Promise<StateView> {
  return post<StateView>(ROUTE_STATE, {})
}

/** Scan for profiles. */
export function fetchDiscover(savedPath: string, msystem: string): Promise<DiscoverView> {
  return post<DiscoverView>(ROUTE_DISCOVER, { savedPath, msystem })
}

/** Validate one path/environment. */
export function fetchValidate(path: string, msystem: string): Promise<ValidateView> {
  return post<ValidateView>(ROUTE_VALIDATE, { path, msystem })
}
