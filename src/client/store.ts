/**
 * The settings row's state: the plugin config form (source of truth for
 * persistence) plus the host's read-only `/api` status.
 */
import { fetchDiscover, fetchState, fetchValidate } from './api.ts'
import { stripMatchingQuotes } from '../shared/protocol.ts'
import type { SettingsScopeLike, Translate } from './types.ts'
import type { BashProfileView, CapabilityView, CompatMode, MsystemSetting, ReplaceView, StateView } from '../shared/protocol.ts'

/** The config shape the form exposes. */
export interface RowConfig {
  readonly bashPath: string
  readonly msystem: MsystemSetting
  readonly compat: CompatMode
}

/** Everything the row renders. */
export interface RowState {
  readonly status: 'loading' | 'ready' | 'error'
  readonly scopeStatus: 'loading' | 'ready' | 'unavailable'
  readonly writable: boolean
  readonly platform: string
  readonly config: RowConfig
  readonly effective?: BashProfileView
  readonly problem?: string
  readonly capability: CapabilityView
  readonly lastReplace?: ReplaceView
  readonly candidates: readonly BashProfileView[]
  readonly recommended?: BashProfileView
  readonly discovered: boolean
  readonly saving: boolean
  readonly discovering: boolean
  readonly validating: boolean
  readonly error?: string
  readonly notice?: string
}

const DEFAULT_CONFIG: RowConfig = { bashPath: '', msystem: 'auto', compat: 'auto' }

const DEFAULT_CAPABILITY: CapabilityView = {
  supported: false,
  backgroundJobs: false,
  bashAvailable: false,
}

/** Minimal external store. */
export interface Store<T> {
  getState(): T
  subscribe(listener: () => void): () => void
  setState(patch: Partial<T>): void
}

/** Create a small external store with shallow comparison. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setState(patch) {
      const next = { ...state, ...patch }
      if (shallowEqual(state, next)) return
      state = next
      for (const listener of [...listeners]) listener()
    },
  }
}

function shallowEqual(a: object, b: object): boolean {
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) if (left[key] !== right[key]) return false
  return true
}

/** Normalize a form value into the config the row uses. */
function configOf(value: unknown): RowConfig {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  return {
    bashPath: typeof record.bashPath === 'string' ? stripMatchingQuotes(record.bashPath) : '',
    msystem: typeof record.msystem === 'string' ? record.msystem as MsystemSetting : 'auto',
    compat: typeof record.compat === 'string' ? record.compat as CompatMode : 'auto',
  }
}

/** The controller the row subscribes to. */
export interface RowController {
  readonly store: Store<RowState>
  start(): () => void
  setConfig(patch: Partial<RowConfig>): Promise<void>
  discover(): Promise<void>
  validate(): Promise<void>
  useProfile(profile: BashProfileView): Promise<void>
  resetAuto(): Promise<void>
  refresh(): Promise<void>
}

/** Create the controller. */
export function createRowController(scope: SettingsScopeLike<RowConfig> | undefined): RowController {
  const store = createStore<RowState>({
    status: 'loading',
    scopeStatus: scope?.getSnapshot().status ?? 'unavailable',
    writable: scope?.getSnapshot().writable ?? false,
    platform: '',
    config: configOf(scope?.getSnapshot().value),
    capability: DEFAULT_CAPABILITY,
    candidates: [],
    discovered: false,
    saving: false,
    discovering: false,
    validating: false,
  })
  let disposed = false

  const applyState = (state: StateView): void => {
    const snapshot = scope?.getSnapshot()
    store.setState({
      status: 'ready',
      scopeStatus: snapshot?.status ?? 'unavailable',
      writable: snapshot?.writable ?? false,
      platform: state.platform,
      config: snapshot?.value !== undefined ? configOf(snapshot.value) : {
        bashPath: state.bashPath,
        msystem: state.msystem,
        compat: state.compat,
      },
      ...(state.effective !== undefined ? { effective: state.effective } : { effective: undefined }),
      ...(state.problem !== undefined ? { problem: state.problem } : { problem: undefined }),
      candidates: state.candidates.length > 0 ? state.candidates : store.getState().candidates,
      ...(state.recommended !== undefined ? { recommended: state.recommended } : {}),
      discovered: true,
      error: undefined,
      capability: state.capability,
      ...(state.lastReplace !== undefined ? { lastReplace: state.lastReplace } : { lastReplace: undefined }),
    })
  }

  const refresh = async (): Promise<void> => {
    try {
      const state = await fetchState()
      if (disposed) return
      applyState(state)
    } catch (error) {
      if (disposed) return
      store.setState({ status: 'error', error: messageOf(error) })
    }
  }

  const start = (): (() => void) => {
    disposed = false
    const unsubscribers: (() => void)[] = []
    if (scope !== undefined) {
      const sync = (): void => {
        const snapshot = scope.getSnapshot()
        store.setState({
          scopeStatus: snapshot.status,
          writable: snapshot.writable,
          ...snapshot.value !== undefined ? { config: configOf(snapshot.value) } : {},
        })
      }
      sync()
      unsubscribers.push(scope.subscribe(sync))
    }
    void refresh()
    return () => {
      disposed = true
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }

  const save = async (patch: Partial<RowConfig>): Promise<void> => {
    if (scope === undefined) throw new Error('settings form unavailable')
    store.setState({ saving: true, error: undefined })
    try {
      const entries = Object.entries(patch) as [keyof RowConfig, RowConfig[keyof RowConfig]][]
      if (entries.length > 0) {
        // path + msystem must change together; one accepted write prevents a
        // path/env mismatch when a revision conflicts between two calls.
        if (typeof scope.mutate === 'function') {
          const accepted = await scope.mutate(entries.map(([key, value]) => ({
            op: 'set' as const,
            path: [key],
            value,
          })))
          if (accepted === false) throw new Error('the host rejected the settings update')
        } else {
          for (const [key, value] of entries) {
            const result = await scope.set(key, value)
            if (result === false) throw new Error(`the host rejected the ${key} update`)
          }
        }
      }
      store.setState({ config: { ...store.getState().config, ...patch }, saving: false, notice: undefined })
      await refresh()
    } catch (error) {
      store.setState({ saving: false, error: messageOf(error) })
      throw error
    }
  }

  const setConfig = async (patch: Partial<RowConfig>): Promise<void> => {
    try {
      await save(patch)
    } catch {
      // `save` already stored the error.
    }
  }

  const discover = async (): Promise<void> => {
    store.setState({ discovering: true, error: undefined, notice: undefined })
    const { config } = store.getState()
    try {
      const result = await fetchDiscover(config.bashPath, config.msystem)
      if (disposed) return
      store.setState({
        discovering: false,
        discovered: true,
        candidates: result.candidates,
        ...result.recommended !== undefined ? { recommended: result.recommended } : { recommended: undefined },
        ...result.notes.length > 0 ? { notice: result.notes.join('; ') } : {},
      })
      // Pick up a newly discovered effective profile as well as the candidate
      // list; Refresh should leave the badge and diagnostics in sync.
      await refresh()
    } catch (error) {
      if (disposed) return
      store.setState({ discovering: false, error: messageOf(error) })
    }
  }

  const validate = async (): Promise<void> => {
    store.setState({ validating: true, error: undefined, notice: undefined })
    const { config } = store.getState()
    const path = config.bashPath.length > 0 ? config.bashPath : store.getState().effective?.path ?? ''
    try {
      const result = await fetchValidate(path, config.msystem)
      if (disposed) return
      if (result.problem !== undefined) {
        store.setState({ validating: false, error: result.problem, effective: undefined })
      } else {
        store.setState({ validating: false, effective: result.profile, notice: 'bash --version OK' })
      }
    } catch (error) {
      if (disposed) return
      store.setState({ validating: false, error: messageOf(error) })
    }
  }

  const useProfile = async (profile: BashProfileView): Promise<void> => {
    await setConfig({ bashPath: profile.path, msystem: profile.msystem ?? 'auto' })
  }

  const resetAuto = async (): Promise<void> => {
    await setConfig({ bashPath: '', msystem: 'auto' })
  }

  return {
    store,
    start,
    setConfig,
    discover,
    validate,
    useProfile,
    resetAuto,
    refresh,
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error)
}

/** Re-export for the row's type imports. */
export type { Translate }
