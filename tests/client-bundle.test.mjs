import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

test('settings controls keep the DSH theme-token contract', () => {
  // Native <select> popups on Windows do not inherit a transparent surface;
  // both the control and its options must carry the theme tokens. A fallback
  // keeps old hosts readable when the tokens are absent.
  assert.equal(client.includes('--dsw-alias-bg-layer-2'), true)
  assert.equal(client.includes('--dsw-alias-brand-text'), true)
  assert.equal(client.includes('--dsw-alias-border-l2'), true)
  assert.equal(client.includes('CanvasText'), true)
})
