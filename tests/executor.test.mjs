import test from 'node:test'
import assert from 'node:assert/strict'
import { BashSpawnError, createBashExecution, normalizeWindowsExit, processOutcome } from '../lib/index.js'
import { createFakeSubprocess } from './helpers/fake-subprocess.mjs'

const profile = {
  id: 'fake',
  flavor: 'git',
  path: 'C:\\Git\\bin\\bash.exe',
  root: 'C:\\Git',
  label: 'Git for Windows',
  valid: true,
}

const request = {
  command: 'echo hi',
  cwd: 'C:\\work',
  env: { PATH: 'C:\\Git\\bin' },
  onExpiry: 'kill',
  timeoutMs: 5000,
}

test('normal exit projects collected output and status', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'hi\n', stderr: 'warn\n', exitCode: 3 })
  const execution = createBashExecution(subprocess, profile, request)
  const result = await execution.result()
  assert.equal(result.exitCode, 3)
  assert.equal(result.status, undefined)
  assert.equal(result.stdout.text, 'hi\n')
  assert.equal(result.stderr.text, 'warn\n')
  assert.equal(execution.status, 'completed')
  assert.deepEqual(subprocess.calls[0].argv, ['C:\\Git\\bin\\bash.exe', '-c', 'echo hi'])
  assert.equal(subprocess.calls[0].cwd, 'C:\\work')
})

test('Windows signal-encoded exit codes normalize to signal names', () => {
  assert.deepEqual(normalizeWindowsExit(3840, null, 'win32'), { exitCode: null, signal: 'SIGTERM' })
  assert.deepEqual(normalizeWindowsExit(2304, null, 'win32'), { exitCode: null, signal: 'SIGKILL' })
  assert.deepEqual(normalizeWindowsExit(512, null, 'win32'), { exitCode: null, signal: 'SIGINT' })
  // A normal bash exit is masked to 0..255 and must stay an exit code.
  assert.deepEqual(normalizeWindowsExit(143, null, 'win32'), { exitCode: 143, signal: null })
  // Crash codes such as 0xC0000005 are not signal encodings.
  assert.deepEqual(normalizeWindowsExit(3221225477, null, 'win32'), { exitCode: 3221225477, signal: null })
  // Do not reinterpret POSIX exit codes.
  assert.deepEqual(normalizeWindowsExit(3840, null, 'linux'), { exitCode: 3840, signal: null })
  // A provider-reported signal always wins.
  assert.deepEqual(normalizeWindowsExit(null, 'SIGTERM', 'win32'), { exitCode: null, signal: 'SIGTERM' })
})

test('a Windows signal-encoded exit is classified as killed', { skip: process.platform !== 'win32' }, async () => {
  const subprocess = createFakeSubprocess({ stdout: 'BEFORE\n', exitCode: 3840 })
  const execution = createBashExecution(subprocess, profile, request)
  const result = await execution.result()
  assert.equal(result.exitCode, null)
  assert.equal(result.signal, 'SIGTERM')
  assert.equal(execution.status, 'killed')
})

test('timeout terminates and classifies timedOut', async () => {
  const subprocess = createFakeSubprocess({ autoExit: false })
  const execution = createBashExecution(subprocess, profile, { ...request, timeoutMs: 20 })
  const result = await execution.result()
  assert.equal(result.timedOut, true)
  assert.equal(result.aborted, false)
  assert.equal(execution.status, 'killed')
  assert.equal(subprocess.terminated, true)
})

test('caller abort terminates and classifies aborted', async () => {
  const controller = new AbortController()
  const subprocess = createFakeSubprocess({ autoExit: false })
  const execution = createBashExecution(subprocess, profile, { ...request, signal: controller.signal })
  controller.abort()
  const result = await execution.result()
  assert.equal(result.aborted, true)
  assert.equal(result.timedOut, false)
  assert.equal(subprocess.terminated, true)
})

test('MSYS2 fatal signature with exit 0 is not reported as success', async () => {
  const subprocess = createFakeSubprocess({
    stderr: '      0 [main] bash (1) C:\\Git\\bin\\bash.exe: *** fatal error - CreateFileMapping, Win32 error 5\n',
    exitCode: 0,
  })
  const execution = createBashExecution(subprocess, profile, request)
  const result = await execution.result()
  assert.equal(result.exitCode, 1)
  assert.equal(result.stderr.text.includes('[bash startup failed:'), true)
})

test('readOutput is incremental and merges stderr', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'one\n', stderr: 'two\n' })
  const execution = createBashExecution(subprocess, profile, request)
  const first = execution.readOutput()
  assert.equal(first.delta, 'one\n[stderr]\ntwo\n')
  const second = execution.readOutput()
  assert.equal(second.delta, '')
})

test('provider rejection surfaces as a spawn error from result()', async () => {
  const subprocess = {
    spawn() {
      return {
        collected: {},
        done: Promise.reject(new Error('EPERM')),
        terminate() {},
      }
    },
  }
  const execution = createBashExecution(subprocess, profile, request)
  await assert.rejects(execution.result(), (error) => error instanceof BashSpawnError)
  const outcome = processOutcome(execution)
  assert.equal(outcome.status, 'failed')
  assert.match(outcome.detail, /EPERM/)
})

test('a synchronous spawn throw is a BashSpawnError', () => {
  const subprocess = { spawn() { throw new Error('ENOENT') } }
  assert.throws(() => createBashExecution(subprocess, profile, request), (error) => error instanceof BashSpawnError)
})

test('pre-aborted signal refuses to spawn', () => {
  const controller = new AbortController()
  controller.abort()
  const subprocess = createFakeSubprocess({})
  assert.throws(() => createBashExecution(subprocess, profile, { ...request, signal: controller.signal }))
  assert.equal(subprocess.calls.length, 0)
})

test('startup signature with real stdout is not a startup failure', async () => {
  const subprocess = createFakeSubprocess({
    stdout: 'legit\n',
    stderr: '*** fatal error - user text\n',
    exitCode: 0,
  })
  const execution = createBashExecution(subprocess, profile, request)
  const result = await execution.result()
  assert.equal(result.exitCode, 0)
  assert.equal(result.stderr.text.includes('[bash startup failed:'), false)
})

test('timeout aborts the spawn signal as well as terminating', async () => {
  const subprocess = createFakeSubprocess({ autoExit: false })
  const execution = createBashExecution(subprocess, profile, { ...request, timeoutMs: 20 })
  const result = await execution.result()
  assert.equal(result.timedOut, true)
  assert.equal(subprocess.calls[0].signal?.aborted, true)
})
