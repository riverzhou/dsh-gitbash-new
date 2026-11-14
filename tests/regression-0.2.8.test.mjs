import test from 'node:test'
import assert from 'node:assert/strict'
import { createBashExecution, createBashTool } from '../lib/index.js'
import { createFakeSubprocess } from './helpers/fake-subprocess.mjs'

const profile = {
  id: 'fake',
  flavor: 'git',
  path: String.raw`C:\Git\bin\bash.exe`,
  root: String.raw`C:\Git`,
  msystem: 'MINGW64',
  label: 'Git for Windows',
  valid: true,
}

function runtime(overrides = {}) {
  return {
    subprocess: createFakeSubprocess({ stdout: 'ok\n' }),
    profile,
    compat: 'auto',
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: process.cwd() }) },
    shell: { sandboxMode: 'workspace-write' },
    shellEnv: { collect: () => ({}) },
    workingDirectory: { ensure: async () => process.cwd() },
    ...overrides,
  }
}

function execution(signal = new AbortController().signal) {
  return {
    agent: { id: 'agent-1', session: { id: 's1', header: { cwd: process.cwd() } }, ctx: {} },
    callId: 'call-1',
    rootCallId: 'root-1',
    signal,
  }
}

function jobView(status = 'running', detail) {
  return {
    id: 'job-1', kind: 'bash', label: 'x', status,
    ...detail === undefined ? {} : { detail },
    startedAt: Date.now(), output: { total: 0, earliest: 0, spillPaths: [] },
  }
}

function startedJobs(overrides = {}) {
  const registry = {
    start(spec) {
      registry.hooks = spec.run({ id: 'job-1', append() {}, updateProgress() {} })
      return 'job-1'
    },
    async wait() { return jobView('running') },
    read() { return { chunks: [{ at: 0, text: 'partial\n' }], lossy: false, job: jobView('running') } },
    kill() { return 'requested' },
    remove() {},
    ...overrides,
  }
  return registry
}

test('an out-of-enum sandbox_permissions is a ToolArgsError before approval', async () => {
  let approvals = 0
  const tool = createBashTool(runtime({
    approval: { async request() { approvals += 1; return 'allowed-once' } },
  }))
  await assert.rejects(
    tool.execute({
      command: 'echo x',
      description: 'x',
      sandbox_permissions: 'read-only',
      justification: 'why',
    }, execution()),
    error => {
      assert.equal(error.name, 'ToolArgsError')
      assert.equal(error.code, 'INVALID_ARGS')
      assert.equal(
        error.message,
        'invalid arguments: "sandbox_permissions" must be one of ["workspace-write","danger-full-access"]',
      )
      return true
    },
  )
  assert.equal(approvals, 0)
})

test('strict mode refuses a workspace-write grant without prompting the user', async () => {
  let approvals = 0
  const tool = createBashTool(runtime({
    compat: 'strict',
    sandboxPolicy: { resolve: () => ({ mode: 'read-only', workspaceRoot: process.cwd() }) },
    approval: { async request() { approvals += 1; return 'allowed-once' } },
  }))
  await assert.rejects(
    tool.execute({
      command: 'echo x',
      description: 'x',
      sandbox_permissions: 'workspace-write',
      justification: 'needs the workspace',
    }, execution()),
    /strict compatibility mode/,
  )
  assert.equal(approvals, 0)
})

test('an admission failure falls back to the deadline-killed foreground path', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'fallback\n' })
  const jobs = {
    start() { throw new Error('job limit reached') },
    async wait() { throw new Error('unused') },
    read() { throw new Error('unused') },
    kill() { return 'requested' },
    remove() {},
  }
  const tool = createBashTool(runtime({ subprocess, jobs }))
  const value = await tool.execute({ command: 'echo fallback', description: 'fallback' }, execution())
  assert.equal(value.kind, 'foreground')
  assert.equal(value.stdout.text, 'fallback\n')
})

test('a lossy promoted read reports the dropped output and spill path', async () => {
  const jobs = startedJobs({
    read() {
      return {
        chunks: [{ at: 0, text: 'partial\n' }],
        lossy: true,
        job: { ...jobView('running'), output: { total: 9, earliest: 4, spillPaths: [String.raw`C:\tmp\bash.log`] } },
      }
    },
  })
  const tool = createBashTool(runtime({ jobs }))
  const value = await tool.execute({ command: 'sleep 5', description: 'wait', timeoutMs: 10 }, execution())
  assert.equal(value.kind, 'promoted')
  assert.equal(value.output.includes('[some output was dropped from memory; full output: '), true)
  assert.equal(value.output.includes(String.raw`C:\tmp\bash.log`), true)
})

test('a registry read failure is reported instead of fabricating a promoted result', async () => {
  const jobs = startedJobs({ read() { throw new Error('job vanished') } })
  const tool = createBashTool(runtime({ jobs }))
  await assert.rejects(
    tool.execute({ command: 'sleep 5', description: 'wait', timeoutMs: 10 }, execution()),
    /job vanished/,
  )
})

test('a wait cancellation surfaces as an AbortError', async () => {
  const jobs = startedJobs({
    async wait() {
      const error = new Error('wait aborted')
      error.name = 'AbortError'
      throw error
    },
  })
  const tool = createBashTool(runtime({ jobs }))
  await assert.rejects(
    tool.execute({ command: 'sleep 5', description: 'wait', timeoutMs: 10 }, execution()),
    error => error.name === 'AbortError',
  )
})

test('read-only refusal does not advertise escalation the composition does not have', async () => {
  const tool = createBashTool(runtime({
    shell: undefined,
    sandboxPolicy: { resolve: () => ({ mode: 'read-only', workspaceRoot: process.cwd() }) },
  }))
  await assert.rejects(
    tool.execute({ command: 'echo x', description: 'x' }, execution()),
    error => {
      assert.match(error.message, /does not advertise sandbox escalation/)
      assert.equal(error.message.includes('retry with sandbox_permissions'), false)
      return true
    },
  )
})

test('the presenter consumes the official null exit marker without a fake pill', () => {
  const tool = createBashTool(runtime())
  const view = tool.presentResult({ command: 'sleep 1' }, {
    content: [{ type: 'text', text: 'partial\n[exit code: null]' }],
    value: { kind: 'foreground', exitCode: null },
    isError: false,
  })
  assert.equal(view.card, 'terminal')
  assert.equal(view.output, 'partial')
  assert.equal(view.exitCode, undefined)
  assert.equal(view.signal, undefined)
})

test('a spawn error keeps the provider error as cause', () => {
  const provider = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
  const subprocess = { spawn() { throw provider } }
  assert.throws(
    () => createBashExecution(subprocess, profile, {
      command: 'echo x',
      cwd: process.cwd(),
      env: { PATH: String.raw`C:\Windows` },
      onExpiry: 'kill',
      timeoutMs: 1000,
    }),
    error => error.name === 'BashSpawnError' && error.cause === provider,
  )
})

test('strict mode keeps the official error for a narrowing or unadvertised escalation', async () => {
  const narrowing = createBashTool(runtime({
    compat: 'strict',
    sandboxPolicy: { resolve: () => ({ mode: 'danger-full-access', workspaceRoot: process.cwd() }) },
  }))
  await assert.rejects(
    narrowing.execute({
      command: 'echo x',
      description: 'x',
      sandbox_permissions: 'workspace-write',
      justification: 'narrower',
    }, execution()),
    error => error.name === 'SandboxEscalationError' && error.code === 'SANDBOX_ESCALATION_INVALID_ARGUMENT',
  )

  const unadvertised = createBashTool(runtime({
    compat: 'strict',
    shell: undefined,
    sandboxPolicy: { resolve: () => ({ mode: 'read-only', workspaceRoot: process.cwd() }) },
  }))
  await assert.rejects(
    unadvertised.execute({
      command: 'echo x',
      description: 'x',
      sandbox_permissions: 'workspace-write',
      justification: 'why',
    }, execution()),
    error => error.name === 'SandboxEscalationError' && error.code === 'SANDBOX_ESCALATION_UNAVAILABLE',
  )
})
