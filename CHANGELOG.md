# Changelog

All notable changes to this project are documented here. One version per
entry; the Git history is the evidence.

## 0.2.6 — 2026-11-06

Third audit release. No DSH contract change; hardens inherited shell state,
MSYS2 path inference, client row lifecycle and job/presenter diagnostics.

### Fixed

- **Inherited shell state**: `composeEnv` now tombstones `BASH_ENV`, `ENV`,
  `BASH_FUNC_*`, `SHELLOPTS`, `BASHOPTS`, `CDPATH`, `GLOBIGNORE`,
  `POSIXLY_CORRECT`, `BASH_COMPAT`, `BASH_XTRACEFD`, `PS4`, `PROMPT_COMMAND`
  and `IFS`. A host shell can no longer inject a startup script or exported
  function into every `bash -c`. Verified end-to-end by starting DSH with a
  hostile `BASH_ENV` and `BASH_FUNC_evil`; the child reported `BASH_ENV=UNSET`,
  `CLEAN`, `FUNC_GONE`, and no marker file was created.
- **MSYS2 environment-bin paths**: a manual `<root>\<env>\bin\bash.exe` now
  infers that environment when `msystem=auto`; an explicit mismatching
  `msystem` is rejected. Previously a UCRT64 binary could run with MINGW64's
  `MSYSTEM`/PATH.
- **Client row lifecycle**: the `whileServed` callback now returns the slot
  disposer (the official contract), and `seatRow` returns a release function
  owned by `ctx.effect`; the row unregisters when the namespace disappears and
  can be seated again. Late `inject` callbacks and form snapshots are guarded.
- **Stale candidates**: a successful `/state` with an empty `candidates` list
  now clears the old list instead of leaving uninstalled profiles in the Shell
  dropdown. `recommended` is cleared the same way.
- **Provider failure after spawn** is reported as a failed job with the provider
  message, not a bare `killed`; `BashExecution.failure` exposes it.
- **Presenter fallbacks**: background results are recognized from their
  acknowledgement text when the tool value is absent; promoted markers are
  recognized even when a DSH spill-policy footer follows them.
- **Getter/service hardening**: a throwing `shell.sandboxMode` getter cannot
  break tool creation; store snapshots/subscriptions and client late injection
  are guarded.
- **Single source**: `COMPAT_MODES` moved to `shared/protocol.ts`; the row
  renders its options from it. Dead `state.applied`/`agents` fields removed.

### Tests

- 97 tests (up from 95): inherited shell env clearing, MSYS2 env-bin inference
  and mismatch rejection, provider failure → failed outcome, background
  acknowledgement presenter fallback, promoted marker with spill footer.
- Live on DSH `0.2.2-rc.1`: real Chromium read-only refusal; approval allow/deny;
  workspace-write escalation labeling; 108,894-byte output spill with tail and
  truncation notice; live `job_kill`; `/tmp` workdir; hostile `BASH_ENV`
  clearing; final clean settings row (3 selects, no console errors). See
  `docs/SMOKE.md`.
- 0.2.4's 31/31 scenario + 15/15 UI checks and 0.2.5's 13/13 manual-path flow
  remain part of the evidence.

### Not covered

- The 0.2.2 restricted-token MSYS2 experiment was not re-run; DESIGN §2.1 is a
  source-level review.
- No local Cygwin installation; Cygwin paths are unit/logic-covered only.

## 0.2.5 — 2026-11-06

Second audit release. No DSH contract change; hardens path/UI/provider edges
found by a second pass over every source file and the client bundle.

### Fixed

- **Manual path vs. MSYS2 environment**: applying a changed manual path now
  writes `bashPath` + `msystem: auto` in one `configForms.mutate`. Previously a
  stale `UCRT64` value made a newly entered Git path invalid (and a stale
  `MINGW64` did the same for MSYS2). The MSYS2 environment control is disabled
  while the effective profile is Git.
- **Drive-relative `workdir`**: `C:foo` / `C:` are rejected. Node resolved them
  against the host's C: current directory, so the command could run somewhere
  other than the session workspace.
- **Cygwin + concrete `msystem`** is rejected with a clear problem instead of
  silently dropping the setting.
- **Presenter fallback**: a promoted result is recognized even when the
  external bridge does not receive the tool `value` (DSH 0.2.2's `ToolResult`
  has only `content`/`isError`/`meta`); a background result is recognized from
  `value.kind` or `run_in_background`. This avoids drawing a running job as an
  exit-0 terminal card.
- **Discovery probe isolation**: `bash --version` now runs with `env: {}`.
  Discovery can reach a `bash.exe` found on PATH; it must not receive the DSH
  host's credentials/tokens.
- **Provider/early-service robustness**: a throwing volatile config getter
  falls back to defaults; a throwing `ctx.get` in route registration or client
  plugin `apply` no longer breaks plugin load; duplicate slot injection after
  HMR is caught.

### Changed

- `pnpm test` / `pnpm selftest` now build first (`pretest`/`preselftest`), so
  tests can never pass against a stale `lib/`.
- `tsconfig` enables `noUnusedLocals` / `noUnusedParameters`; dead imports,
  `DEFAULT_CONFIG` and the unused duplicate test key are gone.
- Docs updated for the manual-path behavior, drive-relative `workdir`, probe
  environment and the second audit record.

### Tests

- 95 tests (up from 90): promoted/background presenter fallbacks, drive-relative
  `workdir`, Cygwin `msystem` rejection, throwing config getter, throwing
  `ctx.get`.
- Live on DSH `0.2.2-rc.1`: 13/13 real settings-page checks (Git → manual MSYS2
  → manual Git; disabled/enabled environment control), Git/MSYS2 discovery
  7/7 with the empty probe environment, direct/promote/signal/background API
  checks, and the new drive-relative rejection. See `docs/SMOKE.md`.

### Not covered

- `read-only` real-UI click and the escalation approval dialog remain
  unit-covered.
- The 0.2.2 restricted-token MSYS2 experiment was not re-run; DESIGN §2.1 is a
  source-level review.

## 0.2.4 — 2026-11-06

Audit release on top of the published `0.2.3`. No DSH contract drift; the
changes harden failure paths, remove duplicated constants, and make the
documentation match the implementation.

### Fixed

- **A composition without `ctx.sandboxPolicy` no longer installs a dead
  `bash`**: the replacement now requires `ctx.sandboxPolicy.resolve` (bash runs
  outside DSH's confinement, so this service is the only source of the session
  mode), keeps `pwsh` otherwise, and the settings row shows the missing
  capability. The previous build registered `bash` and failed on every call.
- **`bashPath` must be absolute**: a relative path is rejected instead of being
  resolved against the DSH host's current directory, which would silently
  change the selected profile when the host cwd changed.
- **Inherited `MSYSTEM` / `MSYS2_PATH_TYPE` are tombstoned**, like `PWD` and
  `OLDPWD`. A Cygwin profile can no longer inherit `MSYSTEM` from the host.
- **Client `/api` errors**: the carrier's 401/auth responses are plain text;
  the row now reads the body and reports the status plus a bounded excerpt
  instead of a `JSON.parse` exception.
- **`compatcheck` now also checks the replacement target** (`dsh-tool-pwsh`:
  `name: "pwsh"`, `tool:pwsh`, `getSectionOrder("TOOL_PWSH")`) so the plugin
  cannot silently stop hiding the tool it replaces.
- **Shell-neutral error text**: read-only/strict/spawn errors say “bash”, not
  “Git Bash”, because the same path serves MSYS2 and Cygwin.

### Changed

- **Single-source constants**: `MSYSTEMS`, `MSYSTEM_SETTINGS`, `FLAVOR_LABELS`
  and `stripMatchingQuotes` now live only in `src/shared/protocol.ts`; the host
  discovery/config and the client row/store reference them. The MSYS2
  environment order and the YAML quote handling can no longer drift between
  host and browser.
- **Dead code removed** (`renderJobRead`, `outcomeDetail`, `isForeground`,
  `approvalOf`, a host-side `profileLabel`) and the approval ingredients are
  built by the shared `approvalFor` helper.
- **Docs corrected**: the fail-closed behavior when `sandboxPolicy` is missing,
  the escalation advertisement conditions, the synthetic timeout text
  (`[exit status unavailable]`), the Git/`msystem` mismatch rule, the full
  MSYS2 preference order, and the integration-test scope (real SIGTERM/SIGKILL,
  outside-workspace write, optional gcc; job mocks are unit tests).

### Tests

- 90 tests (up from 82): missing-`sandboxPolicy` replacement/capability,
  read-only escalation, foreground-with-jobs settlement, Cygwin environment
  tombstones, absolute `bashPath`, real SIGKILL, outside-workspace write and
  the optional MSYS2 toolchain check.
- Live audit on DSH `0.2.2-rc.1` (independent profile): 31/31 API/scenario
  checks (Git/MSYS2, promote, background + `job_output`, signal, relative
  workdir, subagent) and 15/15 settings-page checks (clean load, MSYS2 switch,
  strict round-trip, advanced diagnostics, no console/network errors). Strict
  refusal was also exercised from a real session. See `docs/SMOKE.md`.
- The published npm artifact (`@riverzh/dsh-gitbash@0.2.4`, the `latest` tag) was
  installed into a clean profile and exercised once: `/state` reported a
  supported Git deployment and the model ran a real `bash` call (`NPM_024_OK`,
  `MSYSTEM=MINGW64`).

### Not covered

- The Windows ACL sandbox experiment (“MSYS2 under the restricted token”) was
  not re-run on 0.2.2; the source-level review in `docs/DESIGN.md` §2.1 stands.
- `read-only` and the escalation approval dialog remain unit-covered rather
  than clicked through the real UI.

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
