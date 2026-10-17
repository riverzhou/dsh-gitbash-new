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

/** Client plugin body. */
export function apply(ctx: PluginClientContextLike): void {
  const locale = ctx.get('locale') as LocaleLike | undefined
  registerLocale(ctx, locale)
  const t: Translate = locale?.bind(LOCALE_NS) ?? ((key: string) => key)

  const slots = ctx.get('slots') as SlotsServiceLike | undefined
  if (slots === undefined || slots === null || typeof slots.inject !== 'function') return

  const binder = (): SettingsScopeBinderLike | undefined => {
    const candidate = (ctx.get('webUiSettings') ?? ctx.get('settingsScope')) as SettingsScopeBinderLike | undefined
    return candidate !== undefined && candidate !== null && typeof candidate.bind === 'function' ? candidate : undefined
  }

  const nativeForm = (): SettingsScopeLike<RowConfig> | undefined => {
    const forms = ctx.get('configForms') as ConfigFormsLike | undefined
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
  const seatRow = (scope: SettingsScopeLike<RowConfig> | undefined): void => {
    if (seated) return
    seated = true
    slots.inject('settings.general.item', () => slots.register(
      { name: 'settings.general.item', id: GENERAL_ITEM_ID, order: GENERAL_ITEM_ORDER, locale: LOCALE_NS },
      () => createElement(TerminalToolRow, { t, scope }),
    ))
  }

  const family = binder()
  if (family !== undefined) {
    const scoped = bind(family) ?? nativeForm()
    if (scoped !== undefined) {
      seatRow(scoped)
      return
    }
  }
  const native = nativeForm()
  if (native !== undefined) {
    seatRow(native)
    return
  }
  // The settings domain may activate after this plugin. Both services are
  // optional lookups; hard-injecting them would leave the row pending forever
  // on compositions that never provide them.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webUiSettings'], () => {
      if (seated) return
      const late = binder()
      if (late !== undefined) seatRow(bind(late))
    })
    ctx.inject(['configForms'], () => {
      if (seated) return
      const late = nativeForm()
      if (late !== undefined) {
        seatRow(late)
        return
      }
      const forms = ctx.get('configForms') as ConfigFormsLike | undefined
      if (typeof forms?.whileServed === 'function') {
        try {
          forms.whileServed([SETTINGS_NAMESPACE], () => {
            if (seated) return
            const served = nativeForm()
            if (served !== undefined) seatRow(served)
          })
        } catch {
          // Leave the row unseated; the user can reload once the settings domain is up.
        }
      }
    })
  }
}
