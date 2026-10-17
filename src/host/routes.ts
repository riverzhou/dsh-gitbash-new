/**
 * `/api/dsh-gitbash/*` routes for the settings row.
 *
 * Writes go through the official config form (the plugin's entry Config), not
 * these routes: `state`/`discover`/`validate` are read-only queries. The
 * physical `/api` carrier owns auth and the login fence.
 */
import type { BashProfile, DiscoveryCache } from './discover.ts'
import { profileFromPath, resolveEffectiveProfile } from './discover.ts'
import type { TerminalToolSettings } from './types.ts'
import type { ConnectionServiceLike, HostContextLike } from './types.ts'
import { ROUTE_DISCOVER, ROUTE_STATE, ROUTE_VALIDATE, SETTINGS_NAMESPACE } from '../shared/protocol.ts'
import type { DiscoverView, StateView, ValidateView } from '../shared/protocol.ts'
import { diag } from './diag.ts'
import type { ReplaceView } from '../shared/protocol.ts'

/** The state the row needs, supplied by the host entry. */
export interface RouteDeps {
  readonly readSettings: () => TerminalToolSettings
  readonly cache: DiscoveryCache
  readonly settingsAvailable: () => boolean
  readonly capability: () => StateView['capability']
  readonly lastReplace: () => ReplaceView | undefined
}

/** JSON response. */
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Read a JSON body, tolerating an empty or malformed one. */
async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json()
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** Strip the profile to its wire fields (no functions; already plain). */
function toView(profile: BashProfile): BashProfile {
  return profile
}

/** Register the three routes. */
export function registerRoutes(ctx: HostContextLike, deps: RouteDeps): void {
  const attach = (target: HostContextLike): void => {
    const connection = target.get('connection') as ConnectionServiceLike | undefined
    const register = connection?.fetch?.register
    if (connection === undefined || connection === null || typeof register !== 'function') {
      diag('routes: ctx.connection.fetch is not visible')
      return
    }

    const make = (path: string, handler: (body: Record<string, unknown>) => unknown): void => {
      try {
        const dispose = register.call(connection.fetch, {
          path,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request: Request): Promise<Response> => {
            try {
              return json(handler(await readBody(request)))
            } catch (error) {
              diag(`routes: ${path} failed: ${messageOf(error)}`)
              return json({ ok: false, error: messageOf(error) })
            }
          },
        })
        target.effect?.(() => () => { void dispose }, `dsh-gitbash: route ${path}`)
        diag(`routes: registered ${path}`)
      } catch (error) {
        diag(`routes: register ${path} failed: ${messageOf(error)}`)
      }
    }

    make(ROUTE_STATE, (): StateView => {
      const settings = deps.readSettings()
      const resolved = resolveEffectiveProfile(settings, deps.cache, false)
      return {
        ok: true,
        platform: process.platform,
        settingsAvailable: deps.settingsAvailable(),
        bashPath: settings.bashPath,
        msystem: settings.msystem,
        compat: settings.compat,
        ...resolved.profile !== undefined ? { effective: toView(resolved.profile) } : {},
        capability: deps.capability(),
        ...deps.lastReplace() !== undefined ? { lastReplace: deps.lastReplace() } : {},
        namespace: SETTINGS_NAMESPACE,
      }
    })

    make(ROUTE_DISCOVER, (body): DiscoverView => {
      const savedPath = typeof body.savedPath === 'string' && body.savedPath.length > 0 ? body.savedPath : undefined
      const msystem = typeof body.msystem === 'string' ? body.msystem : undefined
      // Full scan + version probe: this runs only when the user asks.
      const discovered = deps.cache.refresh({
        ...savedPath !== undefined ? { savedPath } : {},
        ...msystem !== undefined ? { msystem: msystem as TerminalToolSettings['msystem'] } : {},
        probe: true,
      })
      return {
        ok: true,
        candidates: discovered.candidates.map(toView),
        ...discovered.recommended !== undefined ? { recommended: toView(discovered.recommended) } : {},
        notes: discovered.notes,
      }
    })

    make(ROUTE_VALIDATE, (body): ValidateView => {
      const path = typeof body.path === 'string' ? body.path : ''
      const msystem = typeof body.msystem === 'string' ? body.msystem as TerminalToolSettings['msystem'] : 'auto'
      if (path.trim().length === 0) return { ok: true, problem: 'bashPath is empty' }
      const resolved = profileFromPath(path, msystem, true)
      return resolved.profile !== undefined
        ? { ok: true, profile: toView(resolved.profile) }
        : { ok: true, problem: resolved.problem ?? 'invalid bash path' }
    })
  }

  // `connection` may activate after this plugin; wait for it locally without
  // making it a hard dependency of the host row (headless compositions).
  if (typeof ctx.inject === 'function') {
    ctx.inject(['connection'], scoped => attach(scoped))
    return
  }
  attach(ctx)
}

/** One-line error text. */
function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error)
}
