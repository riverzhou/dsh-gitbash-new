# Changelog

All notable changes to this project are documented here. One version per
entry; the Git history is the evidence.

## 0.1.0 — 2026-10-18

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
  approval routing, and the compat-mode security model (see README).
- Settings row (`settings.general.item`): compact default view with a Shell
  selector fed by cached profiles (Auto / Git / MSYS2 environments), a
  compatibility switch, a one-line safety warning, and a folded
  "Advanced & diagnostics" section for manual path/test/environment/status.
  `/api/dsh-gitbash/{state,discover,validate}` routes.
- Git `binash.exe` is canonicalized to `usrinash.exe`; the launcher
  would otherwise reset `MSYSTEM` to the installation's UCRT64 and override the
  requested environment.
- Real-machine verification (DSH 0.2.1-rc.2): Git and MSYS2 each exercised
  through direct bash, background jobs (`job/registered`/`job/settled`,
  `job_output`) and subagents (child bash + report), plus the Web UI settings
  switch and background/subagent cards. Screenshots in `docs/images/`.
- Diagnostics at `%TEMP%\dsh-gitbash.log`; unit, executor, replacement, tool
  and real Git/MSYS2 integration tests; `selftest` and `compatcheck` scripts.

### Security

- Documented and enforced the Windows sandbox/MSYS2 incompatibility: bash is
  never silently confined. `compat: auto` runs bash unconfined under
  `workspace-write` with a result note; `read-only` refuses; `strict` allows
  only `danger-full-access`.
