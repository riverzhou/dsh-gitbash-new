import test from 'node:test'
import assert from 'node:assert/strict'
import { BashSpawnError, createBashExecution } from '../lib/index.js'
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
