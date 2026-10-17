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
  const payload: unknown = await response.json()
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`unexpected response from ${path}`)
  }
  const record = payload as { ok?: unknown; error?: unknown }
  if (record.ok === false) throw new Error(typeof record.error === 'string' ? record.error : `request failed: ${path}`)
  if (!response.ok) throw new Error(`request failed: ${path} (${response.status})`)
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
