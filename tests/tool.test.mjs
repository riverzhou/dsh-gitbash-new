import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBashTool } from '../lib/index.js'
import { createFakeSubprocess } from './helpers/fake-subprocess.mjs'

const profile = {
  id: 'fake',
  flavor: 'git',
  path: 'C:\\Git\\bin\\bash.exe',
  root: 'C:\\Git',
  label: 'Git for Windows',
  valid: true,
}

function view(status = 'running') {
  return { id: 'bash-test', kind: 'bash', label: 'echo hi', status, startedAt: Date.now(), output: { total: 8, earliest: 0, spillPaths: [] } }
}

function createFakeJobs(mode) {
  let hooks
  const registry = {
    calls: [],
    start(spec) {
      registry.calls.push(spec)
      hooks = spec.run({ id: 'bash-test', append() {}, updateProgress() {} })
      return 'bash-test'
    },
    async wait() {
      if (mode === 'promote') {
        await new Promise(resolve => setTimeout(resolve, 20))
        return view('running')
      }
      await hooks.done
      return view('completed')
    },
    read() {
      return { chunks: [{ at: 0, text: 'partial\n', channel: 'stdout' }], lossy: false, job: view('running') }
    },
    kill() { return 'requested' },
    remove() {},
    hooks: () => hooks,
  }
  return registry
}

function runtime(overrides = {}) {
  const subprocess = overrides.subprocess ?? createFakeSubprocess({ stdout: 'hi\n' })
  return {
    subprocess,
    profile,
    compat: 'auto',
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: process.cwd() }) },
    shell: { sandboxMode: 'workspace-write' },
    shellEnv: { collect: () => ({ DSH_HOME: 'C:\\Users\\River\\.dsh' }) },
    workingDirectory: { ensure: async () => process.cwd() },
    ...overrides,
    subprocess,
  }
}

function execution(agent = { id: 'agent-1', session: { id: 's1', header: { cwd: process.cwd() } }, ctx: {} }) {
  return { agent, callId: 'call-1', rootCallId: 'root-1', signal: new AbortController().signal }
}

test('workspace-write + compat auto runs unconfined and labels it', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'hi\n' })
  const tool = createBashTool(runtime({ subprocess }))
  const value = await tool.execute({ command: 'echo hi', description: 'say hi' }, execution())
  assert.equal(value.kind, 'foreground')
  assert.equal(value.compat, true)
  assert.equal(value.sessionMode, 'workspace-write')
  assert.equal(value.sandbox.mode, 'danger-full-access')
  assert.equal(value.stdout.text, 'hi\n')
  const rendered = tool.output.render({}, value)[0].text
  assert.equal(rendered.includes('outside the DSH file sandbox'), true)
  assert.equal(tool.output.presentationMeta({}, value).cwd, process.cwd())
  assert.equal(subprocess.calls[0].argv[0], 'C:\\Git\\bin\\bash.exe')
})

test('read-only refuses instead of widening', async () => {
  const tool = createBashTool(runtime({
    sandboxPolicy: { resolve: () => ({ mode: 'read-only', workspaceRoot: process.cwd() }) },
  }))
  await assert.rejects(tool.execute({ command: 'echo hi', description: 'say hi' }, execution()), /read-only/)
})

test('strict mode refuses workspace-write with actionable text', async () => {
  const tool = createBashTool(runtime({ compat: 'strict' }))
  await assert.rejects(tool.execute({ command: 'echo hi', description: 'say hi' }, execution()), /strict compatibility mode/)
})

test('approved escalation runs in danger-full-access without the compat note', async () => {
  const requests = []
  const tool = createBashTool(runtime({
    approval: { async request(request) { requests.push(request); return 'allowed-once' } },
  }))
  const value = await tool.execute({
    command: 'npm install',
    description: 'install dependencies',
    sandbox_permissions: 'danger-full-access',
    justification: 'needs to write node_modules',
  }, execution())
  assert.equal(value.kind, 'foreground')
  assert.equal(value.compat, undefined)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].reason, 'escalate sandbox to danger-full-access: needs to write node_modules')
})

test('invalid escalation pairing is rejected before spawning', async () => {
  const subprocess = createFakeSubprocess({})
  const tool = createBashTool(runtime({ subprocess }))
  await assert.rejects(
    tool.execute({ command: 'x', description: 'y', sandbox_permissions: 'danger-full-access' }, execution()),
    /requires a justification/,
  )
  assert.equal(subprocess.calls.length, 0)
})

test('workdir resolves relative to the session cwd', async t => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-gitbash-tool-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'sub'))
  const subprocess = createFakeSubprocess({})
  const tool = createBashTool(runtime({
    subprocess,
    workingDirectory: { ensure: async () => root },
  }))
  await tool.execute({ command: 'pwd', description: 'print cwd', workdir: 'sub' }, execution())
  assert.equal(subprocess.calls[0].cwd, join(root, 'sub'))
})

test('timeoutMs is capped at 600000', async () => {
  const subprocess = createFakeSubprocess({})
  const tool = createBashTool(runtime({ subprocess }))
  const value = await tool.execute({ command: 'x', description: 'y', timeoutMs: 9_999_999 }, execution())
  assert.equal(value.timeoutMs, 600000)
})

test('background start returns a job id and a compat note', async () => {
  const jobs = createFakeJobs('background')
  const tool = createBashTool(runtime({ jobs }))
  const value = await tool.execute({ command: 'sleep 1', description: 'wait', run_in_background: true }, execution())
  assert.equal(value.kind, 'background')
  assert.equal(value.jobId, 'bash-test')
  assert.equal(value.compat, true)
  assert.equal(jobs.calls[0].toolCall.callId, 'call-1')
  assert.equal(jobs.calls[0].owner, 'agent-1')
})

test('a timed-out foreground call is promoted by the job registry', async () => {
  const jobs = createFakeJobs('promote')
  const tool = createBashTool(runtime({ jobs }))
  const value = await tool.execute({ command: 'sleep 1', description: 'wait', timeoutMs: 50 }, execution())
  assert.equal(value.kind, 'promoted')
  assert.equal(value.jobId, 'bash-test')
  assert.equal(value.output, 'partial\n')
  const rendered = tool.output.render({}, value)[0].text
  assert.equal(rendered.includes('moved to background job bash-test'), true)
})

test('presentCall and presentResult keep the terminal card contract', () => {
  const tool = createBashTool(runtime())
  const call = tool.presentCall({ command: 'echo hi', description: 'say hi', workdir: 'C:\\work' })
  assert.equal(call.card, 'terminal')
  assert.equal(call.title, 'echo hi')
  assert.equal(call.cwd, 'C:\\work')
  const result = tool.presentResult({ command: 'echo hi' }, {
    content: [{ type: 'text', text: 'hi\n[exit code: 2]' }],
    value: { kind: 'foreground', exitCode: 2 },
  })
  assert.equal(result.card, 'terminal')
  assert.equal(result.output, 'hi')
  assert.equal(result.exitCode, 2)
})
