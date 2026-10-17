import test from 'node:test'
import assert from 'node:assert/strict'
import { parseExitStatus, renderPromoted, renderResult, compatNote } from '../lib/index.js'

const base = {
  kind: 'foreground',
  cwd: 'C:\\work',
  exitCode: 0,
  signal: null,
  timedOut: false,
  aborted: false,
  timeoutMs: 120000,
  stdout: { text: '', truncated: false },
  stderr: { text: '', truncated: false },
}

test('stdout, stderr section, and exit marker', () => {
  const text = renderResult({ ...base, stdout: { text: 'hello\n', truncated: false }, stderr: { text: 'bad\n', truncated: false }, exitCode: 3 })
  assert.equal(text, 'hello\n[stderr]\nbad\n[exit code: 3]')
  const parsed = parseExitStatus(text)
  assert.equal(parsed.body, 'hello\n[stderr]\nbad')
  assert.equal(parsed.exitCode, 3)
})

test('signal and timeout markers', () => {
  const killed = renderResult({ ...base, exitCode: null, signal: 'SIGKILL' })
  assert.equal(killed, '(no output)\n[killed by signal: SIGKILL]')
  assert.deepEqual(parseExitStatus(killed), { body: '(no output)', signal: 'SIGKILL' })

  const timedOut = renderResult({ ...base, timedOut: true, exitCode: 1 })
  assert.equal(timedOut, '(no output)\n[timed out after 120000ms]\n[exit code: 1]')
})

test('truncation carries the spill path', () => {
  const text = renderResult({
    ...base,
    stdout: { text: 'tail', truncated: true, spillPath: 'C:\\tmp\\spill.log' },
  })
  assert.equal(text, 'tail\n[output truncated; full output: C:\\tmp\\spill.log]')
})

test('compat note precedes the terminal marker so the pill still parses', () => {
  const value = { ...base, exitCode: 2, compat: true, sessionMode: 'workspace-write' }
  const text = renderResult(value)
  assert.equal(text.includes('session mode workspace-write'), true)
  assert.equal(text.endsWith('[exit code: 2]'), true)
  assert.equal(parseExitStatus(text).exitCode, 2)
  assert.equal(compatNote(value)?.includes('outside the DSH file sandbox'), true)
})

test('promoted result renders output and hand-off guidance', () => {
  const text = renderPromoted({
    kind: 'promoted',
    cwd: 'C:\\work',
    jobId: 'bash-0123456789abcdef',
    timeoutMs: 1000,
    output: 'partial\n',
  })
  assert.equal(text.startsWith('partial\n[still running after 1000ms; moved to background job bash-0123456789abcdef]'), true)
  assert.equal(text.includes('job_output'), true)
})
