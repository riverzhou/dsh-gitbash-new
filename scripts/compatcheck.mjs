/**
 * Contract drift check against the installed DSH desktop runtime.
 *
 * Third-party plugins cannot import DSH packages, so the guard is string-level:
 * read the deployed Host and Client bundles out of app.asar and assert the
 * contract tokens this plugin mirrors are still present. Run after a DSH
 * upgrade; a missing token means the plugin needs a compatibility update.
 *
 * The check also reads the runtime version and refuses a runtime below the
 * plugin's `engines.dsh` floor, so an old desktop cannot silently pass a
 * contract set it does not ship.
 *
 * Usage: `pnpm compatcheck` (or `node scripts/compatcheck.mjs <app.asar>`).
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Runtime floor derived from this package's own `engines.dsh` (single source). */
const pluginManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const dshRange = pluginManifest.engines?.dsh
const floorMatch = typeof dshRange === 'string' ? /^>=\s*(\S+)$/.exec(dshRange.trim()) : null
if (floorMatch === null) {
  console.error(`compatcheck: package.json engines.dsh must be a ">=x.y.z" floor; got ${JSON.stringify(dshRange)}`)
  process.exit(1)
}
const MINIMUM_DSH = floorMatch[1]

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

/** Split a semver string into numeric core and prerelease identifiers. */
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(value)
  if (match === null) return undefined
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] === undefined ? [] : match[4].split('.'),
  }
}

/** semver precedence comparison (numeric identifiers sort below alphanumeric). */
function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index]
    const right = b[index]
    if (left === undefined) return -1
    if (right === undefined) return 1
    const leftNumeric = /^\d+$/.test(left)
    const rightNumeric = /^\d+$/.test(right)
    if (leftNumeric && rightNumeric) {
      const difference = Number(left) - Number(right)
      if (difference !== 0) return difference < 0 ? -1 : 1
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1
    } else if (left !== right) {
      return left < right ? -1 : 1
    }
  }
  return 0
}

/** Compare two valid semver strings. */
function compareVersions(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] < b.core[index] ? -1 : 1
  }
  return comparePrerelease(a.prerelease, b.prerelease)
}

const checks = [
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-tool-bash/lib/index.js',
    label: 'tool-bash (bash tool + markers)',
    tokens: [
      'name: "bash"',
      'tool:bash',
      'getSectionOrder("TOOL_BASH")',
      'Check the [exit code: N] marker on every bash result; investigate failures before moving on.',
      'presentationMeta',
      'toolName: "bash"',
      '[exit code: ',
      '[killed by signal: ',
      '[stderr]',
      '[output truncated; full output: ',
      // 0.2.2 dropped the promoted hand-off sentence; this exact template must hold.
      '${promoted.timeoutMs}ms; moved to background job ${promoted.jobId}]`',
      'run_in_background',
      'sandbox_permissions',
      'sandboxPermissionsDescription',
    ],
  },
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-agent/lib/index.js',
    label: 'agent (agent/created)',
    tokens: ['agent/created'],
  },
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js',
    label: 'system-prompt (orders)',
    tokens: ['TOOL_BASH: 1e3', 'TOOL_PWSH: 1010', 'getSectionOrder'],
  },
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js',
    label: 'tools (scoped register/restrict)',
    tokens: [
      'tools.restrict() requires a scoped context',
      'tool "${name}" must declare output { schema, render, presentationMeta? }',
      'restrict(filter)',
      'register(definition, options = {})',
    ],
  },
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-sandbox/lib/index.js',
    label: 'sandbox (escalation vocabulary/locales)',
    tokens: [
      '[sandbox: file access denied under ',
      '[sandbox: escalation available',
      'Allow this operation with ',
      '允许本次操作使用 ',
      '権限でこの操作を許可します',
      'Permitir esta operación con permisos',
      'Autoriser cette opération avec les permissions',
      'Diesen Vorgang mit ',
      'Разрешить эту операцию с правами',
      'Permitir esta operação com permissões',
    ],
  },
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-client-ui-settings/lib/client.js',
    label: 'client configForms',
    tokens: ['configForms', 'whileServed', 'mutate'],
  },
  {
    path: 'dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js',
    label: 'client settings.general.item',
    tokens: ['settings.general.item', 'configForms.get'],
  },
]

let failed = false

const runtimeManifest = fileOf('dsh/package.json')
let runtimeVersion
if (runtimeManifest === undefined) {
  console.error('FAIL missing bundle: dsh/package.json')
  failed = true
} else {
  try {
    runtimeVersion = JSON.parse(runtimeManifest).version
  } catch {
    console.error('FAIL dsh/package.json is not valid JSON')
    failed = true
  }
}

const minimum = parseVersion(MINIMUM_DSH)
if (minimum === undefined) {
  console.error(`compatcheck: package.json engines.dsh floor is not valid semver: ${JSON.stringify(MINIMUM_DSH)}`)
  process.exit(1)
}
if (typeof runtimeVersion === 'string') {
  const current = parseVersion(runtimeVersion)
  if (current === undefined) {
    console.error(`FAIL dsh runtime version is not semver: ${JSON.stringify(runtimeVersion)}`)
    failed = true
  } else if (compareVersions(current, minimum) < 0) {
    console.error(`FAIL dsh runtime ${runtimeVersion} is below the plugin floor ${MINIMUM_DSH}`)
    failed = true
  } else {
    console.log(`ok   dsh runtime ${runtimeVersion} (floor ${MINIMUM_DSH})`)
  }
}

for (const check of checks) {
  const text = fileOf(check.path)
  if (text === undefined) {
    console.error(`FAIL missing bundle: ${check.path}`)
    failed = true
    continue
  }
  const missing = check.tokens.filter(token => !text.includes(token))
  if (missing.length > 0) {
    console.error(`FAIL ${check.label}: missing ${missing.map(token => JSON.stringify(token)).join(', ')}`)
    failed = true
  } else {
    console.log(`ok   ${check.label} (${check.tokens.length} tokens)`)
  }
}

if (failed) {
  console.error('\ncompatcheck failed: the deployed DSH contract drifted; inspect docs/DESIGN.md §4 and update the plugin.')
  process.exit(1)
}
console.log(`\ncompatcheck ok (${asar})`)
