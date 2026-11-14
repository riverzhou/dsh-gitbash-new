/**
 * A minimal real `ctx.subprocess` adapter for integration tests: spawn with
 * Node's child_process, collect stdout/stderr, support terminate + abort.
 * Offsets are string indices (ASCII test payloads only).
 */
import { spawn, spawnSync } from 'node:child_process'

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
      // Model the DSH provider: start from the scrubbed parent environment,
      // overlay the caller map, and delete entries whose value is undefined
      // (the tombstone contract composeEnv relies on).
      const env = { ...process.env, ...(spec.env ?? {}) }
      for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete env[key]
      }
      const child = spawn(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd,
        env,
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
        // The real provider owns the process tree. Node's child.kill() only
        // signals bash on Windows, so a foreground `bash -c 'sleep 5'` would
        // keep the pipes open until the child exits; taskkill /T models the
        // provider's job-object termination and keeps timeout tests honest.
        if (process.platform === 'win32' && child.pid !== undefined) {
          try {
            spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
              windowsHide: true,
              stdio: 'ignore',
              timeout: 2000,
            })
          } catch { /* fall through to kill */ }
        }
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
