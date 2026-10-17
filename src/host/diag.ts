/**
 * One-line file diagnostics. The host half runs in the DSH process and its
 * stderr is not a reliable place to look; a small append-only file is.
 *
 * Never log commands, environment values, or credentials — only lifecycle
 * facts and error text.
 */
import { appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Where diagnostics are written. */
export function diagFile(): string {
  return join(tmpdir(), 'dsh-gitbash.log')
}

/** Append one line; diagnostics must never break the caller. */
export function diag(message: string): void {
  try {
    appendFileSync(diagFile(), `${new Date().toISOString()} ${message}\n`, 'utf8')
  } catch {
    // Diagnostics are best-effort.
  }
}
