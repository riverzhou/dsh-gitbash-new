/**
 * The settings row's state: the plugin config form (source of truth for
 * persistence) plus the host's read-only `/api` status.
 */
import { fetchDiscover, fetchState, fetchValidate } from './api.ts'
import { COMPAT_MODES, MSYSTEM_SETTINGS, stripMatchingQuotes } from '../shared/protocol.ts'
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
  const msystem = typeof record.msystem === 'string' && (MSYSTEM_SETTINGS as readonly string[]).includes(record.msystem)
    ? record.msystem as MsystemSetting
    : 'auto'
  const compat = typeof record.compat === 'string' && (COMPAT_MODES as readonly string[]).includes(record.compat)
    ? record.compat as CompatMode
    : 'auto'
  return {
    bashPath: typeof record.bashPath === 'string' ? stripMatchingQuotes(record.bashPath) : '',
    msystem,
    compat,
  }
}

/** Notice literals shared with the row so it can localize them. */
export const NOTICE_VERSION_OK = 'bash --version OK'
export const NOTICE_VERSION_OK_UNSAVED = 'bash --version OK (unsaved path)'

/** The controller the row subscribes to. */
export interface RowController {
  readonly store: Store<RowState>
  start(): () => void
  setConfig(patch: Partial<RowConfig>): Promise<void>
  discover(): Promise<void>
  /** Validate the saved path or the draft the user is editing. */
  validate(path?: string): Promise<void>
  useProfile(profile: BashProfileView): Promise<void>
  resetAuto(): Promise<void>
  refresh(): Promise<void>
}

/** Create the controller. */
export function createRowController(scope: SettingsScopeLike<RowConfig> | undefined): RowController {
  const snapshotOf = () => {
    try {
      return scope?.getSnapshot()
    } catch {
      return undefined
    }
  }
  const initial = snapshotOf()
  const store = createStore<RowState>({
    status: 'loading',
    scopeStatus: initial?.status ?? 'unavailable',
    writable: initial?.writable ?? false,
    platform: '',
    config: configOf(initial?.value),
    capability: DEFAULT_CAPABILITY,
    candidates: [],
    discovered: false,
    saving: false,
    discovering: false,
    validating: false,
  })
  let disposed = false
  let pendingSaves = 0
  let stateSequence = 0
  let discoverSequence = 0
  let validateSequence = 0
  /**
   * The operation that owns the current error. A passive /state refresh must
   * not erase a save/validate/discover failure the user has not seen yet.
   */
  let errorOwner: 'refresh' | 'save' | 'discover' | 'validate' | undefined

  const clearOwnedError = (owner: typeof errorOwner): void => {
    if (errorOwner !== owner) return
    errorOwner = undefined
    store.setState({ error: undefined })
  }

  const isProfile = (value: unknown): value is BashProfileView => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return typeof record.id === 'string'
      && typeof record.path === 'string'
      && typeof record.root === 'string'
      && typeof record.label === 'string'
      && typeof record.flavor === 'string'
      && typeof record.valid === 'boolean'
  }

  const isCapability = (value: unknown): value is CapabilityView => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return typeof record.supported === 'boolean'
      && typeof record.backgroundJobs === 'boolean'
      && typeof record.bashAvailable === 'boolean'
  }

  const isLastReplace = (value: unknown): boolean => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    return typeof record.applied === 'boolean'
      && (record.reason === undefined || typeof record.reason === 'string')
  }

  /** Reject malformed 200 responses instead of letting the row render crash. */
  const assertState = (state: StateView): void => {
    if (typeof state !== 'object' || state === null || Array.isArray(state)) throw new Error('unexpected /state response')
    const record = state as unknown as Record<string, unknown>
    if (typeof record.platform !== 'string'
      || !Array.isArray(record.candidates) || !record.candidates.every(isProfile)
      || !isCapability(record.capability)
      || (record.problem !== undefined && typeof record.problem !== 'string')
      || (record.capability as { reason?: unknown }).reason !== undefined
        && typeof (record.capability as { reason?: unknown }).reason !== 'string'
      || (record.capability as { shellSandboxMode?: unknown }).shellSandboxMode !== undefined
        && typeof (record.capability as { shellSandboxMode?: unknown }).shellSandboxMode !== 'string'
      || record.lastReplace !== undefined && !isLastReplace(record.lastReplace)
      || (record.effective !== undefined && !isProfile(record.effective))
      || (record.recommended !== undefined && !isProfile(record.recommended))) {
      throw new Error('unexpected /state response')
    }
  }

  const applyState = (state: StateView): void => {
    assertState(state)
    const snapshot = snapshotOf()
    const fromState = configOf({ bashPath: state.bashPath, msystem: state.msystem, compat: state.compat })
    store.setState({
      status: 'ready',
      scopeStatus: snapshot?.status ?? 'unavailable',
      writable: snapshot?.writable ?? false,
      platform: state.platform,
      config: snapshot?.value !== undefined ? configOf(snapshot.value) : fromState,
      ...(state.effective !== undefined ? { effective: state.effective } : { effective: undefined }),
      ...(state.problem !== undefined ? { problem: state.problem } : { problem: undefined }),
      candidates: state.candidates,
      ...(state.recommended !== undefined ? { recommended: state.recommended } : { recommended: undefined }),
      discovered: true,
      capability: state.capability,
      ...(state.lastReplace !== undefined ? { lastReplace: state.lastReplace } : { lastReplace: undefined }),
      // A fresh problem invalidates an older success notice.
      ...(state.problem !== undefined ? { notice: undefined } : {}),
    })
  }

  const refresh = async (): Promise<void> => {
    const sequence = ++stateSequence
    try {
      const state = await fetchState()
      if (disposed || sequence !== stateSequence) return
      clearOwnedError('refresh')
      applyState(state)
    } catch (error) {
      if (disposed || sequence !== stateSequence) return
      // A passive refresh must not hide a save/validate/discover error the user
      // has not acted on yet. Only refresh owns the slot while it is unowned.
      if (errorOwner === undefined || errorOwner === 'refresh') {
        errorOwner = 'refresh'
        store.setState({ status: 'error', error: messageOf(error) })
      }
    }
  }

  const start = (): (() => void) => {
    disposed = false
    const unsubscribers: (() => void)[] = []
    if (scope !== undefined) {
      const sync = (): void => {
        const snapshot = snapshotOf()
        if (snapshot === undefined) return
        const current = store.getState().config
        const next = snapshot.value !== undefined ? configOf(snapshot.value) : undefined
        // Clear a success notice only when the config actually changed; an
        // unrelated settings publication must not erase it.
        const changed = next !== undefined
          && (next.bashPath !== current.bashPath || next.msystem !== current.msystem || next.compat !== current.compat)
        store.setState({
          scopeStatus: snapshot.status,
          writable: snapshot.writable,
          ...next !== undefined ? { config: next } : {},
          ...changed ? { notice: undefined } : {},
        })
      }
      sync()
      try {
        unsubscribers.push(scope.subscribe(sync))
      } catch {
        // A disposed/early form still renders the fetched state; live mirroring is optional.
      }
    }
    void refresh()
    return () => {
      disposed = true
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }

  const save = async (patch: Partial<RowConfig>): Promise<void> => {
    if (scope === undefined) throw new Error('settings form unavailable')
    // A save changes the config a Test was started against; drop its late
    // response and clear the spinner the abandoned Test would have cleared.
    validateSequence += 1
    pendingSaves += 1
    errorOwner = undefined
    store.setState({ saving: true, validating: false, error: undefined, notice: undefined })
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
      store.setState({ config: { ...store.getState().config, ...patch }, notice: undefined })
      await refresh()
    } catch (error) {
      errorOwner = 'save'
      store.setState({ error: messageOf(error) })
      throw error
    } finally {
      pendingSaves = Math.max(0, pendingSaves - 1)
      store.setState({ saving: pendingSaves > 0 })
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
    const sequence = ++discoverSequence
    errorOwner = undefined
    store.setState({ discovering: true, error: undefined, notice: undefined })
    const { config } = store.getState()
    try {
      const result = await fetchDiscover(config.bashPath)
      if (disposed || sequence !== discoverSequence) return
      if (typeof result !== 'object' || result === null
        || !Array.isArray(result.candidates) || !result.candidates.every(isProfile)
        || !Array.isArray(result.notes)
        || (result.recommended !== undefined && !isProfile(result.recommended))) {
        throw new Error('unexpected /discover response')
      }
      store.setState({
        discovering: false,
        discovered: true,
        candidates: result.candidates,
        ...result.recommended !== undefined ? { recommended: result.recommended } : { recommended: undefined },
        notice: result.notes.length > 0 ? result.notes.join('; ') : undefined,
      })
      // Pick up a newly discovered effective profile as well as the candidate
      // list; Refresh should leave the badge and diagnostics in sync.
      await refresh()
    } catch (error) {
      if (disposed || sequence !== discoverSequence) return
      errorOwner = 'discover'
      store.setState({ discovering: false, error: messageOf(error) })
    }
  }

  const validate = async (override?: string): Promise<void> => {
    const sequence = ++validateSequence
    errorOwner = undefined
    store.setState({ validating: true, error: undefined, notice: undefined })
    const { config } = store.getState()
    const draft = override === undefined ? '' : stripMatchingQuotes(override).trim()
    const path = draft.length > 0
      ? draft
      : config.bashPath.length > 0
        ? config.bashPath
        : store.getState().effective?.path ?? ''
    // Compare with the same separator/case normalization the selector uses.
    // In auto mode the effective path is the configured one, not a draft.
    const normalize = (value: string): string => value.replaceAll('/', '\\').toLowerCase()
    const configuredPath = config.bashPath.length > 0
      ? config.bashPath
      : store.getState().effective?.path ?? ''
    const saved = normalize(path) === normalize(configuredPath)
    // Apply always resets msystem to auto when it saves a manual path; Test must
    // do the same for a draft, or a cross-family draft reports a false failure.
    const msystemForTest = saved ? config.msystem : 'auto'
    try {
      const result = await fetchValidate(path, msystemForTest)
      if (disposed || sequence !== validateSequence) return
      if (typeof result !== 'object' || result === null) throw new Error('unexpected /validate response')
      if (result.problem !== undefined) {
        if (typeof result.problem !== 'string') throw new Error('unexpected /validate response')
        errorOwner = 'validate'
        store.setState({
          validating: false,
          error: result.problem,
          ...saved ? { effective: undefined } : {},
        })
      } else {
        if (result.profile !== undefined && !isProfile(result.profile)) throw new Error('unexpected /validate response')
        store.setState({
          validating: false,
          ...saved ? { effective: result.profile, problem: undefined } : {},
          notice: saved ? NOTICE_VERSION_OK : NOTICE_VERSION_OK_UNSAVED,
        })
      }
    } catch (error) {
      if (disposed || sequence !== validateSequence) return
      errorOwner = 'validate'
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
  // Duck-type across realms: a browser fetch rejection and a vm/test error have
  // different Error prototypes, but the message is still the useful part.
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.length > 0) return message
  }
  return error instanceof Error && error.message.length > 0 ? error.message : String(error)
}

/** Re-export for the row's type imports. */
export type { Translate }
