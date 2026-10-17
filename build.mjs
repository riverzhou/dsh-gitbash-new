/**
 * dsh-gitbash build.
 *
 * Two artifacts:
 * - lib/index.js  host half: ESM, loaded by the DSH Loader. Runtime packages are
 *                 external (the profile installs @deepseek-ai/schemastery).
 * - lib/client.js browser half: classic script, self-registers with
 *                 `window.__ModuleLoader__`; the factory body is CJS and may
 *                 require only page seed modules (react / react/jsx-runtime).
 *                 A sourcemap trailer is mandatory for the client loader.
 */
import { readFileSync } from 'node:fs'
import { build, context } from 'esbuild'

const watch = process.argv.includes('--watch')
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/** Host half: plain ESM; every bare import stays external. */
const hostOptions = {
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
}

const clientBanner = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(pkg.name)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
].join('\n')

const clientFooter = ['\t\treturn module.exports;', '\t}', '});'].join('\n')

/** Browser half: classic script wrapper, CJS factory, React as a page seed. */
const clientOptions = {
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  banner: { js: clientBanner },
  footer: { js: clientFooter },
  sourcemap: true,
  logLevel: 'info',
}

if (watch) {
  await build(hostOptions)
  const client = await context(clientOptions)
  await client.watch()
  console.log('[dsh-gitbash] watching client bundle')
} else {
  await build(hostOptions)
  await build(clientOptions)
}
