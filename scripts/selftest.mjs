/**
 * Pure-logic self test: loads the built host bundle without DSH and checks the
 * contracts that the unit tests cover, plus the schema/serialization facts the
 * real dispatcher depends on. Run with `pnpm selftest`.
 */
import assert from 'node:assert/strict'
import {
  Config,
  ESCALATION_TARGETS,
  clampTimeout,
  compatNote,
  composePath,
  createBashTool,
  discoverBash,
  parseBashVersion,
  parseExitStatus,
  readSettings,
  renderResult,
  validateEscalationArgs,
} from '../lib/index.js'

const failures = []
function check(name, fn) {
  try {
    fn()
    console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

await check('Config is a schemastery schema', () => {
  assert.equal(typeof Config, 'function')
  assert.equal(typeof Config.toJSON, 'function')
})

await check('settings defaults', () => {
  assert.deepEqual(readSettings(undefined), { bashPath: '', msystem: 'auto', compat: 'auto' })
})

await check('version parsing', () => {
  assert.equal(parseBashVersion('GNU bash, version 5.3.15(2)-release (x86_64-pc-cygwin)'), '5.3.15')
})

await check('timeout cap', () => {
  assert.equal(clampTimeout(9_999_999), 600000)
  assert.equal(clampTimeout(undefined), 120000)
})

await check('escalation vocabulary', () => {
  assert.deepEqual(ESCALATION_TARGETS, ['workspace-write', 'danger-full-access'])
  assert.throws(() => validateEscalationArgs('danger-full-access', undefined))
})

await check('render markers', () => {
  const text = renderResult({
    kind: 'foreground',
    cwd: 'C:\\work',
    exitCode: 2,
    signal: null,
    timedOut: false,
    aborted: false,
    timeoutMs: 1000,
    stdout: { text: 'out\n', truncated: false },
    stderr: { text: 'err\n', truncated: false },
  })
  assert.equal(text, 'out\n[stderr]\nerr\n[exit code: 2]')
  assert.equal(parseExitStatus(text).exitCode, 2)
})

await check('compat note is short and identifiable', () => {
  const note = compatNote({ compat: true, sessionMode: 'workspace-write' })
  assert.equal(note, '[compat: bash runs outside the DSH file sandbox (session mode workspace-write)]')
})

await check('PATH never mixes Git into MSYS2', () => {
  const profile = {
    id: 'msys',
    flavor: 'msys2',
    path: 'C:\\msys64\\usr\\bin\\bash.exe',
    root: 'C:\\msys64',
    msystem: 'UCRT64',
    environmentRoot: 'C:\\msys64\\ucrt64',
    label: 'MSYS2 UCRT64',
    valid: true,
  }
  const path = composePath(profile, 'C:\\Program Files\\Git\\bin;C:\\Windows', ['C:\\Program Files\\Git'])
  assert.equal(path.toLowerCase().includes('git'), false)
})

await check('bash tool shape', () => {
  const tool = createBashTool({
    subprocess: { spawn: () => { throw new Error('not spawned in selftest') } },
    profile: {
      id: 'fake',
      flavor: 'git',
      path: 'C:\\Git\\bin\\bash.exe',
      root: 'C:\\Git',
      label: 'Git for Windows',
      valid: true,
    },
    compat: 'auto',
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: process.cwd() }) },
    shell: { sandboxMode: 'workspace-write' },
  })
  assert.equal(tool.name, 'bash')
  assert.equal(tool.parameters.type, 'object')
  assert.deepEqual(tool.parameters.required, ['description', 'command'])
  assert.ok(Array.isArray(tool.output.schema.oneOf))
  assert.equal(typeof tool.output.presentationMeta, 'function')
  assert.equal(typeof tool.presentCall, 'function')
})

await check('discovery returns a structured result', () => {
  const result = discoverBash({ full: false, probe: false })
  assert.ok(Array.isArray(result.candidates))
  assert.ok(Array.isArray(result.notes))
})

await check('argument violations carry ToolArgsError identity', async () => {
  const tool = createBashTool({
    subprocess: { spawn: () => { throw new Error('not spawned in selftest') } },
    profile: {
      id: 'fake', flavor: 'git', path: 'C:\\Git\\bin\\bash.exe', root: 'C:\\Git',
      label: 'Git for Windows', valid: true,
    },
    compat: 'auto',
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: process.cwd() }) },
    shell: { sandboxMode: 'workspace-write' },
  })
  const exec = { callId: 'selftest', signal: new AbortController().signal }
  await assert.rejects(tool.execute({}, exec), error => {
    assert.equal(error.name, 'ToolArgsError')
    assert.equal(error.code, 'INVALID_ARGS')
    assert.equal(error.message, 'invalid arguments: missing required property "description"; missing required property "command"')
    return true
  })
  await assert.rejects(tool.execute({
    command: 'x', description: 'y', sandbox_permissions: 'read-only', justification: 'why',
  }, exec), error => {
    assert.equal(error.name, 'ToolArgsError')
    assert.equal(error.message, 'invalid arguments: "sandbox_permissions" must be one of ["workspace-write","danger-full-access"]')
    return true
  })
})

await check('escalation failures carry SandboxEscalationError identity', () => {
  assert.throws(
    () => validateEscalationArgs('workspace-write', undefined),
    error => error.name === 'SandboxEscalationError' && error.code === 'SANDBOX_ESCALATION_INVALID_ARGUMENT',
  )
})

await check('the null exit marker is the official one', () => {
  const text = renderResult({
    kind: 'foreground', cwd: 'C:\\work', exitCode: null, signal: null,
    timedOut: true, aborted: false, timeoutMs: 1,
    stdout: { text: '', truncated: false }, stderr: { text: '', truncated: false },
  })
  assert.equal(text, '(no output)\n[timed out after 1ms]\n[exit code: null]')
  assert.equal(parseExitStatus(text).exitCode, null)
})

if (failures.length > 0) {
  console.error(`\n${failures.length} selftest(s) failed`)
  process.exit(1)
}
console.log('\nselftest ok')
