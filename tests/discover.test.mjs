import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultMsystemFor,
  deriveRootFromBash,
  deriveRootFromGit,
  detectFlavor,
  environmentRootFor,
  isBlockedBash,
  parseBashVersion,
  profileFromPath,
  profilesForRoot,
} from '../lib/index.js'

test('WSL and System32 bash shims are excluded', () => {
  assert.equal(isBlockedBash('C:\\Windows\\System32\\bash.exe'), true)
  assert.equal(isBlockedBash('C:\\Windows\\Sysnative\\bash.exe'), true)
  assert.equal(isBlockedBash('C:\\Users\\River\\AppData\\Local\\Microsoft\\WindowsApps\\bash.exe'), true)
  assert.equal(isBlockedBash('\\\\wsl$\\Ubuntu\\bin\\bash'), true)
  assert.equal(isBlockedBash('C:\\Program Files\\Git\\bin\\bash.exe'), false)
})

test('install roots derive from both Git and MSYS2 layouts', () => {
  assert.equal(deriveRootFromBash('C:\\Program Files\\Git\\bin\\bash.exe'), 'C:\\Program Files\\Git')
  assert.equal(deriveRootFromBash('C:\\Program Files\\Git\\usr\\bin\\bash.exe'), 'C:\\Program Files\\Git')
  assert.equal(deriveRootFromBash('C:\\msys64\\usr\\bin\\bash.exe'), 'C:\\msys64')
  assert.equal(deriveRootFromBash('C:\\msys64\\ucrt64\\bin\\bash.exe'), 'C:\\msys64')
  assert.equal(deriveRootFromBash('C:\\random\\bash.exe'), undefined)
  assert.equal(deriveRootFromGit('C:\\Program Files\\Git\\cmd\\git.exe'), 'C:\\Program Files\\Git')
  assert.equal(deriveRootFromGit('C:\\Program Files\\Git\\mingw64\\bin\\git.exe'), 'C:\\Program Files\\Git')
  assert.equal(deriveRootFromGit('C:\\Program Files\\Git\\ucrt64\\bin\\git.exe'), 'C:\\Program Files\\Git')
  assert.equal(deriveRootFromGit('C:\\msys64\\ucrt64\\bin\\git.exe'), 'C:\\msys64')
  assert.equal(deriveRootFromGit('C:\\msys64\\clang64\\bin\\git.exe'), 'C:\\msys64')
  assert.equal(deriveRootFromGit('C:\\msys64\\usr\\bin\\git.exe'), 'C:\\msys64')
})

test('bash version parsing', () => {
  assert.equal(parseBashVersion('GNU bash, version 5.3.15(2)-release (x86_64-pc-cygwin)\n'), '5.3.15')
  assert.equal(parseBashVersion('GNU bash, version 5.3.20(1)-release (x86_64-pc-cygwin)'), '5.3.20')
  assert.equal(parseBashVersion('not bash'), undefined)
})

function tmp(name) {
  const dir = mkdtempSync(join(tmpdir(), `dsh-gitbash-${name}-`))
  return dir
}

function touch(path) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, '')
}

test('Git for Windows root produces one MINGW64 profile', t => {
  const root = tmp('git')
  t.after(() => rmSync(root, { recursive: true, force: true }))
  touch(join(root, 'cmd', 'git.exe'))
  touch(join(root, 'bin', 'bash.exe'))
  touch(join(root, 'usr', 'bin', 'bash.exe'))
  assert.equal(detectFlavor(root), 'git')
  const profiles = profilesForRoot(root)
  assert.equal(profiles.length, 1)
  assert.equal(profiles[0].flavor, 'git')
  assert.equal(profiles[0].msystem, 'MINGW64')
  assert.equal(profiles[0].valid, true)
  assert.equal(profiles[0].path, join(root, 'usr', 'bin', 'bash.exe'))
  // A user-provided bin\bash.exe is a launcher that resets MSYSTEM; it must
  // normalize to the usr\bin runtime.
  const fromBin = profileFromPath(join(root, 'bin', 'bash.exe'), 'auto')
  assert.equal(fromBin.profile?.path, join(root, 'usr', 'bin', 'bash.exe'))
  const quoted = profileFromPath(`"${join(root, 'bin', 'bash.exe')}"`, 'auto')
  assert.equal(quoted.profile?.path, join(root, 'usr', 'bin', 'bash.exe'))
})

test('MSYS2 root enumerates environments and picks UCRT64 by default', t => {
  const root = tmp('msys2')
  t.after(() => rmSync(root, { recursive: true, force: true }))
  touch(join(root, 'msys2.exe'))
  touch(join(root, 'usr', 'bin', 'bash.exe'))
  mkdirSync(join(root, 'ucrt64', 'bin'), { recursive: true })
  mkdirSync(join(root, 'mingw64', 'bin'), { recursive: true })
  assert.equal(detectFlavor(root), 'msys2')
  assert.equal(defaultMsystemFor(root), 'UCRT64')
  assert.equal(environmentRootFor(root, 'UCRT64'), join(root, 'ucrt64'))
  const profiles = profilesForRoot(root)
  const systems = profiles.map(profile => profile.msystem)
  assert.ok(systems.includes('UCRT64'))
  assert.ok(systems.includes('MINGW64'))
  assert.ok(systems.includes('MSYS'))
  assert.ok(!systems.includes('CLANG64'))
  assert.ok(profiles.every(profile => profile.valid))
})

test('profileFromPath rejects flavor/environment mismatches', t => {
  const git = tmp('git-mismatch')
  const msys = tmp('msys-mismatch')
  t.after(() => {
    rmSync(git, { recursive: true, force: true })
    rmSync(msys, { recursive: true, force: true })
  })
  touch(join(git, 'cmd', 'git.exe'))
  touch(join(git, 'bin', 'bash.exe'))
  const gitPath = join(git, 'bin', 'bash.exe')
  assert.equal(profileFromPath(gitPath, 'auto').profile?.msystem, 'MINGW64')
  assert.ok(profileFromPath(gitPath, 'UCRT64').problem?.includes('MINGW64'))

  touch(join(msys, 'msys2.exe'))
  touch(join(msys, 'usr', 'bin', 'bash.exe'))
  mkdirSync(join(msys, 'ucrt64', 'bin'), { recursive: true })
  mkdirSync(join(msys, 'mingw64', 'bin'), { recursive: true })
  const msysPath = join(msys, 'usr', 'bin', 'bash.exe')
  assert.equal(profileFromPath(msysPath, 'auto').profile?.msystem, 'UCRT64')
  assert.equal(profileFromPath(msysPath, 'MINGW64').profile?.msystem, 'MINGW64')
  assert.ok(profileFromPath(msysPath, 'CLANG64').problem?.includes('CLANG64'))
})
