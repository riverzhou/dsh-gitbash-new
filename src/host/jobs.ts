/**
 * Job adapter for bash executions: pull sources the registry pumps, the
 * terminal outcome it records, and the cancellation bridge.
 */
import type { BashExecution } from './executor.ts'
import { ringDelta } from './render.ts'
import type { JobHooksLike, JobOutcomeLike, JobOutputSourceLike } from './types.ts'

export { ringDelta }

/** The process's non-consuming readers as registry pull sources. */
export function processSources(proc: () => Pick<BashExecution, 'observed'> | undefined): JobOutputSourceLike[] {
  const source = (channel: 'stdout' | 'stderr'): JobOutputSourceLike => ({
    channel,
    read: (fromByte) => {
      const live = proc()
      if (live === undefined) return { text: '', nextOffset: fromByte, lossy: false }
      return live.observed[channel].readFrom(fromByte)
    },
  })
  return [source('stdout'), source('stderr')]
}

/** Map a settled execution onto the job outcome vocabulary. */
export function processOutcome(proc: BashExecution): JobOutcomeLike {
  if (proc.startupFailure !== undefined) {
    return { status: 'failed', detail: `bash startup failed: ${proc.startupFailure}` }
  }
  if (proc.failure !== undefined) {
    return { status: 'failed', detail: proc.failure }
  }
  if (proc.status === 'killed') {
    return { status: 'killed', detail: proc.signal !== null ? `signal: ${proc.signal}` : 'killed before exit' }
  }
  return {
    status: 'completed',
    detail: proc.exitCode === null ? 'exit status unavailable' : `exit code: ${proc.exitCode}`,
  }
}

/** Job hooks plus the original error of a job that failed before its process produced an outcome. */
export interface ProcessJobHooksLike extends JobHooksLike {
  /**
   * The error that ended a `failed` preparation, kept with its own class and
   * message; undefined while the job runs and for a completed or killed job.
   * @returns the original failure, boxed so any thrown value is preserved.
   */
  failure(): { error: unknown } | undefined
}

/**
 * Adapt asynchronous preparation after job admission without exposing a
 * partial process. Cancellation aborts the spawn signal and kills a live
 * process; `done` never rejects.
 */
export function processJob(
  start: (signal: AbortSignal) => Promise<BashExecution>,
  outcome: (process: BashExecution) => JobOutcomeLike,
): ProcessJobHooksLike {
  const controller = new AbortController()
  let process: BashExecution | undefined
  let failure: { error: unknown } | undefined
  const done: Promise<JobOutcomeLike> = (async () => {
    try {
      process = await start(controller.signal)
      try {
        if (controller.signal.aborted) process.kill()
      } finally {
        await process.done
      }
      return outcome(process)
    } catch (error) {
      // A kill before the process published is the caller's own cancellation,
      // not a failure; anything else keeps its original error for the
      // foreground projection that rethrows it (DSH 0.2.2-rc.3).
      const killed = controller.signal.aborted && process === undefined
      if (!killed) failure = { error }
      return {
        status: killed ? 'killed' : 'failed',
        detail: error instanceof Error ? error.message : String(error),
      }
    }
  })()
  return {
    cancel: (reason) => {
      if (controller.signal.aborted) return
      controller.abort(reason)
      process?.kill()
    },
    done,
    failure: () => failure,
  }
}
