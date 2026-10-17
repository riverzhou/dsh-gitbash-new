import test from 'node:test'
import assert from 'node:assert/strict'
import { composeEnv, createBashExecution, discoverBash } from '../lib/index.js'
import { createRealSubprocess } from './helpers/real-subprocess.mjs'

const found = discoverBash({ probe: true, full: true })
const roots = [...new Set(found.candidates.map(candidate => candidate.root))]
const git = found.candidates.find(candidate => candidate.valid && candidate.flavor === 'git')
const msys2 = found.candidates.find(candidate => candidate.valid && candidate.flavor === 'msys2' && candidate.msystem === 'UCRT64')
  ?? found.candidates.find(candidate => candidate.valid && candidate.flavor === 'msys2')

function run(profile, command, timeoutMs = 15000) {
  const foreignRoots = roots.filter(root => root.toLowerCase() !== profile.root.toLowerCase())
  const env = composeEnv(profile, process.env, undefined, foreignRoots)
  const execution = createBashExecution(createRealSubprocess(), profile, {
    command,
    cwd: process.cwd(),
    env,
    onExpiry: 'kill',
    timeoutMs,
  })
  return execution.result()
}

for (const [name, profile] of [['Git for Windows', git], ['MSYS2', msys2]]) {
  test(`${name} executes with its own MSYSTEM and PATH`, { skip: profile === undefined }, async () => {
    const expected = profile.flavor === 'git' ? 'MINGW64' : profile.msystem
    const result = await run(profile, 'echo "MSYSTEM=$MSYSTEM"; echo "PWD=$(pwd)"; echo err >&2; exit 3')
    assert.equal(result.exitCode, 3)
    assert.equal(result.timedOut, false)
    assert.equal(result.stdout.text.includes(`MSYSTEM=${expected}`), true)
    assert.equal(result.stdout.text.includes('PWD=/d/GitHub/dsh-gitbash-new'), true)
    assert.equal(result.stderr.text, 'err\n')
    const pathLine = (await run(profile, 'echo "$PATH"')).stdout.text.toLowerCase()
    if (profile.flavor === 'git') assert.equal(pathLine.includes('msys64'), false)
    else assert.equal(pathLine.includes('program files/git'), false)
  })
}

test('a real foreground timeout is killed and classified', { skip: git === undefined }, async () => {
  const result = await run(git, 'sleep 5', 120)
  assert.equal(result.timedOut, true)
  assert.equal(result.aborted, false)
})

test('a real child bash process runs', { skip: git === undefined }, async () => {
  const result = await run(git, 'bash -c "echo nested-ok"')
  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout.text.trim(), 'nested-ok')
})
