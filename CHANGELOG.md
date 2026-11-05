# Changelog

All notable changes to this project are documented here. One version per
entry; the Git history is the evidence.

## 0.2.3 — 2026-11-06

DSH 0.2.2 synchronization. Baseline moves to desktop runtime `0.2.2-rc.1`
(source checkout `dsh-v0.2.2-rc.1`); the plugin now requires DSH `>=0.2.2-0`.

### Changed

- **Promoted result text** follows the official 0.2.2 renderer: a foreground
  call that moves to the background ends at
  `[still running after <t>ms; moved to background job <id>]`. The old
  “The command keeps running…” hand-off sentence is gone because DSH 0.2.2
  moved that guidance into the `tool:jobs` prompt section.
- `engines.dsh` is `>=0.2.2-0` and `engines.node` is `>=24.9.0`, matching the
  DSH 0.2.2 workspace floor; `@deepseek-ai/schemastery` is `~3.19.0`.
- `package.json.dsh.bundle.platforms` is `["win32"]`: DSH 0.2.2 rejects or
  skips the bundle on non-Windows Hosts before reading `cordis.patch.yml`
  (the patch gate remains as the second line of defence).

### Added

- Escalation approval text now covers all eight DSH 0.2.2 locales
  (`en`, `zh`, `ja`, `es`, `fr`, `de`, `ru`, `pt`) with the official strings;
  previously only `en`/`zh` were supplied and every other UI language fell
  back to English.
- `compatcheck` reads the deployed `dsh/package.json`, enforces the floor from
  this package's `engines.dsh`, and checks Host **and Client** bundles
  (`tool-bash`, `agent`, `system-prompt`, `tools`, `sandbox`,
  `client-ui-settings`, `client-ui-settings-general`), including the new
  promoted template and all eight escalation locale strings.
- Packaging tests for the 0.2.2 manifest fields (`dsh.bundle.platforms`,
  engine floors, patch platform gate, client entry points).
- Real-machine smoke on DSH `0.2.2-rc.1`: Git and MSYS2 direct calls, a
  promoted call (new text), background job + `job_output`, a continuable
  subagent, and the real settings row (UI switch to MSYS2 UCRT64) — recorded
  in `docs/SMOKE.md` with a fresh screenshot.

### Tests

- 82 tests (up from 75): promote-without-guidance, compat-note placement,
  eight-locale escalation text, and the packaging contract.

### Not covered

- The Windows ACL sandbox still uses `DISABLE_MAX_PRIVILEGE |
  WRITE_RESTRICTED` in 0.2.2 (only `LUA_TOKEN` was dropped); the
  “MSYS2 cannot start confined” conclusion is re-checked at source level, not
  re-run on 0.2.2. The compatibility-mode security model is unchanged.
- `read-only` / `strict` real-UI refusal and the approval dialog remain
  unit-covered, as in 0.2.2.

## 0.2.2 — 2026-10-18

### Fixed

- **Settings dropdown contrast**: the native Shell, Compatibility and
  MSYS2-environment `<select>` popups rendered a white list with the dark
  theme's white text (white-on-white). The row now paints both the control and
  every `<option>` with DSH surface/text/border tokens, falling back to
  `Canvas`/`CanvasText`; the closed control and the open list are verified in
  both light and dark themes.
- **Windows signal exits**: MSYS2/Git Bash encode death-by-signal as
  `signalNumber << 8` in the Windows exit code (`kill -TERM $$` → 3840,
  `kill -KILL $$` → 2304), while Node reports `signal: null` on Windows. The
  executor normalizes that encoding, so a foreground result now ends with
  `[killed by signal: SIGTERM]` and a background job settles as
  `killed, signal: SIGTERM` instead of `[exit code: 3840]` / `completed`.
  Normal bash exits are masked to 0..255; non-multiples of 256 (for example
  `0xC0000005`) stay exit codes.
- **Stale `PWD`/`OLDPWD`**: the host process can export a Windows `PWD`
  (`D:\work`). Bash trusts it when it matches the cwd and then reports a
  Windows-form `$PWD`, so `pwd` returned `D:/...` in an MSYS2 session. The
  composed child environment now carries explicit `undefined` tombstones for
  both variables; bash derives the POSIX path from the real cwd.
- Tests: 75 (up from 69), including a real Git Bash signal regression, a
  Windows-PWD/`$PWD` regression, fake-provider normalization cases, and a
  client-bundle theme-token guard.

### Changed

- Version `0.2.2`; README/README.zh install pins, settings screenshots for both
  themes, and `docs/SMOKE.md` evidence.

## 0.2.1 — 2026-10-18

Audit-fix release. The package is now licensed under **GPL-3.0-only** (was
MIT), and the confirmed defects from the code audit are fixed.

### Fixed

- **Fail-closed sandbox policy**: an invalid/undefined `ctx.sandboxPolicy.resolve`
  result no longer falls through to `danger-full-access`; bash refuses to run
  without a known `read-only` / `workspace-write` / `danger-full-access` mode.
- **Invalid `compat` values** no longer silently degrade to `auto`; an unknown
  non-empty string is treated as `strict` (typos stay safe).
- **MSYS2/Git root derivation**: `ucrt64`, `clang64`, `clangarm64`, `mingw64`,
  `mingw32` and `usr\bin` `git.exe`/`bash.exe` layouts now derive the install
  root correctly instead of the environment directory.
- **Background startup failures**: an MSYS2 fatal startup signature is detected
  in the executor outcome, so background jobs report `failed` instead of
  `completed, exit code: 0`; foreground and job results agree.
- **Job registry errors**: `registry.wait` failures stay real errors (only an
  actual abort becomes `AbortError`); `registry.kill`/`remove` failures are
  best-effort and no longer mask the original cause.
- **PATH isolation**: MSYS2/Cygwin/Git static guards now match install roots on
  any drive, not only `C:`.
- **Settings diagnostics**: `/api/dsh-gitbash/state` now returns `problem` when
  the configured path is unusable; the row shows it instead of only “no path”.
- **Settings writes**: path + `msystem` are written through one atomic
  `configForms.mutate`; a successful refresh clears stale errors; `start()`
  resets its disposed flag for React StrictMode.
- **Quoted paths**: single/double quotes are stripped consistently in settings,
  discovery, validation and `workdir`.
- **Null exit**: no more `[exit code: null]`; an unavailable status is rendered
  as `[exit status unavailable]`.
- **Startup false positives**: startup signatures are only classified when
  stdout is empty, so a legitimate command printing the phrase is not failed.
- **Cancellation**: the spawn abort controller is aborted together with
  `terminate()`; a provider rejection caused by that abort is not reclassified
  as a spawn error.
- Integration tests no longer hardcode `D:\GitHub\dsh-gitbash-new`.

### Changed

- Version `0.2.1`; npm package name remains `@riverzh/dsh-gitbash`.
- License: MIT → **GPL-3.0-only**; `LICENSE` replaced with the GNU GPL v3 text.
- README/README.zh.md: npm install section and GPL wording.
- 69 tests (up from 59): policy fail-closed, background startup, registry
  errors, cross-drive PATH, state problem, quoted paths, null exit, startup
  false positive and abort-signal regressions.

## 0.2.0 — 2026-10-18

First public release, published as `@riverzh/dsh-gitbash`. `0.1.0` was the internal implementation baseline; the
following is what is new in the published package.

### Added

- Compact settings row (`settings.general.item`): a Shell selector fed by
  cached profiles (`Auto` / Git / each MSYS2 environment), a compatibility
  switch, a one-line safety warning, and a folded **Advanced & diagnostics**
  section for manual path, test, environment and status.
- `/api/dsh-gitbash/state` now returns cached `candidates` and `recommended`,
  so opening Settings does not wait for a scan. **Refresh** still probes
  `bash --version`.
- Real-machine verification on DSH `0.2.1-rc.2`: Git for Windows and MSYS2
  UCRT64 each exercised through direct bash, background jobs
  (`job/registered` / `job/settled`, `job_output`) and subagents (child bash,
  parent notification), plus the Web UI settings switch and native
  background/subagent cards. Screenshots live in `docs/images/`.
- Bilingual manuals: `README.md` (English) and `README.zh.md` (简体中文),
  both covering installation, security, the bash/job/subagent contract,
  Git/MSYS2 profiles, settings, cookbook, troubleshooting and development.
- Unit coverage for the `/api` routes and for Git `bin` → `usr\bin`
  canonicalization; total suite is 59 tests.

### Fixed

- **Git `bin\bash.exe` reset `MSYSTEM`**: the launcher re-derived the
  environment from the installation (Git 2.56 → UCRT64), overriding the
  requested `MINGW64`. `profileFromPath` now normalizes Git's `bin\bash.exe`
  to `usr\bin\bash.exe`; a Git session reports `MSYSTEM=MINGW64`.
- The compatibility notice is now shell-neutral:
  `[compat: bash runs outside the DSH file sandbox (...)]` instead of naming
  only Git Bash (MSYS2 uses the same path).

### Changed

- Node engine aligned with DSH 0.2.1:
  `^22.19.0 || >=24.0.0`.
- Repository metadata and documented GitHub install command use
  `riverzhou/dsh-gitbash-new`.
- `files` includes `README.zh.md`, so npm packages ship both manuals.

### Security

- Documented and enforced the Windows sandbox/MSYS2 incompatibility: bash is
  never silently confined. `compat: auto` runs bash unconfined under
  `workspace-write` with a result note; `read-only` refuses; `strict` allows
  only `danger-full-access`. File tools remain sandboxed.

## 0.1.0 — 2026-10-18

Internal implementation baseline (not published to npm).

### Added

- Per-agent replacement of the preset `pwsh` tool with a `bash` tool, scoped to
  `agent/created`; `tool:pwsh` prompt section shadowed and a Windows-specific
  safety section added.
- Git for Windows, MSYS2 (UCRT64 / MINGW64 / CLANG64 / CLANGARM64 / MINGW32 /
  MSYS) and best-effort Cygwin profiles, with WSL hard exclusion, registry /
  known-root / `where` / PATH discovery, and version probing.
- Profile-specific environment composition: `MSYSTEM`, PATH isolation between
  Git/MSYS2, `NO_COLOR` / `TERM=dumb` / pager overrides, `DSH_*` pass-through.
- Official `tool-bash`-shaped tool contract: `description` / `command` /
  `timeoutMs` / `workdir` / `run_in_background` / `sandbox_permissions` /
  `justification`; closed `oneOf` output schema; marker-compatible rendering;
  `presentationMeta.cwd`; terminal/generic card presenters.
- Background jobs through `ctx.jobs`, foreground-as-job, timeout promotion and
  one consuming read on promotion.
- Official escalation semantics (`workspace-write` / `danger-full-access`),
  approval routing, and the compatibility-mode security model.
- Initial settings row (`settings.general.item`) with path field, auto
  discovery, MSYS2 environment selection, compatibility mode, test action and
  `/api/dsh-gitbash/{state,discover,validate}` routes.
- Diagnostics at `%TEMP%\dsh-gitbash.log`; unit, executor, replacement, tool
  and real Git/MSYS2 integration tests; `selftest` and `compatcheck` scripts.

### Security

- Documented the Windows sandbox/MSYS2 incompatibility and the explicit
  compatibility-mode policy; no silent permission widening.
