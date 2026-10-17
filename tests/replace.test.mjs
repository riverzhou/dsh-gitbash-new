import test from 'node:test'
import assert from 'node:assert/strict'
import { registerReplacement, replaceTerminalTool } from '../lib/index.js'
import { createFakeSubprocess } from './helpers/fake-subprocess.mjs'

const profile = {
  id: 'git|c:\\git|MINGW64',
  flavor: 'git',
  path: 'C:\\Git\\bin\\bash.exe',
  root: 'C:\\Git',
  msystem: 'MINGW64',
  label: 'Git for Windows',
  valid: true,
}

const settings = { bashPath: '', msystem: 'auto', compat: 'auto' }

function fakeTools({ restrictThrows = false } = {}) {
  const registrations = []
  const restrictions = []
  return {
    registrations,
    restrictions,
    restrict(filter) {
      restrictions.push(filter)
      if (restrictThrows) throw new Error('unknown global tool "pwsh"')
      return () => {}
    },
    register(definition) {
      registrations.push(definition)
      return () => {}
    },
  }
}

function fakePrompt() {
  const sections = []
  return {
    sections,
    section(entry) {
      sections.push(entry)
      return () => {}
    },
    getSectionOrder(name) {
      return name === 'TOOL_PWSH' ? 1010 : 1000
    },
  }
}

function fakeHost() {
  const listeners = []
  const subprocess = createFakeSubprocess({ stdout: 'ok\n' })
  return {
    subprocess,
    listeners,
    get(name) {
      if (name === 'subprocess') return subprocess
      if (name === 'shell') return { sandboxMode: 'workspace-write' }
      if (name === 'sandboxPolicy') return { resolve: () => ({ mode: 'workspace-write', workspaceRoot: 'C:\\work' }) }
      if (name === 'shellEnv') return { collect: () => ({ DSH_HOME: 'C:\\Users\\River\\.dsh' }) }
      if (name === 'workingDirectory') return { ensure: async () => 'C:\\work' }
      return undefined
    },
    on(event, listener) {
      listeners.push({ event, listener })
      return () => {}
    },
    effect() {},
  }
}

function fakeAgent(tools, prompt) {
  const disposers = []
  return {
    id: 'agent-1',
    session: { id: 's1', header: { cwd: 'C:\\work' } },
    ctx: {
      get(name) {
        if (name === 'tools') return tools
        if (name === 'systemPrompt') return prompt
        return undefined
      },
      effect(callback) {
        const dispose = callback()
        if (typeof dispose === 'function') disposers.push(dispose)
      },
    },
    disposers,
  }
}

test('replacement hides pwsh, registers bash, and shadows the prompt', () => {
  const host = fakeHost()
  const tools = fakeTools()
  const prompt = fakePrompt()
  const agent = fakeAgent(tools, prompt)

  const attempt = replaceTerminalTool(host, agent, settings, profile)
  assert.equal(attempt.applied, true)
  assert.deepEqual(tools.restrictions[0], { deny: ['pwsh'] })
  assert.equal(tools.registrations.length, 1)
  assert.equal(tools.registrations[0].name, 'bash')
  assert.equal(typeof tools.registrations[0].execute, 'function')
  assert.equal(tools.registrations[0].description.includes('outside the DSH file sandbox'), true)
  const pwsh = prompt.sections.find(section => section.name === 'tool:pwsh')
  assert.equal(pwsh.text, '')
  assert.equal(pwsh.order, 1010)
  assert.equal(prompt.sections.some(section => section.name === 'tool:bash'), true)
  assert.equal(prompt.sections.some(section => section.name === 'tool:bash:windows'), true)
})

test('an already-hidden pwsh is skipped without half-registration', () => {
  const host = fakeHost()
  const tools = fakeTools({ restrictThrows: true })
  const agent = fakeAgent(tools, fakePrompt())
  const attempt = replaceTerminalTool(host, agent, settings, profile)
  assert.equal(attempt.applied, false)
  assert.match(attempt.reason ?? '', /pwsh is not restrictable/)
  assert.equal(tools.registrations.length, 0)
})

test('an invalid profile is skipped', () => {
  const attempt = replaceTerminalTool(fakeHost(), fakeAgent(fakeTools(), fakePrompt()), settings, {
    ...profile,
    valid: false,
    problem: 'not installed',
  })
  assert.equal(attempt.applied, false)
  assert.equal(attempt.reason, 'not installed')
})

test('registerReplacement applies on agent/created and reports the attempt', () => {
  const host = fakeHost()
  const tools = fakeTools()
  const prompt = fakePrompt()
  const agent = fakeAgent(tools, prompt)
  const attempts = []
  const cache = {
    get: () => ({ candidates: [profile], recommended: profile, notes: [] }),
    refresh: () => ({ candidates: [profile], recommended: profile, notes: [] }),
  }
  registerReplacement({
    host,
    settings: () => settings,
    cache,
    onAttempt: (attempt, target) => attempts.push({ attempt, target }),
  })
  assert.equal(host.listeners[0].event, 'agent/created')
  host.listeners[0].listener({ agent })
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].attempt.applied, true)
  assert.equal(attempts[0].target.id, 'agent-1')
  assert.equal(tools.registrations.length, 1)
})
