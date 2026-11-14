/**
 * Browser entry: register the dictionaries and one General-settings row.
 *
 * The row owns its own value/write surface: `settings.general.item` provides no
 * props, so the component resolves the plugin's config form itself
 * (`configForms.get(entryId)`; the family compatibility binder is a fallback).
 */
import { createElement } from 'react'
import { dictionaries, LOCALE_NS } from './locales.ts'
import { TerminalToolRow } from './row.tsx'
import { SETTINGS_NAMESPACE, stripMatchingQuotes } from '../shared/protocol.ts'
import type { RowConfig } from './store.ts'
import type {
  ConfigFormsLike,
  LocaleLike,
  PluginClientContextLike,
  SettingsScopeBinderLike,
  SettingsScopeLike,
  SlotsServiceLike,
  Translate,
} from './types.ts'

/** The General-list item id and order. */
export const GENERAL_ITEM_ID = 'git-bash'
export const GENERAL_ITEM_ORDER = 60

/** Locale and slot registration are the only hard dependencies. */
export const inject = ['slots', 'locale']

/** Decode the form section into the row's value shape. */
export function decodeConfig(section: unknown): RowConfig | undefined {
  if (typeof section !== 'object' || section === null || Array.isArray(section)) return undefined
  const record = section as Record<string, unknown>
  return {
    bashPath: typeof record.bashPath === 'string' ? stripMatchingQuotes(record.bashPath) : '',
    msystem: (typeof record.msystem === 'string' ? record.msystem : 'auto') as RowConfig['msystem'],
    compat: (typeof record.compat === 'string' ? record.compat : 'auto') as RowConfig['compat'],
  }
}

/** Collect a disposer-shaped return into a callable. */
function asDisposer(value: unknown): () => void {
  return typeof value === 'function' ? value as () => void : () => undefined
}

/** Register the locale dictionaries once. */
function registerLocale(ctx: PluginClientContextLike, locale: LocaleLike | undefined): () => void {
  if (locale === undefined) return () => undefined
  const register = (): (() => void) => {
    const disposers: (() => void)[] = []
    try {
      disposers.push(asDisposer(locale.register(LOCALE_NS, dictionaries)))
    } catch {
      try {
        disposers.push(asDisposer(locale.register(LOCALE_NS, 'zh', dictionaries.zh ?? {})))
        disposers.push(asDisposer(locale.register(LOCALE_NS, 'en', dictionaries.en ?? {})))
      } catch {
        // HMR re-apply: the namespace already exists.
      }
    }
    return () => {
      for (const dispose of disposers) dispose()
    }
  }
  if (typeof ctx.effect === 'function') {
    ctx.effect(register, 'dsh-gitbash: dictionaries')
    return () => undefined
  }
  return register()
}

/** Read a client service without letting a missing/early provider break apply. */
function readService<T>(ctx: PluginClientContextLike, name: string): T | undefined {
  try {
    const value = ctx.get(name)
    return value === undefined || value === null ? undefined : value as T
  } catch {
    return undefined
  }
}

/** Client plugin body. */
export function apply(ctx: PluginClientContextLike): void {
  const locale = readService<LocaleLike>(ctx, 'locale')
  registerLocale(ctx, locale)
  const t: Translate = locale?.bind(LOCALE_NS) ?? ((key: string) => key)

  const slots = readService<SlotsServiceLike>(ctx, 'slots')
  if (slots === undefined || slots === null || typeof slots.inject !== 'function') return

  const binder = (): SettingsScopeBinderLike | undefined => {
    const candidate = readService<SettingsScopeBinderLike>(ctx, 'webUiSettings')
      ?? readService<SettingsScopeBinderLike>(ctx, 'settingsScope')
    return candidate !== undefined && candidate !== null && typeof candidate.bind === 'function' ? candidate : undefined
  }

  const nativeForm = (scopeCtx: PluginClientContextLike = ctx): SettingsScopeLike<RowConfig> | undefined => {
    const forms = readService<ConfigFormsLike>(scopeCtx, 'configForms')
    if (forms === undefined || forms === null || typeof forms.get !== 'function') return undefined
    try {
      return forms.get<RowConfig>(SETTINGS_NAMESPACE)
    } catch {
      return undefined
    }
  }

  const bind = (scopeBinder: SettingsScopeBinderLike): SettingsScopeLike<RowConfig> | undefined => {
    try {
      return scopeBinder.bind<RowConfig>({ namespace: SETTINGS_NAMESPACE, decode: decodeConfig })
    } catch {
      return undefined
    }
  }

  let seated = false
  let seatDispose: (() => void) | undefined
  let seatedScope: SettingsScopeLike<RowConfig> | undefined
  const noop = (): void => {}
  /** Seat the row and return the disposer that unregisters it. */
  const seatRow = (scope: SettingsScopeLike<RowConfig> | undefined): (() => void) => {
    if (seated && seatedScope === scope) return seatDispose ?? noop
    if (seated) {
      // A provider replacement hands us a new scope; release the old row first.
      const previous = seatDispose
      seatDispose = undefined
      seated = false
      seatedScope = undefined
      previous?.()
    }
    seated = true
    let inner: (() => void) | undefined
    const release = (): void => {
      try {
        inner?.()
      } catch {
        // The slot was already released by a plugin/context teardown.
      }
      if (seatDispose === release) {
        seatDispose = undefined
        seated = false
        seatedScope = undefined
      }
    }
    try {
      const dispose = slots.inject('settings.general.item', () => slots.register(
        { name: 'settings.general.item', id: GENERAL_ITEM_ID, order: GENERAL_ITEM_ORDER, locale: LOCALE_NS },
        () => createElement(TerminalToolRow, { t, scope }),
      ))
      if (typeof dispose === 'function') inner = dispose as () => void
      seatDispose = release
      seatedScope = scope
      return release
    } catch (error) {
      // A duplicate slot id after an HMR re-apply is not fatal; leave the row
      // unseated instead of letting the client plugin throw, but leave a trace
      // so a stale registration is diagnosable.
      console.warn('[dsh-gitbash] settings row registration failed:', error)
      seated = false
      seatedScope = undefined
      return noop
    }
  }
  /** Own a one-shot seat for the plugin lifetime. */
  const seat = (scope: SettingsScopeLike<RowConfig> | undefined): void => {
    const dispose = seatRow(scope)
    if (dispose !== noop && typeof ctx.effect === 'function') {
      try {
        ctx.effect(() => dispose, 'dsh-gitbash: settings row')
      } catch {
        // The row is live; context teardown may still release the slot.
      }
    }
  }

  /**
   * Watch the namespace through the official lifecycle API. The row exists only
   * while the Host serves the namespace: it is disposed when the settings
   * provider goes away and re-seated when the namespace comes back, instead of
   * keeping a form whose writes can only fail. Re-installing disposes the
   * previous watch, which covers a configForms service replacement/HMR.
   */
  let stopWatch: (() => void) | undefined
  const installWatch = (forms: ConfigFormsLike, scopeCtx: PluginClientContextLike): boolean => {
    if (typeof forms.whileServed !== 'function') return false
    const previous = stopWatch
    stopWatch = undefined
    try {
      previous?.()
    } catch {
      // A dead provider disposer must not take the page down; keep going.
    }
    let releaseWatch: () => void
    try {
      const whileServed = forms.whileServed.bind(forms)
      releaseWatch = asDisposer(whileServed([SETTINGS_NAMESPACE], () => {
        const servedScope = nativeForm(scopeCtx)
        return servedScope === undefined ? noop : seatRow(servedScope)
      }))
    } catch (error) {
      console.warn('[dsh-gitbash] settings namespace watch failed:', error)
      return false
    }
    let stopped = false
    const stop = (): void => {
      if (stopped) return
      stopped = true
      if (stopWatch === stop) stopWatch = undefined
      releaseWatch()
    }
    stopWatch = stop
    if (typeof scopeCtx.effect === 'function') {
      try {
        scopeCtx.effect(() => stop, 'dsh-gitbash: settings row watch')
      } catch {
        // The watch is live; context teardown may still release it.
      }
    }
    return true
  }

  // Primary path: the official configForms service exists, so let it decide
  // when the namespace is actually served.
  const forms = readService<ConfigFormsLike>(ctx, 'configForms')
  if (forms !== undefined && installWatch(forms, ctx)) {
    // The service implementation can be replaced (HMR / profile reload) without
    // re-applying this plugin. Re-watch on a new implementation uid so a row
    // never keeps a disposed form. The callback receives its own scope; use it
    // so the watch is disposed when that provider unloads.
    if (typeof ctx.inject === 'function') {
      try {
        ctx.inject(['configForms'], (scope) => {
          const target = scope ?? ctx
          const next = readService<ConfigFormsLike>(target, 'configForms')
          if (next !== undefined && typeof next.whileServed === 'function' && installWatch(next, target)) return
          const lateScope = nativeForm(target)
          if (lateScope !== undefined) seat(lateScope)
        })
      } catch {
        // Replacement watching is optional; the initial watch still works.
      }
    }
    return
  }

  // Compatibility path for hosts without whileServed (or without configForms).
  const family = binder()
  if (family !== undefined) {
    const scoped = bind(family) ?? nativeForm()
    if (scoped !== undefined) {
      seat(scoped)
      return
    }
  }
  const native = nativeForm()
  if (native !== undefined) {
    seat(native)
    return
  }
  // The settings domain may activate after this plugin. Both services are
  // optional lookups; hard-injecting them would leave the row pending forever
  // on compositions that never provide them.
  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['webUiSettings'], () => {
        if (seated) return
        const late = binder()
        const scoped = late !== undefined ? bind(late) : undefined
        if (scoped !== undefined) seat(scoped)
      })
    } catch {
      // Late activation is optional; the native form path still works.
    }
    try {
      ctx.inject(['configForms'], (scope) => {
        const target = scope ?? ctx
        const late = readService<ConfigFormsLike>(target, 'configForms')
        if (late !== undefined && installWatch(late, target)) return
        const lateScope = nativeForm(target)
        if (lateScope !== undefined) seat(lateScope)
      })
    } catch {
      // Late activation is optional; the row stays unseated rather than breaking the client plugin.
    }
  }
}

/**
 * Internal controller exports for the Node-side client tests. The Host never
 * consumes these; the browser bundle publishes them alongside `apply`.
 */
export { createRowController, NOTICE_VERSION_OK, NOTICE_VERSION_OK_UNSAVED } from './store.ts'
