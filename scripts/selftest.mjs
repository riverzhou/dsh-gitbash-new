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

check('Config is a schemastery schema', () => {
  assert.equal(typeof Config, 'function')
  assert.equal(typeof Config.toJSON, 'function')
})

check('settings defaults', () => {
  assert.deepEqual(readSettings(undefined), { bashPath: '', msystem: 'auto', compat: 'auto' })
})

check('version parsing', () => {
  assert.equal(parseBashVersion('GNU bash, version 5.3.15(2)-release (x86_64-pc-cygwin)'), '5.3.15')
})

check('timeout cap', () => {
  assert.equal(clampTimeout(9_999_999), 600000)
  assert.equal(clampTimeout(undefined), 120000)
})

check('escalation vocabulary', () => {
  assert.deepEqual(ESCALATION_TARGETS, ['workspace-write', 'danger-full-access'])
  assert.throws(() => validateEscalationArgs('danger-full-access', undefined))
})

check('render markers', () => {
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

check('compat note is short and identifiable', () => {
  const note = compatNote({ compat: true, sessionMode: 'workspace-write' })
  assert.equal(note, '[compat: Git Bash runs outside the DSH file sandbox (session mode workspace-write)]')
})

check('PATH never mixes Git into MSYS2', () => {
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

check('bash tool shape', () => {
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
  assert.deepEqual(tool.parameters.required, ['command', 'description'])
  assert.ok(Array.isArray(tool.output.schema.oneOf))
  assert.equal(typeof tool.output.presentationMeta, 'function')
  assert.equal(typeof tool.presentCall, 'function')
})

check('discovery returns a structured result', () => {
  const result = discoverBash({ full: false, probe: false })
  assert.ok(Array.isArray(result.candidates))
  assert.ok(Array.isArray(result.notes))
})

if (failures.length > 0) {
  console.error(`\n${failures.length} selftest(s) failed`)
  process.exit(1)
}
console.log('\nselftest ok')
