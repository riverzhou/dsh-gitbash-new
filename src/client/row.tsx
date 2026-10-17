/**
 * The General-settings row: one compact card with the effective profile, a
 * path field, discovery/test actions, the MSYS2 environment, and the
 * compatibility-mode warning.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactElement } from 'react'
import { createRowController, type RowConfig } from './store.ts'
import type { SettingsScopeLike, Translate } from './types.ts'
import type { BashProfileView, MsystemSetting } from '../shared/protocol.ts'

export interface TerminalToolRowProps {
  readonly t: Translate
  readonly scope?: SettingsScopeLike<RowConfig> | undefined
}

const MSYSTEM_OPTIONS: readonly { value: MsystemSetting; label: string }[] = [
  { value: 'auto', label: 'auto' },
  { value: 'UCRT64', label: 'UCRT64' },
  { value: 'MINGW64', label: 'MINGW64' },
  { value: 'CLANG64', label: 'CLANG64' },
  { value: 'CLANGARM64', label: 'CLANGARM64' },
  { value: 'MINGW32', label: 'MINGW32' },
  { value: 'MSYS', label: 'MSYS' },
]

const styles: Record<string, CSSProperties> = {
  card: {
    border: '1px solid color-mix(in srgb, currentColor 14%, transparent)',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'grid',
    gap: 10,
    fontSize: 13,
  },
  header: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { fontWeight: 600, fontSize: 14 },
  subtitle: { opacity: 0.65, lineHeight: 1.45 },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const },
  label: { minWidth: 92, opacity: 0.75 },
  input: {
    flex: 1,
    minWidth: 240,
    padding: '5px 8px',
    border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 12,
  },
  select: {
    padding: '4px 6px',
    border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    fontSize: 12,
  },
  button: {
    padding: '4px 10px',
    border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
    borderRadius: 6,
    background: 'color-mix(in srgb, currentColor 6%, transparent)',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 12,
  },
  buttonPrimary: {
    padding: '4px 10px',
    border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
    borderRadius: 6,
    background: 'color-mix(in srgb, currentColor 14%, transparent)',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  code: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11, opacity: 0.85 },
  warning: {
    border: '1px solid color-mix(in srgb, #e5484d 45%, transparent)',
    background: 'color-mix(in srgb, #e5484d 8%, transparent)',
    color: 'inherit',
    borderRadius: 8,
    padding: '8px 10px',
    lineHeight: 1.45,
  },
  strict: {
    border: '1px solid color-mix(in srgb, #f5a623 45%, transparent)',
    background: 'color-mix(in srgb, #f5a623 8%, transparent)',
    borderRadius: 8,
    padding: '8px 10px',
    lineHeight: 1.45,
  },
  muted: { opacity: 0.65 },
  error: { color: '#e5484d' },
  badge: {
    border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
    borderRadius: 999,
    padding: '0 7px',
    fontSize: 11,
    opacity: 0.8,
  },
  statusGrid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontSize: 12 },
}

/** Human label for one profile. */
function profileLabel(profile: BashProfileView): string {
  const parts = [profile.flavor === 'git' ? 'Git for Windows' : profile.flavor === 'msys2' ? `MSYS2 ${profile.msystem ?? ''}` : 'Cygwin']
  if (profile.version !== undefined) parts.push(profile.version)
  return parts.filter(Boolean).join(' ')
}

/** The row component. */
export function TerminalToolRow({ t, scope }: TerminalToolRowProps): ReactElement {
  const controller = useMemo(() => createRowController(scope), [scope])
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.getState, controller.store.getState)
  const [draftPath, setDraftPath] = useState(state.config.bashPath)
  const [selected, setSelected] = useState('')

  useEffect(() => controller.start(), [controller])
  useEffect(() => {
    setDraftPath(state.config.bashPath)
  }, [state.config.bashPath])

  const disabled = !state.writable || state.saving || state.discovering
  const effective = state.effective
  const compat = state.config.compat

  const onDiscovered = (value: string): void => {
    setSelected(value)
    const profile = state.candidates.find(candidate => candidate.id === value)
    if (profile !== undefined) void controller.useProfile(profile)
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>{t('title')}</div>
          <div style={styles.subtitle}>{t('subtitle')}</div>
        </div>
        <span style={styles.badge}>{effective?.label ?? t('noPath')}</span>
      </div>

      {!state.writable ? <div style={styles.muted}>{state.scopeStatus === 'unavailable' ? t('unavailable') : t('readOnly')}</div> : null}

      <div style={styles.row}>
        <span style={styles.label}>{t('pathLabel')}</span>
        <input
          style={styles.input}
          value={draftPath}
          placeholder={t('pathPlaceholder')}
          spellCheck={false}
          disabled={!state.writable || state.saving}
          onChange={event => setDraftPath(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void controller.setConfig({ bashPath: draftPath.trim() })
          }}
        />
        <button
          style={styles.buttonPrimary}
          disabled={disabled}
          onClick={() => void controller.setConfig({ bashPath: draftPath.trim() })}
        >
          {t('apply')}
        </button>
        <button style={styles.button} disabled={disabled} onClick={() => void controller.resetAuto()}>
          {t('reset')}
        </button>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>{t('auto')}</span>
        <button style={styles.buttonPrimary} disabled={disabled} onClick={() => void controller.discover()}>
          {state.discovering ? t('discovering') : t('auto')}
        </button>
        <button style={styles.button} disabled={disabled || state.validating} onClick={() => void controller.validate()}>
          {state.validating ? t('testing') : t('test')}
        </button>
        {state.candidates.length > 0 ? (
          <select style={styles.select} value={selected} onChange={event => onDiscovered(event.target.value)}>
            <option value="">{t('selectCandidate')}</option>
            {state.candidates.map(profile => (
              <option key={profile.id} value={profile.id}>
                {profileLabel(profile)} — {profile.path}{profile.valid ? '' : ` (${profile.problem ?? 'invalid'})`}
              </option>
            ))}
          </select>
        ) : null}
        {state.recommended !== undefined ? (
          <span style={styles.badge}>
            {t('recommended')}: {state.recommended.label}
          </span>
        ) : null}
      </div>

      <div style={styles.row}>
        <span style={styles.label}>{t('msystem')}</span>
        <select
          style={styles.select}
          value={state.config.msystem}
          disabled={!state.writable || state.saving}
          onChange={event => void controller.setConfig({ msystem: event.target.value as MsystemSetting })}
        >
          {MSYSTEM_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.value === 'auto' ? t('msystemAuto') : option.label}</option>
          ))}
        </select>
        <span style={styles.muted}>{t('msys2')} only</span>

        <span style={{ ...styles.label, marginLeft: 8 }}>{t('compat')}</span>
        <select
          style={styles.select}
          value={compat}
          disabled={!state.writable || state.saving}
          onChange={event => void controller.setConfig({ compat: event.target.value as RowConfig['compat'] })}
        >
          <option value="auto">{t('compatAuto')}</option>
          <option value="strict">{t('compatStrict')}</option>
        </select>
      </div>

      <div style={compat === 'auto' ? styles.warning : styles.strict}>
        {compat === 'auto' ? t('warningAuto') : t('warningStrict')}
      </div>

      <div style={styles.statusGrid}>
        <span style={styles.muted}>{t('platform')}</span>
        <span style={styles.code}>{state.platform || '—'}</span>
        <span style={styles.muted}>{t('sandboxMode')}</span>
        <span style={styles.code}>{state.capability.shellSandboxMode ?? '—'}</span>
        <span style={styles.muted}>{t('backgroundJobs')}</span>
        <span style={styles.code}>{state.capability.backgroundJobs ? t('yes') : t('no')}</span>
        <span style={styles.muted}>{t('lastReplace')}</span>
        <span style={styles.code}>
          {state.lastReplace === undefined
            ? '—'
            : `${state.lastReplace.applied ? t('applied') : t('skipped')}${state.lastReplace.reason !== undefined ? `: ${state.lastReplace.reason}` : ''}`}
        </span>
      </div>

      {state.error !== undefined ? <div style={{ ...styles.error, lineHeight: 1.45 }}>{state.error}</div> : null}
      {state.notice !== undefined && state.error === undefined ? <div style={styles.muted}>{state.notice}</div> : null}
    </div>
  )
}
