import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function loadClient() {
  let registration
  let fetchImpl = async () => { throw new Error('fetch not stubbed') }
  const React = {
    createElement: (type, props) => ({ type, props }),
    useEffect() {},
    useMemo: callback => callback(),
    useRef: value => ({ current: value }),
    useState: value => [value, () => {}],
    useSyncExternalStore: getSnapshot => getSnapshot(),
  }
  const sandbox = {
    window: { __ModuleLoader__: { load: value => { registration = value } } },
    console,
    fetch: (...args) => fetchImpl(...args),
    setTimeout,
    clearTimeout,
  }
  vm.runInNewContext(source, sandbox, { filename: 'lib/client.js' })
  if (registration === undefined) throw new Error('client bundle did not register')
  const jsxRuntime = {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
    Fragment: 'Fragment',
  }
  const requireStub = (id) => {
    if (id === 'react') return React
    if (id === 'react/jsx-runtime') return jsxRuntime
    throw new Error(`unexpected client require: ${id}`)
  }
  return {
    registration,
    exports: registration.factory(requireStub),
    setFetch(impl) { fetchImpl = impl },
  }
}

const profile = {
  id: 'git|c:\\git|MINGW64',
  flavor: 'git',
  path: String.raw`C:\Git\usr\bin\bash.exe`,
  root: String.raw`C:\Git`,
  msystem: 'MINGW64',
  label: 'Git for Windows',
  valid: true,
}

const VIEW = {
  ok: true,
  platform: 'win32',
  settingsAvailable: true,
  bashPath: '',
  msystem: 'auto',
  compat: 'auto',
  candidates: [profile],
  recommended: profile,
  effective: profile,
  capability: { supported: true, backgroundJobs: true, bashAvailable: true, shellSandboxMode: 'workspace-write' },
  namespace: 'dsh-gitbash',
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body) },
  }
}

function fakeScope(overrides = {}) {
  const snapshot = {
    status: 'ready',
    value: { bashPath: '', msystem: 'auto', compat: 'auto' },
    writable: true,
    revision: 1,
    base: {},
    user: {},
    ...overrides,
  }
  const listeners = new Set()
  return {
    snapshot,
    mutateOps: [],
    async mutate(ops) {
      this.mutateOps.push(ops)
      return true
    },
    async set() { return true },
    async unset() { return true },
    getSnapshot() { return snapshot },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function slotsFake() {
  const entries = []
  let injectedKey
  return {
    entries,
    get injectedKey() { return injectedKey },
    inject(key, callback) {
      injectedKey = key
      return callback()
    },
    register(options, component) {
      const entry = { options, component, disposed: false }
      entries.push(entry)
      return () => { entry.disposed = true }
    },
  }
}

function contextFake({ slots, forms, locale }) {
  const effects = []
  const injections = []
  return {
    effects,
    injections,
    get(name) {
      if (name === 'slots') return slots
      if (name === 'locale') return locale
      if (name === 'configForms') return forms
      return undefined
    },
    effect(callback) {
      const dispose = callback()
      effects.push(dispose)
      return dispose
    },
    inject(services, callback) {
      injections.push({ services: [...services], callback })
    },
  }
}

const localeFake = {
  register() { return () => {} },
  bind() { return key => key },
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('client bundle registers the package id and its entry exports', () => {
  const client = loadClient()
  assert.equal(client.registration.id, '@riverzh/dsh-gitbash')
  assert.equal(typeof client.exports.apply, 'function')
  assert.deepEqual(JSON.parse(JSON.stringify(client.exports.inject)), ['slots', 'locale'])
  assert.equal(typeof client.exports.decodeConfig, 'function')
  assert.equal(typeof client.exports.createRowController, 'function')
})

test('decodeConfig trims quoted paths and falls back on bad fields', () => {
  const client = loadClient()
  assert.deepEqual(JSON.parse(JSON.stringify(client.exports.decodeConfig({ bashPath: ' "C:\\Git\\bin\\bash.exe" ', msystem: 'UCRT64', compat: 'strict' }))), {
    bashPath: String.raw`C:\Git\bin\bash.exe`,
    msystem: 'UCRT64',
    compat: 'strict',
  })
  assert.deepEqual(JSON.parse(JSON.stringify(client.exports.decodeConfig({ msystem: 7, compat: null }))), {
    bashPath: '',
    msystem: 'auto',
    compat: 'auto',
  })
  assert.equal(client.exports.decodeConfig([]), undefined)
})

test('the settings row follows whileServed instead of seating immediately', () => {
  const client = loadClient()
  const slots = slotsFake()
  const servedCallbacks = []
  const forms = {
    get() { return fakeScope() },
    whileServed(namespaces, register) {
      assert.deepEqual([...namespaces], ['dsh-gitbash'])
      servedCallbacks.push(register)
      return () => {}
    },
  }
  client.exports.apply(contextFake({ slots, forms, locale: localeFake }))
  assert.equal(slots.entries.length, 0, 'row waits for the namespace to be served')
  assert.equal(servedCallbacks.length, 1)
  const release = servedCallbacks[0](new Set(['dsh-gitbash']))
  assert.equal(slots.entries.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(slots.entries[0].options)), {
    name: 'settings.general.item', id: 'git-bash', order: 60, locale: 'dsh-gitbash',
  })
  assert.equal(typeof slots.entries[0].component, 'function')
  release()
  assert.equal(slots.entries[0].disposed, true)
  const releaseAgain = servedCallbacks[0](new Set(['dsh-gitbash']))
  assert.equal(slots.entries.length, 2, 'the row is re-seated when the namespace returns')
  releaseAgain()
})

test('the settings row re-watches a replaced configForms provider', () => {
  const client = loadClient()
  const slots = slotsFake()
  const served = []
  const forms = {
    get() { return fakeScope() },
    whileServed(namespaces, register) {
      served.push(register)
      return () => {}
    },
  }
  const ctx = contextFake({ slots, forms, locale: localeFake })
  client.exports.apply(ctx)
  const release = served[0](new Set(['dsh-gitbash']))
  assert.equal(slots.entries.length, 1)
  const replacementServed = []
  const replacementScope = fakeScope()
  const replacementForms = {
    get() { return replacementScope },
    whileServed(namespaces, register) {
      replacementServed.push(register)
      return () => {}
    },
  }
  const replacementCtx = {
    get(name) { return name === 'configForms' ? replacementForms : undefined },
    effect(callback) { return callback() },
    inject() {},
  }
  const injection = ctx.injections.find(item => item.services.includes('configForms'))
  assert.equal(typeof injection.callback, 'function')
  injection.callback(replacementCtx)
  assert.equal(replacementServed.length, 1, 'new provider is watched')
  replacementServed[0](new Set(['dsh-gitbash']))
  assert.equal(slots.entries.length, 2)
  assert.equal(slots.entries[0].disposed, true, 'old row is released before the new scope is seated')
  release()
})

test('the store applies /state and merges a path+environment write atomically', async () => {
  const client = loadClient()
  client.setFetch(async () => response(VIEW))
  const scope = fakeScope()
  const controller = client.exports.createRowController(scope)
  const stop = controller.start()
  await tick()
  let state = controller.store.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.effective.id, profile.id)
  assert.equal(state.candidates.length, 1)
  await controller.setConfig({ bashPath: String.raw`C:\Git\usr\bin\bash.exe`, msystem: 'auto' })
  assert.deepEqual(JSON.parse(JSON.stringify(scope.mutateOps[0])), [
    { op: 'set', path: ['bashPath'], value: String.raw`C:\Git\usr\bin\bash.exe` },
    { op: 'set', path: ['msystem'], value: 'auto' },
  ])
  stop()
})

test('a stale /state response cannot overwrite a newer one', async () => {
  const client = loadClient()
  const pending = []
  client.setFetch(() => new Promise(resolve => { pending.push(resolve) }))
  const controller = client.exports.createRowController(fakeScope())
  const stop = controller.start()
  await tick()
  assert.equal(pending.length, 1)
  const newer = controller.refresh()
  await tick()
  assert.equal(pending.length, 2)
  pending[1](response({ ...VIEW, platform: 'NEW' }))
  await newer
  pending[0](response({ ...VIEW, platform: 'OLD' }))
  await tick()
  assert.equal(controller.store.getState().platform, 'NEW')
  stop()
})

test('a passive refresh keeps a save error and clears a stale notice on a problem', async () => {
  const client = loadClient()
  const pending = []
  client.setFetch(() => new Promise(resolve => { pending.push(resolve) }))
  const scope = fakeScope()
  const controller = client.exports.createRowController(scope)
  const stop = controller.start()
  await tick()
  scope.mutate = async () => { throw new Error('revision conflict') }
  await controller.setConfig({ compat: 'strict' })
  assert.match(controller.store.getState().error, /revision conflict/)
  pending[0](response(VIEW))
  await tick()
  assert.equal(controller.store.getState().error, 'revision conflict')

  // A failed passive refresh must not replace the user-owned save error.
  client.setFetch(async () => { throw new Error('network down') })
  await controller.refresh()
  assert.match(controller.store.getState().error, /revision conflict/)

  client.setFetch(async () => response({ ...VIEW, effective: undefined, problem: 'bashPath does not exist' }))
  await controller.refresh()
  assert.equal(controller.store.getState().notice, undefined)
  stop()
})

test('a malformed /state body lands in the row error instead of crashing it', async () => {
  const client = loadClient()
  client.setFetch(async () => response({ ok: true }))
  const controller = client.exports.createRowController(fakeScope())
  const stop = controller.start()
  await tick()
  assert.equal(controller.store.getState().status, 'error')
  assert.match(controller.store.getState().error, /unexpected \/state response/)
  stop()
})

test('validate tests the draft path and keeps the saved effective profile on a draft failure', async () => {
  const client = loadClient()
  const requests = []
  client.setFetch(async (url, options) => {
    const body = JSON.parse(options.body)
    requests.push({ url, body })
    if (url.endsWith('/state')) return response(VIEW)
    if (url.endsWith('/validate')) return response({ ok: true, problem: 'draft is invalid' })
    return response({ ok: true, candidates: [], notes: [] })
  })
  const controller = client.exports.createRowController(fakeScope())
  const stop = controller.start()
  await tick()
  const before = controller.store.getState().effective
  await controller.validate(String.raw`C:\Draft\bash.exe`)
  const request = requests.find(item => item.url.endsWith('/validate'))
  assert.equal(request.body.path, String.raw`C:\Draft\bash.exe`)
  assert.equal(request.body.msystem, 'auto', 'a draft is tested with Apply semantics')
  assert.equal(controller.store.getState().error, 'draft is invalid')
  assert.equal(controller.store.getState().effective, before, 'a draft failure must not clear the saved profile')
  // A later passive refresh does not erase the validate-owned error.
  client.setFetch(async () => response(VIEW))
  await controller.refresh()
  assert.equal(controller.store.getState().error, 'draft is invalid')
  stop()
})

test('a save during an in-flight Test clears the validating flag and drops the Test', async () => {
  const client = loadClient()
  const pendingValidate = []
  client.setFetch(async (url) => {
    if (url.endsWith('/validate')) return new Promise(resolve => { pendingValidate.push(resolve) })
    return response(VIEW)
  })
  const controller = client.exports.createRowController(fakeScope())
  const stop = controller.start()
  await tick()
  const testing = controller.validate(String.raw`C:\Draft\bash.exe`)
  await tick()
  assert.equal(controller.store.getState().validating, true)
  await controller.setConfig({ bashPath: String.raw`C:\Git\usr\bin\bash.exe`, msystem: 'auto' })
  assert.equal(controller.store.getState().validating, false, 'save releases the abandoned Test spinner')
  pendingValidate[0](response({ ok: true, profile }))
  await testing
  assert.equal(controller.store.getState().validating, false)
  stop()
})

test('a Test of the auto effective path is treated as the saved profile', async () => {
  const client = loadClient()
  const requests = []
  client.setFetch(async (url, options) => {
    if (url.endsWith('/state')) return response(VIEW)
    requests.push(JSON.parse(options.body))
    return response({ ok: true, profile })
  })
  const controller = client.exports.createRowController(fakeScope())
  const stop = controller.start()
  await tick()
  await controller.validate()
  assert.equal(requests.at(-1).path, profile.path)
  assert.equal(requests.at(-1).msystem, 'auto')
  assert.equal(controller.store.getState().notice, client.exports.NOTICE_VERSION_OK)
  stop()
})

test('malformed lastReplace/shellSandboxMode state is rejected instead of crashing the row', async () => {
  const client = loadClient()
  client.setFetch(async () => response({ ...VIEW, lastReplace: null }))
  const controller = client.exports.createRowController(fakeScope())
  const stop = controller.start()
  await tick()
  assert.equal(controller.store.getState().status, 'error')
  stop()

  client.setFetch(async () => response({ ...VIEW, capability: { ...VIEW.capability, shellSandboxMode: {} } }))
  const second = client.exports.createRowController(fakeScope())
  const stop2 = second.start()
  await tick()
  assert.equal(second.store.getState().status, 'error')
  stop2()
})
