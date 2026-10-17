/**
 * Fake `ctx.subprocess` for unit tests: collected readers over strings, a
 * deferred or immediate exit, and terminate support for timeout/abort cases.
 */
function reader(text) {
  return {
    readFrom(from) {
      return { text: text.slice(from), nextOffset: text.length, lossy: false }
    },
  }
}

/**
 * @param {object} options
 * @param {string} [options.stdout]
 * @param {string} [options.stderr]
 * @param {number|null} [options.exitCode]
 * @param {string|null} [options.signal]
 * @param {boolean} [options.autoExit] resolve `done` immediately
 */
export function createFakeSubprocess(options = {}) {
  const stdout = options.stdout ?? ''
  const stderr = options.stderr ?? ''
  const exitCode = options.exitCode ?? 0
  const signal = options.signal ?? null
  const autoExit = options.autoExit ?? true
  const calls = []
  let resolveDone
  let terminated = false
  const done = autoExit
    ? Promise.resolve({ exitCode, signal })
    : new Promise(resolve => { resolveDone = resolve })
  const terminate = () => {
    terminated = true
    resolveDone?.({ exitCode: null, signal: 'SIGTERM' })
  }
  const handle = {
    collected: { stdout: reader(stdout), stderr: reader(stderr) },
    observed: { stdout: reader(stdout), stderr: reader(stderr) },
    done,
    terminate,
    get terminated() { return terminated },
  }
  return {
    calls,
    get handle() { return handle },
    get terminated() { return terminated },
    spawn(spec) {
      calls.push(spec)
      return handle
    },
  }
}
