import test from 'node:test'
import assert from 'node:assert/strict'
import { registerRoutes } from '../lib/index.js'
const ROUTE_STATE = '/api/dsh-gitbash/state'
const ROUTE_DISCOVER = '/api/dsh-gitbash/discover'
const ROUTE_VALIDATE = '/api/dsh-gitbash/validate'

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
const cache = {
  get: () => ({ candidates: [profile], recommended: profile, notes: [] }),
  refresh: () => ({ candidates: [profile], recommended: profile, notes: ['scanned'] }),
}

function harness(overrideSettings = settings) {
  const routes = []
  const ctx = {
    get(name) {
      if (name === 'connection') return { fetch: { register: route => { routes.push(route); return () => {} } } }
      return undefined
    },
    on() { return () => {} },
    effect(callback) { callback() },
  }
  registerRoutes(ctx, {
    readSettings: () => overrideSettings,
    cache,
    settingsAvailable: () => true,
    capability: () => ({ supported: true, backgroundJobs: true, bashAvailable: true, shellSandboxMode: 'workspace-write' }),
    lastReplace: () => ({ at: 1, applied: true }),
  })
  return { routes, ctx }
}

test('registers the three exact /api routes', () => {
  const { routes } = harness()
  assert.deepEqual(routes.map(route => route.path).sort(), [ROUTE_DISCOVER, ROUTE_STATE, ROUTE_VALIDATE].sort())
  assert.ok(routes.every(route => route.methods.includes('POST') && route.requestBody === 'buffered'))
})

test('state returns settings, effective profile and capability', async () => {
  const { routes } = harness()
  const state = routes.find(route => route.path === ROUTE_STATE)
  const response = await state.fetch(new Request('http://x/', { method: 'POST', body: '{}' }))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.effective.path, 'C:\\Git\\bin\\bash.exe')
  assert.equal(body.candidates.length, 1)
  assert.equal(body.capability.shellSandboxMode, 'workspace-write')
  assert.equal(body.lastReplace.applied, true)
})

test('discover returns candidates and notes', async () => {
  const { routes } = harness()
  const discover = routes.find(route => route.path === ROUTE_DISCOVER)
  const response = await discover.fetch(new Request('http://x/', { method: 'POST', body: JSON.stringify({ savedPath: 'C:\\Git\\bin\\bash.exe', msystem: 'auto' }) }))
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.candidates[0].id, profile.id)
  assert.deepEqual(body.notes, ['scanned'])
})

test('validate accepts a bad body without throwing', async () => {
  const { routes } = harness()
  const validate = routes.find(route => route.path === ROUTE_VALIDATE)
  const response = await validate.fetch(new Request('http://x/', { method: 'POST', body: 'not json' }))
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.problem, 'bashPath is empty')
})

test('state exposes why a configured path is unusable', async () => {
  const { routes } = harness({ bashPath: String.raw`C:\missing\bash.exe`, msystem: 'auto', compat: 'auto' })
  const state = routes.find(route => route.path === ROUTE_STATE)
  const response = await state.fetch(new Request('http://x/', { method: 'POST', body: '{}' }))
  const body = await response.json()
  assert.equal(body.ok, true)
  assert.equal(body.effective, undefined)
  assert.match(body.problem, /does not exist/)
  assert.equal(body.candidates.length, 1)
})
