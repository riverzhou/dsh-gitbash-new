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
  assert.throws(() => resolveWorkdir('/home/river', root), /absolute POSIX path/)
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

test('composeEnv lets the managed DSH_* snapshot win', () => {
  const env = composeEnv(profile(), { PATH: 'C:\\Windows' }, { DSH_HOME: 'C:\\Users\\River\\.dsh' })
  assert.equal(env.DSH_HOME, 'C:\\Users\\River\\.dsh')
  assert.equal(env.MSYSTEM, 'MINGW64')
})
