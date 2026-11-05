/**
 * Packaging contract for DSH 0.2.2.
 *
 * 0.2.2 added the `dsh.bundle.platforms` manifest field (host admission before
 * the bundle patch is read) and raised the workspace Node floor to 24.9. These
 * tests pin the fields a DSH upgrade can invalidate silently: a wrong or absent
 * platform list publishes a bundle DSH will refuse to load on Windows, and a
 * floor below the installed runtime hides an incompatibility until boot.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

test('bundle declares the win32 Host platform', () => {
  assert.deepEqual(manifest.dsh.bundle.platforms, ['win32'])
  assert.equal(typeof manifest.dsh.bundle.patch, 'string')
  assert.equal(existsSync(join(root, manifest.dsh.bundle.patch)), true)
})

test('bundle patch keeps the second platform gate', () => {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.equal(patch.includes("process.platform !== 'win32'"), true)
})

test('web client half and npm entry points are declared', () => {
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.main, 'lib/index.js')
  assert.equal(manifest.exports['./client'].default, './lib/client.js')
})

test('dsh floor is the 0.2.2 baseline and parseable by compatcheck', () => {
  assert.match(manifest.engines.dsh, /^>=0\.2\.2-0$/)
  // compatcheck derives its floor from this same field.
  const script = readFileSync(join(root, 'scripts/compatcheck.mjs'), 'utf8')
  assert.equal(script.includes("pluginManifest.engines?.dsh"), true)
})

test('node floor follows the DSH 0.2.2 workspace requirement', () => {
  assert.equal(manifest.engines.node, '>=24.9.0')
})
