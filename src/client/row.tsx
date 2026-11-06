/**
 * General-settings row, compact by default:
 *   [effective badge]
 *   Shell   [auto / Git / MSYS2 environment …]   [refresh]
 *   Compat  [compatibility / strict]
 *   ⚠ one-line warning
 *   ▸ Advanced & diagnostics (manual path, test, MSYS2 env, status)
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { createRowController, type RowConfig } from './store.ts'
import type { SettingsScopeLike, Translate } from './types.ts'
import { MSYSTEM_SETTINGS } from '../shared/protocol.ts'
import type { BashProfileView, MsystemSetting } from '../shared/protocol.ts'

export interface TerminalToolRowProps {
  readonly t: Translate
  readonly scope?: SettingsScopeLike<RowConfig> | undefined
}

const AUTO = '__auto__'
const MANUAL = '__manual__'

const styles: Record<string, CSSProperties> = {
  card: {
    border: '1px solid color-mix(in srgb, currentColor 14%, transparent)',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'grid',
    gap: 8,
    fontSize: 13,
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { fontWeight: 600, fontSize: 14 },
  subtitle: { opacity: 0.65, lineHeight: 1.4, fontSize: 12 },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { minWidth: 62, opacity: 0.75, fontSize: 12 },
  select: {
    minWidth: 220,
    maxWidth: '100%',
    padding: '4px 7px',
    // Native <select> popups do not inherit the page's surface color on
    // Windows: a transparent control yields a white list with the theme's
    // white text. Use the host's theme tokens on both the control and every
    // <option>, with system-color fallbacks for older hosts.
    border: '1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 22%, transparent))',
    borderRadius: 6,
    backgroundColor: 'var(--dsw-alias-bg-layer-2, Canvas)',
    color: 'var(--dsw-alias-brand-text, CanvasText)',
    fontSize: 12,
  },
  option: {
    backgroundColor: 'var(--dsw-alias-bg-layer-2, Canvas)',
    color: 'var(--dsw-alias-brand-text, CanvasText)',
  },
  input: {
    flex: 1,
    minWidth: 220,
    padding: '4px 8px',
    border: '1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 22%, transparent))',
    borderRadius: 6,
    backgroundColor: 'var(--dsw-alias-bg-layer-1, Canvas)',
    color: 'var(--dsw-alias-brand-text, CanvasText)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 12,
  },
  button: {
    padding: '3px 9px',
    border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
    borderRadius: 6,
    background: 'color-mix(in srgb, currentColor 6%, transparent)',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 12,
  },
  buttonPrimary: {
    padding: '3px 9px',
    border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
    borderRadius: 6,
    background: 'color-mix(in srgb, currentColor 14%, transparent)',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  warning: {
    border: '1px solid color-mix(in srgb, #e5484d 40%, transparent)',
    background: 'color-mix(in srgb, #e5484d 7%, transparent)',
    borderRadius: 7,
    padding: '5px 8px',
    lineHeight: 1.45,
    fontSize: 12,
  },
  strict: {
    border: '1px solid color-mix(in srgb, #f5a623 40%, transparent)',
    background: 'color-mix(in srgb, #f5a623 7%, transparent)',
    borderRadius: 7,
    padding: '5px 8px',
    lineHeight: 1.45,
    fontSize: 12,
  },
  muted: { opacity: 0.65, fontSize: 12 },
  error: { color: '#e5484d', fontSize: 12, lineHeight: 1.45 },
  badge: {
    border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
    borderRadius: 999,
    padding: '0 8px',
    fontSize: 11,
    opacity: 0.85,
    whiteSpace: 'nowrap',
  },
  summary: { cursor: 'pointer', opacity: 0.75, fontSize: 12 },
  detailsBody: { display: 'grid', gap: 8, paddingTop: 8 },
  status: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px 10px', fontSize: 11, opacity: 0.8 },
  code: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
}

/** Profile label for the selector: the host label plus the probed version. */
function profileLabel(profile: BashProfileView): string {
  return profile.version !== undefined ? `${profile.label} ${profile.version}` : profile.label
}

/** Compare paths case-insensitively with either separator. */
function samePath(a: string, b: string): boolean {
  return a.replaceAll('/', '\\').toLowerCase() === b.replaceAll('/', '\\').toLowerCase()
}

/** The compact row. */
export function TerminalToolRow({ t, scope }: TerminalToolRowProps): ReactElement {
  const controller = useMemo(() => createRowController(scope), [scope])
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.getState, controller.store.getState)
  const [draftPath, setDraftPath] = useState(state.config.bashPath)
  const [advanced, setAdvanced] = useState(false)
  const pathInput = useRef<HTMLInputElement>(null)

  useEffect(() => controller.start(), [controller])
  useEffect(() => {
    setDraftPath(state.config.bashPath)
  }, [state.config.bashPath])

  const disabled = !state.writable || state.saving || state.discovering
  const compat = state.config.compat
  const candidates = state.candidates
  const matched = state.config.bashPath.length === 0
    ? undefined
    : candidates.find(candidate => samePath(candidate.path, state.config.bashPath)
      && (state.config.msystem === 'auto' || (candidate.msystem ?? 'auto') === state.config.msystem))
  const selectedValue = state.config.bashPath.length === 0
    ? AUTO
    : matched?.id ?? MANUAL

  const choose = (value: string): void => {
    if (value === AUTO) {
      void controller.resetAuto()
      return
    }
    if (value === MANUAL) {
      setAdvanced(true)
      setTimeout(() => pathInput.current?.focus(), 0)
      return
    }
    const profile = candidates.find(candidate => candidate.id === value)
    if (profile !== undefined) void controller.useProfile(profile)
  }

  /**
   * Apply the manual path. A changed path may switch families (Git ↔ MSYS2), so
   * reset `msystem` to `auto` in the same write; otherwise a stale UCRT64 value
   * would make a newly entered Git path invalid, and vice versa.
   */
  const applyManualPath = (): void => {
    const next = draftPath.trim()
    void controller.setConfig(next !== state.config.bashPath
      ? { bashPath: next, msystem: 'auto' }
      : { bashPath: next })
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>{t('title')}</div>
          <div style={styles.subtitle}>{t('subtitleShort')}</div>
        </div>
        <span style={styles.badge} title={state.effective?.path}>
          {state.effective?.label ?? t('noPath')}
        </span>
      </div>

      {!state.writable ? <div style={styles.muted}>{state.scopeStatus === 'unavailable' ? t('unavailable') : t('readOnly')}</div> : null}
      {!state.capability.supported && state.capability.reason !== undefined
        ? <div style={styles.error}>{t('unsupported')}{state.capability.reason}</div>
        : null}

      <div style={styles.row}>
        <span style={styles.label}>{t('shell')}</span>
        <select
          style={styles.select}
          value={selectedValue}
          disabled={disabled}
          onChange={event => choose(event.target.value)}
        >
          <option value={AUTO} style={styles.option}>{t('autoRecommended')}</option>
          {candidates.map(profile => (
            <option key={profile.id} value={profile.id} disabled={!profile.valid} style={styles.option}>
              {profileLabel(profile)}{profile.valid ? '' : ` — ${profile.problem ?? t('invalidPath')}`}
            </option>
          ))}
          {selectedValue === MANUAL ? <option value={MANUAL} style={styles.option}>{t('manualPath')}: {state.config.bashPath}</option> : null}
        </select>
        <button style={styles.button} disabled={disabled} onClick={() => void controller.discover()}>
          {state.discovering ? t('refreshing') : t('refresh')}
        </button>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>{t('compat')}</span>
        <select
          style={styles.select}
          value={compat}
          disabled={!state.writable || state.saving}
          onChange={event => void controller.setConfig({ compat: event.target.value as RowConfig['compat'] })}
        >
          <option value="auto" style={styles.option}>{t('compatAuto')}</option>
          <option value="strict" style={styles.option}>{t('compatStrict')}</option>
        </select>
      </div>

      <div
        style={compat === 'auto' ? styles.warning : styles.strict}
        title={compat === 'auto' ? t('warningAuto') : t('warningStrict')}
      >
        {compat === 'auto' ? t('warningShort') : t('warningStrictShort')}
      </div>

      {state.error !== undefined || state.problem !== undefined
        ? <div style={styles.error}>{state.error ?? state.problem}</div>
        : null}

      <details
        open={advanced}
        onToggle={event => setAdvanced((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary style={styles.summary}>{t('advanced')}</summary>
        <div style={styles.detailsBody}>
          <div style={styles.row}>
            <span style={styles.label}>{t('pathLabel')}</span>
            <input
              ref={pathInput}
              style={styles.input}
              value={draftPath}
              placeholder={t('pathPlaceholder')}
              spellCheck={false}
              disabled={!state.writable || state.saving}
              onChange={event => setDraftPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyManualPath()
              }}
            />
            <button style={styles.buttonPrimary} disabled={disabled} onClick={applyManualPath}>
              {t('apply')}
            </button>
            <button style={styles.button} disabled={disabled} onClick={() => void controller.resetAuto()}>
              {t('reset')}
            </button>
            <button style={styles.button} disabled={disabled || state.validating} onClick={() => void controller.validate()}>
              {state.validating ? t('testing') : t('test')}
            </button>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>{t('msystem')}</span>
            <select
              style={styles.select}
              value={state.config.msystem}
              disabled={!state.writable || state.saving || state.effective?.flavor === 'git'}
              onChange={event => void controller.setConfig({ msystem: event.target.value as MsystemSetting })}
            >
              {MSYSTEM_SETTINGS.map(option => (
                <option key={option} value={option} style={styles.option}>{option === 'auto' ? t('msystemAuto') : option}</option>
              ))}
            </select>
            <span style={styles.muted}>{t('msystemHint')}</span>
          </div>

          <div style={styles.status}>
            <span>{t('platform')}</span><span style={styles.code}>{state.platform || '—'}</span>
            <span>{t('sandboxMode')}</span><span style={styles.code}>{state.capability.shellSandboxMode ?? '—'}</span>
            <span>{t('backgroundJobs')}</span><span style={styles.code}>{state.capability.backgroundJobs ? t('yes') : t('no')}</span>
            <span>{t('lastReplace')}</span>
            <span style={styles.code}>
              {state.lastReplace === undefined
                ? '—'
                : `${state.lastReplace.applied ? t('applied') : t('skipped')}${state.lastReplace.reason !== undefined ? `: ${state.lastReplace.reason}` : ''}`}
            </span>
          </div>

          {state.notice !== undefined && state.error === undefined ? <div style={styles.muted}>{state.notice}</div> : null}
        </div>
      </details>
    </div>
  )
}
