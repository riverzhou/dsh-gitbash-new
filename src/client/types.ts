/**
 * Client-side structural projections (0.2.2). The bundle may require only the
 * page seed modules (`react` / `react/jsx-runtime`), so DSH client packages are
 * reached through services and typed by shape here.
 */

export type Translate = (key: string, params?: Record<string, string>) => string

export interface LocaleLike {
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): unknown
  register(namespace: string, language: string, dictionary: Record<string, string>): unknown
  bind(namespace: string): Translate
}

export interface SlotRegisterOptionsLike {
  readonly name: string
  readonly id: string
  readonly order: number
  readonly locale?: string
}

export interface SlotsServiceLike {
  inject(key: string, callback: () => unknown): unknown
  register(options: SlotRegisterOptionsLike, component: (props: unknown) => unknown): unknown
}

/** Snapshot of a config form (0.2.2: no `mode` field). */
export interface SettingsScopeSnapshotLike<T> {
  readonly status: 'loading' | 'ready' | 'unavailable'
  readonly value: T | undefined
  readonly base: unknown
  readonly user: unknown
  readonly revision: number | undefined
  readonly writable: boolean
}

/** A namespace-bound config form. */
export interface SettingsScopeLike<T> {
  getSnapshot(): SettingsScopeSnapshotLike<T>
  subscribe(listener: () => void): () => void
  mutate(
    ops: readonly { op: 'set' | 'unset'; path: readonly string[]; value?: unknown }[],
    expectedRevision?: number,
  ): Promise<unknown>
  set(field: string, value: unknown): Promise<unknown>
  unset(field: string): Promise<unknown>
}

/** The official `configForms` service. */
export interface ConfigFormsLike {
  get<T>(entryId: string): SettingsScopeLike<T>
  /** Invoke `register` once the given namespaces are served (0.2.2). */
  whileServed?(
    namespaces: readonly string[],
    register: (served: ReadonlySet<string>) => () => void,
  ): () => void
}

/** The family compatibility binder (`webUiSettings` / old `settingsScope`). */
export interface SettingsScopeBinderLike {
  bind<T>(spec: { namespace: string; decode?: (section: unknown) => T | undefined }): SettingsScopeLike<T>
}

export interface PluginClientContextLike {
  get(name: string): unknown
  effect?(callback: () => (() => void) | void, label?: string): unknown
  inject?(services: readonly string[], callback: () => void): unknown
}

/** The plugin config as the form exposes it. */
export interface ClientConfig {
  readonly bashPath: string
  readonly msystem: string
  readonly compat: string
}
