/**
 * A minimal real `ctx.subprocess` adapter for integration tests: spawn with
 * Node's child_process, collect stdout/stderr, support terminate + abort.
 * Offsets are string indices (ASCII test payloads only).
 */
import { spawn } from 'node:child_process'

function reader(state) {
  return {
    readFrom(from) {
      const text = state.text.slice(from)
      return {
        text,
        nextOffset: state.text.length,
        lossy: false,
      }
    },
  }
}

export function createRealSubprocess() {
  return {
    spawn(spec) {
      const child = spawn(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd,
        env: spec.env ?? process.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const stdout = { text: '' }
      const stderr = { text: '' }
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', chunk => { stdout.text += chunk })
      child.stderr.on('data', chunk => { stderr.text += chunk })
      const done = new Promise((resolve, reject) => {
        child.on('error', reject)
        child.on('close', (exitCode, signal) => resolve({ exitCode, signal }))
      })
      const terminate = () => {
        try { child.kill() } catch { /* already gone */ }
      }
      if (spec.signal !== undefined) {
        if (spec.signal.aborted) terminate()
        else spec.signal.addEventListener('abort', terminate, { once: true })
      }
      return {
        collected: { stdout: reader(stdout), stderr: reader(stderr) },
        observed: { stdout: reader(stdout), stderr: reader(stderr) },
        done,
        terminate,
      }
    },
  }
}
