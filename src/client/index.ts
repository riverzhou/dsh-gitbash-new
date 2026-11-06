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
import { SETTINGS_NAMESPACE } from '../shared/protocol.ts'
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
    bashPath: typeof record.bashPath === 'string' ? record.bashPath : '',
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

  const nativeForm = (): SettingsScopeLike<RowConfig> | undefined => {
    const forms = readService<ConfigFormsLike>(ctx, 'configForms')
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
  const noop = (): void => {}
  /** Seat the row and return the disposer that unregisters it. */
  const seatRow = (scope: SettingsScopeLike<RowConfig> | undefined): (() => void) => {
    if (seated) return seatDispose ?? noop
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
      }
    }
    try {
      const dispose = slots.inject('settings.general.item', () => slots.register(
        { name: 'settings.general.item', id: GENERAL_ITEM_ID, order: GENERAL_ITEM_ORDER, locale: LOCALE_NS },
        () => createElement(TerminalToolRow, { t, scope }),
      ))
      if (typeof dispose === 'function') inner = dispose as () => void
      seatDispose = release
      return release
    } catch {
      // A duplicate slot id after an HMR re-apply is not fatal; leave the row
      // unseated instead of letting the client plugin throw.
      seated = false
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
      ctx.inject(['configForms'], () => {
        if (seated) return
        const late = nativeForm()
        if (late !== undefined) {
          seat(late)
          return
        }
        const forms = readService<ConfigFormsLike>(ctx, 'configForms')
        if (typeof forms?.whileServed === 'function') {
          const whileServed = forms.whileServed.bind(forms)
          const startWatch = (): (() => void) => whileServed([SETTINGS_NAMESPACE], () => {
            if (seated) return noop
            const servedScope = nativeForm()
            return servedScope !== undefined ? seatRow(servedScope) : noop
          })
          try {
            if (typeof ctx.effect === 'function') ctx.effect(startWatch, 'dsh-gitbash: settings row watch')
            else startWatch()
          } catch {
            // Leave the row unseated; the user can reload once the settings domain is up.
          }
        }
      })
    } catch {
      // Late activation is optional; the row stays unseated rather than breaking the client plugin.
    }
  }
}
