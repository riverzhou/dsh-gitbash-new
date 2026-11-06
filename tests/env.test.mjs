import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composeEnv, composePath, posixToWindows, resolveWorkdir } from '../lib/index.js'

function profile(overrides) {
  return {
    id: 'test',
    flavor: 'git',
    path: 'C:\\Git\\bin\\bash.exe',
    root: 'C:\\Git',
    label: 'Git for Windows',
    valid: true,
    ...overrides,
  }
}

test('POSIX drive paths convert to Windows paths', () => {
  assert.equal(posixToWindows('/c/Users/River'), 'C:\\Users\\River')
  assert.equal(posixToWindows('/d/GitHub/dsh/gitbash'), 'D:\\GitHub\\dsh\\gitbash')
  assert.equal(posixToWindows('/cygdrive/e/ffmpeg/bin'), 'E:\\ffmpeg\\bin')
  assert.equal(posixToWindows('~'), process.env.USERPROFILE)
  assert.equal(posixToWindows('/tmp/x').toLowerCase().startsWith(tmpdir().toLowerCase()), true)
  assert.equal(posixToWindows('/home/river'), '/home/river')
})

test('resolveWorkdir accepts Windows, POSIX-drive, relative, and rejects unmapped POSIX', t => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-gitbash-workdir-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'sub'))
  assert.equal(resolveWorkdir(root, root), root)
  assert.equal(resolveWorkdir('sub', root), join(root, 'sub'))
  const drive = root.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1')
  assert.equal(resolveWorkdir(drive, root), root)
  assert.equal(resolveWorkdir(`"${root}"`, undefined), root)
  assert.equal(resolveWorkdir(`'${root}'`, undefined), root)
  assert.throws(() => resolveWorkdir('/home/river', root), /absolute POSIX path/)
  assert.throws(() => resolveWorkdir('C:foo', root), /drive-relative/)
  assert.throws(() => resolveWorkdir('C:', root), /drive-relative/)
  assert.throws(() => resolveWorkdir(join(root, 'missing'), root), /does not exist/)
})

test('Git profile composes MINGW64 and prefixes Git paths', () => {
  const env = composeEnv(profile(), { PATH: 'C:\\Windows\\System32;C:\\msys64\\usr\\bin' })
  assert.equal(env.MSYSTEM, 'MINGW64')
  assert.equal(env.NO_COLOR, '1')
  assert.equal(env.TERM, 'dumb')
  assert.equal(env.PATH.startsWith('C:\\Git\\bin;C:\\Git\\usr\\bin'), true)
  assert.equal(env.PATH.toLowerCase().includes('c:\\msys64\\usr\\bin'), false)
  assert.equal(env.PATH.includes('C:\\Windows\\System32'), true)
})

test('composeEnv drops inherited PWD/OLDPWD so bash derives POSIX paths', () => {
  const env = composeEnv(profile(), {
    PATH: 'C:\\Windows',
    PWD: 'C:\\work',
    OLDPWD: 'C:\\old',
  })
  // The tombstone must be present: the subprocess service filters undefined
  // entries, which removes the ambient value instead of re-exporting it.
  assert.equal(Object.hasOwn(env, 'PWD'), true)
  assert.equal(Object.hasOwn(env, 'OLDPWD'), true)
  assert.equal(env.PWD, undefined)
  assert.equal(env.OLDPWD, undefined)
})

test('MSYS2 profile composes its MSYSTEM and selected environment first', () => {
  const msys = profile({
    id: 'msys',
    flavor: 'msys2',
    root: 'C:\\msys64',
    path: 'C:\\msys64\\usr\\bin\\bash.exe',
    msystem: 'UCRT64',
    environmentRoot: 'C:\\msys64\\ucrt64',
    label: 'MSYS2 UCRT64',
  })
  const env = composeEnv(msys, {
    PATH: 'C:\\Program Files\\Git\\bin;C:\\msys64\\mingw64\\bin;C:\\Windows\\System32;C:\\msys64\\usr\\bin',
  })
  assert.equal(env.MSYSTEM, 'UCRT64')
  assert.equal(env.MSYS2_PATH_TYPE, 'inherit')
  const parts = env.PATH.split(';')
  assert.equal(parts[0], 'C:\\msys64\\ucrt64\\bin')
  assert.equal(parts[1], 'C:\\msys64\\usr\\bin')
  assert.equal(parts.includes('C:\\msys64\\mingw64\\bin'), false)
  assert.equal(parts.some(part => part.toLowerCase().includes('program files\\git')), false)
})

test('foreign roots are excluded from PATH', () => {
  const git = profile()
  const path = composePath(git, 'C:\\msys64\\ucrt64\\bin;C:\\Tools;C:\\Git\\bin', ['C:\\msys64'])
  assert.equal(path, 'C:\\Git\\bin;C:\\Git\\usr\\bin;C:\\Tools')
})

test('cross-drive static guards still exclude MSYS2/Git', () => {
  const git = profile()
  const gitPath = composePath(git, 'D:\\msys64\\usr\\bin;E:\\msys64\\usr\\bin;C:\\Tools')
  assert.equal(gitPath.includes('msys64'), false)
  const msys = profile({
    id: 'msys',
    flavor: 'msys2',
    root: 'C:\\msys64',
    path: 'C:\\msys64\\usr\\bin\\bash.exe',
    msystem: 'UCRT64',
    environmentRoot: 'C:\\msys64\\ucrt64',
    label: 'MSYS2 UCRT64',
  })
  const msysPath = composePath(msys, 'D:\\Program Files\\Git\\bin;C:\\Tools')
  assert.equal(msysPath.toLowerCase().includes('git'), false)
})

test('composeEnv lets the managed DSH_* snapshot win', () => {
  const env = composeEnv(profile(), { PATH: 'C:\\Windows' }, { DSH_HOME: 'C:\\Users\\River\\.dsh' })
  assert.equal(env.DSH_HOME, 'C:\\Users\\River\\.dsh')
  assert.equal(env.MSYSTEM, 'MINGW64')
})

test('a Cygwin profile keeps its own bin and filters foreign roots', () => {
  const root = String.raw`C:\cygwin`
  const cygwin = profile({
    id: 'cyg',
    flavor: 'cygwin',
    root,
    path: `${root}\\bin\\bash.exe`,
    msystem: undefined,
    label: 'Cygwin',
  })
  const path = composePath(cygwin, `${root}\\bin;D:\\msys64\\usr\\bin;C:\\Windows`)
  const parts = path.split(';')
  assert.equal(parts.includes(`${root}\\bin`), true)
  assert.equal(parts.includes('C:\\Windows'), true)
  assert.equal(path.toLowerCase().includes('msys64'), false)
})

test('a Cygwin profile removes inherited MSYSTEM/MSYS2_PATH_TYPE', () => {
  const root = String.raw`C:\cygwin`
  const cygwin = profile({
    id: 'cyg',
    flavor: 'cygwin',
    root,
    path: `${root}\\bin\\bash.exe`,
    msystem: undefined,
    label: 'Cygwin',
  })
  const env = composeEnv(cygwin, {
    PATH: 'C:\\Windows',
    MSYSTEM: 'MINGW64',
    MSYS2_PATH_TYPE: 'inherit',
  })
  // Tombstones, like PWD/OLDPWD: the subprocess service drops the ambient value.
  assert.equal(Object.hasOwn(env, 'MSYSTEM'), true)
  assert.equal(Object.hasOwn(env, 'MSYS2_PATH_TYPE'), true)
  assert.equal(env.MSYSTEM, undefined)
  assert.equal(env.MSYS2_PATH_TYPE, undefined)
})
