import test from 'node:test'
import assert from 'node:assert/strict'
import { Config, readSettings } from '../lib/index.js'

test('entry Config is a real schemastery schema', () => {
  assert.equal(typeof Config, 'function')
  assert.equal(typeof Config.toJSON, 'function')
})

test('defaults apply when the config is absent', () => {
  assert.deepEqual(readSettings(undefined), { bashPath: '', msystem: 'auto', compat: 'auto' })
})

test('volatile fields are read through get()', () => {
  const settings = readSettings({
    bashPath: { get: () => '  C:\\Program Files\\Git\\bin\\bash.exe  ' },
    msystem: { get: () => 'UCRT64' },
    compat: { get: () => 'strict' },
  })
  assert.deepEqual(settings, {
    bashPath: 'C:\\Program Files\\Git\\bin\\bash.exe',
    msystem: 'UCRT64',
    compat: 'strict',
  })
})

test('unknown values fall back instead of leaking into the runtime', () => {
  const settings = readSettings({ bashPath: 42, msystem: 'NOT_AN_ENV', compat: 'yolo' })
  // An unknown compatibility string is a safety typo: keep strict, not auto.
  assert.deepEqual(settings, { bashPath: '', msystem: 'auto', compat: 'strict' })
})

test('quoted YAML paths are unquoted', () => {
  assert.equal(readSettings({ bashPath: '"C:\\Git\\bin\\bash.exe"' }).bashPath, 'C:\\Git\\bin\\bash.exe')
  assert.equal(readSettings({ bashPath: "'C:\\Git\\bin\\bash.exe'" }).bashPath, 'C:\\Git\\bin\\bash.exe')
})
