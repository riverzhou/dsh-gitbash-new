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

function view(status = 'running', detail) {
  return {
    id: 'bash-test', kind: 'bash', label: 'echo hi', status, startedAt: Date.now(),
    ...detail === undefined ? {} : { detail },
    output: { total: 8, earliest: 0, spillPaths: [] },
  }
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
      const outcome = await hooks.done
      return view(outcome.status === 'failed' ? 'failed' : 'completed', outcome.detail)
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
  }
}

function execution(agent = { id: 'agent-1', session: { id: 's1', header: { cwd: process.cwd() } }, ctx: {} }, signal = new AbortController().signal) {
  return { agent, callId: 'call-1', rootCallId: 'root-1', signal }
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

test('approved escalation from read-only still runs', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'ran\n' })
  const tool = createBashTool(runtime({
    subprocess,
    sandboxPolicy: { resolve: () => ({ mode: 'read-only', workspaceRoot: process.cwd() }) },
    approval: { async request() { return 'allowed-once' } },
  }))
  const value = await tool.execute({
    command: 'echo ran',
    description: 'run after approval',
    sandbox_permissions: 'danger-full-access',
    justification: 'the read-only session needs this one write',
  }, execution())
  assert.equal(value.kind, 'foreground')
  assert.equal(value.compat, undefined)
  assert.equal(subprocess.calls.length, 1)
})

test('a foreground call with a job registry settles through the job and removes it', async () => {
  const jobs = createFakeJobs('background')
  const removals = []
  const remove = jobs.remove
  jobs.remove = (...args) => { removals.push(args); remove(...args) }
  const subprocess = createFakeSubprocess({ stdout: 'settled\n' })
  const tool = createBashTool(runtime({ subprocess, jobs }))
  const value = await tool.execute({ command: 'echo settled', description: 'settle' }, execution())
  assert.equal(value.kind, 'foreground')
  assert.equal(value.stdout.text, 'settled\n')
  assert.equal(removals.length, 1)
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

test('presentResult recognizes a promoted result without the tool value', () => {
  const tool = createBashTool(runtime())
  const result = tool.presentResult({ command: 'sleep 5', description: 'wait' }, {
    content: [{
      type: 'text',
      text: 'partial\n[still running after 1000ms; moved to background job bash-0123456789abcdef]',
    }],
    isError: false,
  })
  assert.equal(result.card, 'generic')
  assert.equal(result.content[0].text.includes('still running after'), true)
  const emptyOutput = tool.presentResult({ command: 'sleep 5', description: 'wait' }, {
    content: [{ type: 'text', text: '[still running after 1000ms; moved to background job bash-empty]' }],
    isError: false,
  })
  assert.equal(emptyOutput.card, 'generic')
  const spilled = tool.presentResult({ command: 'sleep 5', description: 'wait' }, {
    content: [{
      type: 'text',
      text: 'partial\n[still running after 1000ms; moved to background job bash-spilled]\n\n(Omitted 1234 bytes. Full formatted result stored at: C:\\tmp\\bash.txt. Use read.)',
    }],
    isError: false,
  })
  assert.equal(spilled.card, 'generic')
})

test('an invalid/absent sandbox policy resolution fails closed', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'ran\n' })
  const tool = createBashTool(runtime({ subprocess, sandboxPolicy: { resolve: () => undefined } }))
  await assert.rejects(
    tool.execute({ command: 'echo ran', description: 'run' }, execution()),
    /sandbox policy is unavailable or invalid/,
  )
  assert.equal(subprocess.calls.length, 0)
})

test('a background startup failure is reported as failed', async () => {
  const subprocess = createFakeSubprocess({
    stderr: '*** fatal error - CreateFileMapping, Win32 error 5\n',
    exitCode: 0,
  })
  const jobs = createFakeJobs('background')
  const tool = createBashTool(runtime({ subprocess, jobs }))
  await tool.execute({ command: 'x', description: 'y', run_in_background: true }, execution())
  const outcome = await jobs.hooks().done
  assert.equal(outcome.status, 'failed')
  assert.match(outcome.detail, /bash startup failed/)
})

test('a registry wait error stays an error, and a kill error does not mask it', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'hi\n' })
  const jobs = {
    start() { return 'job' },
    async wait() { throw new Error('registry boom') },
    read() { return { chunks: [], lossy: false, job: {} } },
    kill() { throw new Error('kill boom') },
    remove() {},
  }
  const tool = createBashTool(runtime({ subprocess, jobs }))
  await assert.rejects(
    tool.execute({ command: 'x', description: 'y' }, execution()),
    error => error.name === 'Error' && error.message === 'registry boom',
  )
})

test('a missing sandbox policy service also fails closed', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'ran\n' })
  const tool = createBashTool({ subprocess, profile, compat: 'auto' })
  await assert.rejects(
    tool.execute({ command: 'echo ran', description: 'run' }, execution()),
    /sandbox policy service is unavailable/,
  )
  assert.equal(subprocess.calls.length, 0)
})

test('presentResult recognizes a background result from the tool value alone', () => {
  const tool = createBashTool(runtime())
  const result = tool.presentResult(undefined, {
    content: [{ type: 'text', text: 'started background job bash-abc' }],
    value: { kind: 'background', jobId: 'bash-abc', cwd: String.raw`C:\work` },
    isError: false,
  })
  assert.equal(result.card, 'generic')
})

test('presentResult recognizes a background result from its acknowledgement text', () => {
  const tool = createBashTool(runtime())
  const result = tool.presentResult(undefined, {
    content: [{ type: 'text', text: 'started background job bash-abc\n[compat: bash runs outside the DSH file sandbox (session mode workspace-write)]' }],
    isError: false,
  })
  assert.equal(result.card, 'generic')
})

test('parameter schema keeps the official property/required order and examples', () => {
  const tool = createBashTool(runtime({ jobs: createFakeJobs('background') }))
  assert.deepEqual(tool.parameters.required, ['description', 'command'])
  assert.deepEqual(Object.keys(tool.parameters.properties), [
    'description', 'command', 'timeoutMs', 'workdir', 'run_in_background', 'sandbox_permissions', 'justification',
  ])
  assert.equal(tool.parameters.properties.description.description.includes('"npm install"'), true)
  assert.equal(tool.parameters.properties.sandbox_permissions.enum.includes('danger-full-access'), true)
  // The schema stays a standard JSON Schema object with an array `required`.
  assert.equal(tool.parameters.type, 'object')
  for (const branch of tool.output.schema.oneOf) assert.equal(Array.isArray(branch.required), true)
})

test('argument violations carry the official ToolArgsError identity and prefix', async () => {
  const tool = createBashTool(runtime())
  await assert.rejects(tool.execute({}, execution()), error => {
    assert.equal(error.name, 'ToolArgsError')
    assert.equal(error.code, 'INVALID_ARGS')
    assert.equal(error.message, 'invalid arguments: missing required property "description"; missing required property "command"')
    return true
  })
  await assert.rejects(tool.execute({ command: 'x', description: '   ' }, execution()), error => {
    assert.equal(error.name, 'ToolArgsError')
    assert.equal(error.message, 'invalid arguments: invalid description: expected a non-empty string')
    return true
  })
  await assert.rejects(tool.execute({ command: 'x', description: 'y', timeoutMs: 0 }, execution()), error => {
    assert.equal(error.message, 'invalid arguments: invalid timeoutMs: expected a positive number, got 0')
    return true
  })
})

test('argument type violations use the dispatcher wording and walk order', async () => {
  const tool = createBashTool(runtime())
  await assert.rejects(
    tool.execute({ command: 1, description: 2, timeoutMs: 'now', workdir: 3 }, execution()),
    /invalid arguments: "description" must be a string; "command" must be a string; "timeoutMs" must be a number; "workdir" must be a string/,
  )
})

test('a forced background call without a job runtime reports ToolContextUnavailableError', async () => {
  const tool = createBashTool(runtime())
  await assert.rejects(tool.execute({ command: 'x', description: 'y', run_in_background: true }, execution()), error => {
    assert.equal(error.name, 'ToolContextUnavailableError')
    assert.equal(error.code, 'TOOL_CONTEXT_UNAVAILABLE')
    assert.equal(error.message, 'background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs')
    return true
  })
})

test('sandbox_permissions without an escalation-capable composition reports SANDBOX_ESCALATION_UNAVAILABLE', async () => {
  const tool = createBashTool(runtime({ shell: undefined }))
  await assert.rejects(
    tool.execute({
      command: 'x', description: 'y',
      sandbox_permissions: 'danger-full-access', justification: 'needs it',
    }, execution()),
    error => {
      assert.equal(error.name, 'SandboxEscalationError')
      assert.equal(error.code, 'SANDBOX_ESCALATION_UNAVAILABLE')
      return true
    },
  )
})

test('a job spawn failure rethrows the original error instead of a generic detail', async () => {
  const subprocess = { spawn() { throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) } }
  const jobs = createFakeJobs('background')
  const tool = createBashTool(runtime({ subprocess, jobs }))
  await assert.rejects(tool.execute({ command: 'x', description: 'y' }, execution()), error => {
    assert.equal(error.name, 'BashSpawnError')
    assert.match(error.message, /bash could not start/)
    return true
  })
})

test('a workingDirectory failure fails the call instead of using the recorded cwd', async () => {
  const subprocess = createFakeSubprocess({})
  const tool = createBashTool(runtime({
    subprocess,
    workingDirectory: { ensure: async () => { throw new Error('WORKING_DIRECTORY_UNAVAILABLE') } },
  }))
  await assert.rejects(
    tool.execute({ command: 'echo hi', description: 'say hi' }, execution()),
    /WORKING_DIRECTORY_UNAVAILABLE/,
  )
  assert.equal(subprocess.calls.length, 0)
})

test('an aborted workingDirectory lookup is reported as the tool call abort', async () => {
  const controller = new AbortController()
  const tool = createBashTool(runtime({
    workingDirectory: {
      async ensure() {
        controller.abort()
        throw new Error('lookup aborted')
      },
    },
  }))
  await assert.rejects(
    tool.execute({ command: 'echo hi', description: 'say hi' }, execution(undefined, controller.signal)),
    error => error.name === 'AbortError' && error.code === 'ABORTED',
  )
})

test('an invalid shellEnv contribution fails the call', async () => {
  const subprocess = createFakeSubprocess({})
  const tool = createBashTool(runtime({
    subprocess,
    shellEnv: { collect() { throw new Error('SHELL_ENV_CONTRIBUTION_INVALID') } },
  }))
  await assert.rejects(
    tool.execute({ command: 'echo hi', description: 'say hi' }, execution()),
    /SHELL_ENV_CONTRIBUTION_INVALID/,
  )
  assert.equal(subprocess.calls.length, 0)
})

test('a cancelled approval whose call signal aborted rethrows the cancellation', async () => {
  const controller = new AbortController()
  const tool = createBashTool(runtime({
    approval: {
      async request() {
        controller.abort()
        return 'cancelled'
      },
    },
  }))
  await assert.rejects(
    tool.execute({
      command: 'npm install', description: 'install',
      sandbox_permissions: 'danger-full-access', justification: 'needs node_modules',
    }, execution(undefined, controller.signal)),
    error => error.name === 'AbortError',
  )
})

test('repeating the effective mode needs no escalation surface', async () => {
  const subprocess = createFakeSubprocess({ stdout: 'same\n' })
  // No ctx.shell means the composition advertises no escalation targets; the
  // official tool still accepts `sandbox_permissions` equal to the effective
  // mode without a justification.
  const tool = createBashTool(runtime({ subprocess, shell: undefined }))
  const value = await tool.execute({
    command: 'echo same', description: 'same mode', sandbox_permissions: 'workspace-write',
  }, execution())
  assert.equal(value.kind, 'foreground')
  assert.equal(value.stdout.text, 'same\n')
})
