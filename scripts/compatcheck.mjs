/**
 * Contract drift check against the installed DSH desktop runtime.
 *
 * Third-party plugins cannot import DSH packages, so the guard is string-level:
 * read the deployed `dsh-tool-bash` and `dsh-agent` bundles out of app.asar and
 * assert the contract tokens this plugin mirrors are still present. Run after a
 * DSH upgrade; a missing token means the plugin needs a compatibility update.
 *
 * Usage: `pnpm compatcheck` (or `node scripts/compatcheck.mjs <app.asar>`).
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const candidates = [
  process.argv[2],
  process.env.DSH_APP_ASAR,
  process.env.LOCALAPPDATA === undefined
    ? undefined
    : join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'),
].filter(value => typeof value === 'string')

const asar = candidates.find(value => existsSync(value) && statSync(value).isFile())
if (asar === undefined) {
  console.log('compatcheck: app.asar not found (set DSH_APP_ASAR or pass a path); skipped')
  process.exit(0)
}

const data = readFileSync(asar)
const headerSize = data.readUInt32LE(4)
const jsonSize = data.readUInt32LE(12)
const header = JSON.parse(data.subarray(16, 16 + jsonSize).toString('utf8'))
const base = 8 + headerSize

function entryOf(path) {
  let node = { files: header.files }
  for (const part of path.split('/').filter(Boolean)) {
    const children = node.files ?? node
    node = children[part]
    if (node === undefined) return undefined
  }
  return node
}

function fileOf(path) {
  const entry = entryOf(path)
  if (entry === undefined || entry.files !== undefined) return undefined
  const offset = Number(entry.offset)
  const size = Number(entry.size)
  return data.subarray(base + offset, base + offset + size).toString('utf8')
}

const checks = [
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-tool-bash/lib/index.js',
    tokens: [
      'name: "bash"',
      'tool:bash',
      'TOOL_BASH',
      'presentationMeta',
      '[exit code: ',
      'promoted',
      'still running after',
      'run_in_background',
      'sandbox_permissions',
    ],
  },
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-agent/lib/index.js',
    tokens: ['agent/created'],
  },
]

let failed = false
for (const check of checks) {
  const text = fileOf(check.path)
  if (text === undefined) {
    console.error(`FAIL missing bundle: ${check.path}`)
    failed = true
    continue
  }
  const missing = check.tokens.filter(token => !text.includes(token))
  if (missing.length > 0) {
    console.error(`FAIL ${check.path}: missing ${missing.map(token => JSON.stringify(token)).join(', ')}`)
    failed = true
  } else {
    console.log(`ok   ${check.path} (${check.tokens.length} tokens)`)
  }
}

const toolPath = 'dsh/node_modules/@deepseek-ai/dsh-tool-bash/lib/index.js'
const toolText = fileOf(toolPath)
if (toolText !== undefined) {
  const version = /version:\s*"([^"]+)"/.exec(toolText)?.[1]
  console.log(`compatcheck: tool-bash bundle${version !== undefined ? ` (${version})` : ''} from ${asar}`)
}

if (failed) {
  console.error('\ncompatcheck failed: the deployed DSH contract drifted; inspect docs/DESIGN.md §4 and update the plugin.')
  process.exit(1)
}
console.log('\ncompatcheck ok')
