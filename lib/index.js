// src/host/settings.ts
import z from "@deepseek-ai/schemastery";

// src/shared/protocol.ts
var SETTINGS_NAMESPACE = "dsh-gitbash";
var ROUTE_STATE = "/api/dsh-gitbash/state";
var ROUTE_DISCOVER = "/api/dsh-gitbash/discover";
var ROUTE_VALIDATE = "/api/dsh-gitbash/validate";
var FLAVOR_LABELS = {
  git: "Git for Windows",
  msys2: "MSYS2",
  cygwin: "Cygwin"
};
var MSYSTEMS = ["UCRT64", "MINGW64", "CLANG64", "CLANGARM64", "MINGW32", "MSYS"];
var MSYSTEM_SETTINGS = ["auto", ...MSYSTEMS];
function stripMatchingQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (first === '"' && last === '"' || first === "'" && last === "'") return trimmed.slice(1, -1).trim();
  return trimmed;
}

// src/host/settings.ts
var COMPAT_MODES = ["auto", "strict"];
var SETTINGS_DEFAULTS = {
  bashPath: "",
  msystem: "auto",
  compat: "auto"
};
var Config = z.object({
  /** Empty means "auto-discover the best profile". */
  bashPath: z.string().default(SETTINGS_DEFAULTS.bashPath).volatile(),
  /** Only meaningful for MSYS2; Git for Windows always runs MINGW64. */
  msystem: z.union(MSYSTEM_SETTINGS).default(SETTINGS_DEFAULTS.msystem).volatile(),
  /** `auto`: workspace-write sessions run bash unconfined; `strict`: refuse. */
  compat: z.union(COMPAT_MODES).default(SETTINGS_DEFAULTS.compat).volatile()
});
function normalizeBashPath(value) {
  return stripMatchingQuotes(value);
}
function readField(value, fallback) {
  try {
    if (value !== null && typeof value === "object" && typeof value.get === "function") {
      const current = value.get();
      return current === void 0 || current === null ? fallback : current;
    }
    return value === void 0 || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}
function resolveSettings(input) {
  const record = typeof input === "object" && input !== null ? input : {};
  const rawPath = record.bashPath;
  const rawMsystem = record.msystem;
  const rawCompat = record.compat;
  return {
    bashPath: typeof rawPath === "string" ? normalizeBashPath(rawPath) : SETTINGS_DEFAULTS.bashPath,
    msystem: typeof rawMsystem === "string" && MSYSTEM_SETTINGS.includes(rawMsystem) ? rawMsystem : SETTINGS_DEFAULTS.msystem,
    // An unknown non-empty mode is a typo/old value: keep the safer `strict`
    // rather than silently weakening an intended strict deployment to auto.
    compat: typeof rawCompat === "string" ? COMPAT_MODES.includes(rawCompat) ? rawCompat : rawCompat.trim().length > 0 ? "strict" : SETTINGS_DEFAULTS.compat : SETTINGS_DEFAULTS.compat
  };
}
function readSettings(config) {
  if (typeof config !== "object" || config === null) return { ...SETTINGS_DEFAULTS };
  const record = config;
  return resolveSettings({
    bashPath: readField(record.bashPath, SETTINGS_DEFAULTS.bashPath),
    msystem: readField(record.msystem, SETTINGS_DEFAULTS.msystem),
    compat: readField(record.compat, SETTINGS_DEFAULTS.compat)
  });
}

// src/host/discover.ts
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { basename, normalize } from "node:path";
var MSYS2_ENVIRONMENTS = MSYSTEMS.map((msystem) => ({
  msystem,
  dir: msystem === "MSYS" ? "" : msystem.toLowerCase()
}));
function normalizePathKey(path) {
  return normalize(path).replaceAll("/", "\\").toLowerCase();
}
function isBashFilename(path) {
  const name = basename(path).toLowerCase();
  return name === "bash" || name === "bash.exe";
}
function isBlockedBash(path) {
  const key = normalizePathKey(path);
  if (key.startsWith("\\\\wsl$\\") || key.startsWith("\\\\wsl.localhost\\")) return true;
  if (key.includes("\\windows\\system32\\bash.exe")) return true;
  if (key.includes("\\windows\\sysnative\\bash.exe")) return true;
  if (key.includes("\\windowsapps\\")) return true;
  if (key.endsWith("\\wsl.exe")) return true;
  return false;
}
function isWindowsAbsolutePath(path) {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\");
}
function isFile(path) {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}
function isDirectory(path) {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function winDirname(path) {
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return index <= 0 ? path : path.slice(0, index);
}
function winJoin(base, ...parts) {
  let out = base.replace(/[\\/]+$/, "");
  for (const part of parts) out = `${out}\\${part.replace(/^[\\/]+/, "")}`;
  return out;
}
function deriveRootFromBash(path) {
  const key = normalizePathKey(path);
  if (key.endsWith("\\usr\\bin\\bash.exe")) return winDirname(winDirname(winDirname(path)));
  for (const env of MSYS2_ENVIRONMENTS) {
    if (env.dir !== "" && key.endsWith(`\\${env.dir}\\bin\\bash.exe`)) {
      return winDirname(winDirname(winDirname(path)));
    }
  }
  if (key.endsWith("\\bin\\bash.exe")) return winDirname(winDirname(path));
  return void 0;
}
function deriveRootFromGit(path) {
  const key = normalizePathKey(path);
  if (key.endsWith("\\usr\\bin\\git.exe")) return winDirname(winDirname(winDirname(path)));
  for (const env of MSYS2_ENVIRONMENTS) {
    if (env.dir !== "" && key.endsWith(`\\${env.dir}\\bin\\git.exe`)) {
      return winDirname(winDirname(winDirname(path)));
    }
  }
  if (key.endsWith("\\cmd\\git.exe")) return winDirname(winDirname(path));
  if (key.endsWith("\\bin\\git.exe")) return winDirname(winDirname(path));
  return void 0;
}
function detectFlavor(root) {
  if (isFile(winJoin(root, "msys2.exe")) || isFile(winJoin(root, "usr", "bin", "pacman.exe")) || isFile(winJoin(root, "etc", "msys2-release"))) {
    return "msys2";
  }
  if (isFile(winJoin(root, "bin", "cygwin1.dll")) || isFile(winJoin(root, "etc", "setup"))) {
    return "cygwin";
  }
  if (isFile(winJoin(root, "cmd", "git.exe")) || isFile(winJoin(root, "mingw64", "bin", "git.exe"))) {
    return "git";
  }
  const name = basename(root).toLowerCase();
  if (name.includes("msys")) return "msys2";
  if (name.includes("cygwin")) return "cygwin";
  return "git";
}
function environmentRootFor(root, msystem) {
  const env = MSYS2_ENVIRONMENTS.find((entry) => entry.msystem === msystem);
  if (env === void 0) return void 0;
  return env.dir === "" ? winJoin(root, "usr") : winJoin(root, env.dir);
}
function defaultMsystemFor(root) {
  for (const env of MSYS2_ENVIRONMENTS) {
    if (env.dir === "") return "MSYS";
    if (isDirectory(winJoin(root, env.dir, "bin"))) return env.msystem;
  }
  return "MSYS";
}
function bashPathFor(root) {
  const usr = winJoin(root, "usr", "bin", "bash.exe");
  if (isFile(usr)) return usr;
  const bin = winJoin(root, "bin", "bash.exe");
  if (isFile(bin)) return bin;
  return void 0;
}
function parseBashVersion(output) {
  const match = /GNU bash,\s*version\s+([^\s(]+)/i.exec(output);
  return match?.[1];
}
function probeBashVersion(path, timeoutMs = 2e3) {
  try {
    const result = spawnSync(path, ["--version"], {
      timeout: timeoutMs,
      windowsHide: true,
      encoding: "utf8",
      // Discovery may execute an executable found on PATH. Do not hand it the
      // host's environment (credentials, tokens); `bash --version` needs none.
      env: {}
    });
    if (result.error !== void 0 && result.error !== null) {
      return { problem: result.error.message };
    }
    if (result.status !== 0) {
      return { problem: (result.stderr || result.stdout || `exit ${String(result.status)}`).trim().slice(0, 300) };
    }
    const version = parseBashVersion(result.stdout ?? "");
    return version === void 0 ? { problem: "not a GNU bash build" } : { version };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
}
function makeProfile(flavor, root, path, msystem, probe) {
  const id = `${flavor}|${normalizePathKey(root)}|${msystem ?? ""}`;
  const label = flavor === "msys2" ? `${FLAVOR_LABELS.msys2} ${msystem ?? "MSYS"}` : FLAVOR_LABELS[flavor];
  let problem;
  if (isBlockedBash(path)) problem = "WSL bash is not supported";
  else if (!isBashFilename(path)) problem = "not a bash executable";
  else if (!isFile(path)) problem = "bash.exe does not exist";
  if (problem === void 0 && flavor === "msys2") {
    const envRoot = msystem === void 0 ? void 0 : environmentRootFor(root, msystem);
    if (envRoot === void 0 || !isDirectory(winJoin(envRoot, "bin"))) {
      problem = `MSYS2 environment ${msystem ?? "(unknown)"} is not installed (${envRoot ?? "unknown root"})`;
    }
  }
  let version;
  if (problem === void 0 && probe) {
    const result = probeBashVersion(path);
    if (result.problem !== void 0) problem = result.problem;
    else version = result.version;
  }
  const environmentRoot = flavor === "msys2" && msystem !== void 0 ? environmentRootFor(root, msystem) : void 0;
  return {
    id,
    flavor,
    path,
    root,
    ...msystem !== void 0 ? { msystem } : {},
    ...environmentRoot !== void 0 ? { environmentRoot } : {},
    label,
    ...version !== void 0 ? { version } : {},
    valid: problem === void 0,
    ...problem !== void 0 ? { problem } : {}
  };
}
function profilesForRoot(root, probe = false) {
  if (!isDirectory(root)) return [];
  const flavor = detectFlavor(root);
  const bash = bashPathFor(root);
  if (bash === void 0) return [];
  if (flavor === "git") {
    return [makeProfile("git", root, bash, "MINGW64", probe)];
  }
  if (flavor === "cygwin") {
    return [makeProfile("cygwin", root, bash, void 0, probe)];
  }
  const profiles = [];
  for (const env of MSYS2_ENVIRONMENTS) {
    if (env.dir !== "" && !isDirectory(winJoin(root, env.dir, "bin"))) continue;
    profiles.push(makeProfile("msys2", root, bash, env.msystem, probe));
  }
  return profiles;
}
function canonicalGitBash(path, root) {
  if (!normalizePathKey(path).endsWith("\\bin\\bash.exe")) return path;
  const usr = winJoin(root, "usr", "bin", "bash.exe");
  return isFile(usr) ? usr : path;
}
function profileFromPath(path, msystem, probe = false) {
  const trimmed = stripMatchingQuotes(path);
  if (trimmed.length === 0) return { problem: "bashPath is empty" };
  if (isBlockedBash(trimmed)) return { problem: "WSL bash is not supported" };
  if (!isBashFilename(trimmed)) return { problem: "path must point to bash.exe" };
  if (!isWindowsAbsolutePath(trimmed)) return { problem: `bashPath must be an absolute path: ${trimmed}` };
  if (!isFile(trimmed)) return { problem: `bash.exe does not exist: ${trimmed}` };
  const root = deriveRootFromBash(trimmed);
  if (root === void 0) {
    return { problem: `cannot derive the install root from ${trimmed}; expected <root>\\bin\\bash.exe or <root>\\usr\\bin\\bash.exe` };
  }
  const flavor = detectFlavor(root);
  if (flavor === "git") {
    if (msystem !== "auto" && msystem !== "MINGW64") {
      return { problem: `Git for Windows only supports MSYSTEM=MINGW64, got ${msystem}` };
    }
    return { profile: makeProfile("git", root, canonicalGitBash(trimmed, root), "MINGW64", probe) };
  }
  if (flavor === "cygwin") {
    if (msystem !== "auto") {
      return { problem: `Cygwin does not use MSYSTEM; set msystem to auto, got ${msystem}` };
    }
    return { profile: makeProfile("cygwin", root, trimmed, void 0, probe) };
  }
  const selected = msystem === "auto" ? defaultMsystemFor(root) : msystem;
  const envRoot = environmentRootFor(root, selected);
  if (envRoot === void 0 || !isDirectory(winJoin(envRoot, "bin"))) {
    return { problem: `MSYS2 environment ${selected} is not installed under ${root}` };
  }
  return { profile: makeProfile("msys2", root, trimmed, selected, probe) };
}
function wherePaths(name) {
  try {
    const result = spawnSync("where.exe", [name], { timeout: 2e3, windowsHide: true, encoding: "utf8" });
    if (result.status !== 0 || typeof result.stdout !== "string") return [];
    return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^[a-zA-Z]:\\/.test(line));
  } catch {
    return [];
  }
}
function registryGitRoots() {
  const roots = [];
  for (const key of ["HKLM\\SOFTWARE\\GitForWindows", "HKCU\\SOFTWARE\\GitForWindows"]) {
    try {
      const result = spawnSync("reg.exe", ["query", key, "/v", "InstallPath"], {
        timeout: 2e3,
        windowsHide: true,
        encoding: "utf8"
      });
      if (result.status !== 0 || typeof result.stdout !== "string") continue;
      const match = /InstallPath\s+REG_SZ\s+(.+)/i.exec(result.stdout);
      const value = match?.[1]?.trim();
      if (value !== void 0 && value.length > 0) roots.push(value);
    } catch {
    }
  }
  return roots;
}
function knownRoots(env) {
  const roots = [];
  const programFiles = env.ProgramFiles ?? env.PROGRAMFILES;
  const programFilesX86 = env["ProgramFiles(x86)"] ?? env["PROGRAMFILES(X86)"];
  const localAppData = env.LOCALAPPDATA;
  const systemDrive = env.SystemDrive ?? "C:";
  if (programFiles !== void 0) {
    roots.push(winJoin(programFiles, "Git"));
    roots.push(winJoin(programFiles, "Git for Windows"));
  }
  if (programFilesX86 !== void 0) roots.push(winJoin(programFilesX86, "Git"));
  if (localAppData !== void 0) {
    roots.push(winJoin(localAppData, "Programs", "Git"));
    roots.push(winJoin(localAppData, "msys64"));
  }
  roots.push(
    "C:\\Git",
    "D:\\Git",
    "C:\\msys64",
    "D:\\msys64",
    "C:\\msys32",
    "C:\\cygwin64",
    "C:\\cygwin",
    winJoin(systemDrive, "msys64")
  );
  return roots;
}
function rootsFromPath(env) {
  const roots = [];
  const path = env.PATH ?? env.Path ?? "";
  for (const entry of path.split(";")) {
    const dir = entry.trim().replace(/^"|"$/g, "");
    if (dir.length === 0) continue;
    if (isFile(winJoin(dir, "bash.exe"))) {
      const root = deriveRootFromBash(winJoin(dir, "bash.exe"));
      if (root !== void 0) roots.push(root);
    }
    if (isFile(winJoin(dir, "git.exe"))) {
      const root = deriveRootFromGit(winJoin(dir, "git.exe"));
      if (root !== void 0) roots.push(root);
    }
  }
  return roots;
}
function uniqueRoots(roots) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const root of roots) {
    const trimmed = root.trim().replace(/^"|"$/g, "");
    if (trimmed.length === 0) continue;
    const key = normalizePathKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
function compareProfiles(a, b) {
  const rank = (profile) => {
    if (profile.flavor === "git") return 0;
    if (profile.flavor === "msys2") return 1 + MSYS2_ENVIRONMENTS.findIndex((env) => env.msystem === profile.msystem) / 100;
    return 2;
  };
  const byKind = rank(a) - rank(b);
  if (byKind !== 0) return byKind;
  if (a.valid !== b.valid) return a.valid ? -1 : 1;
  return a.path.localeCompare(b.path);
}
function discoverBash(options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    return { candidates: [], notes: [`bash discovery is Windows-only (platform: ${platform})`] };
  }
  const env = options.env ?? process.env;
  const probe = options.probe ?? false;
  const full = options.full ?? true;
  const notes = [];
  const roots = [];
  if (options.savedPath !== void 0 && options.savedPath.trim().length > 0) {
    const root = deriveRootFromBash(stripMatchingQuotes(options.savedPath));
    if (root !== void 0) roots.push(root);
  }
  if (full) {
    roots.push(...registryGitRoots());
    for (const path of wherePaths("git")) {
      const root = deriveRootFromGit(path);
      if (root !== void 0) roots.push(root);
    }
    for (const path of wherePaths("bash")) {
      const root = deriveRootFromBash(path);
      if (root !== void 0) roots.push(root);
    }
  }
  roots.push(...knownRoots(env), ...rootsFromPath(env));
  const byId = /* @__PURE__ */ new Map();
  for (const root of uniqueRoots(roots)) {
    for (const profile of profilesForRoot(root, probe)) {
      const existing = byId.get(profile.id);
      if (existing === void 0) {
        byId.set(profile.id, profile);
      } else if (existing.version === void 0 && profile.version !== void 0) {
        byId.set(profile.id, { ...existing, version: profile.version, valid: profile.valid, ...profile.problem !== void 0 ? { problem: profile.problem } : {} });
      }
    }
  }
  const candidates = [...byId.values()].sort(compareProfiles);
  if (candidates.length === 0) {
    notes.push("no Git for Windows / MSYS2 / Cygwin installation was found");
  } else if (!candidates.some((profile) => profile.valid)) {
    notes.push("installations were found but none is usable; check the path and MSYS2 environment");
  }
  const recommended = candidates.find((profile) => profile.valid);
  return { candidates, ...recommended !== void 0 ? { recommended } : {}, notes };
}
function createDiscoveryCache(initial) {
  let current = initial;
  return {
    get() {
      current ??= discoverBash({ full: true });
      return current;
    },
    refresh(options = {}) {
      current = discoverBash({ full: true, probe: true, ...options });
      return current;
    }
  };
}
function resolveEffectiveProfile(settings, cache, probe = false) {
  if (settings.bashPath.length > 0) {
    return profileFromPath(settings.bashPath, settings.msystem, probe);
  }
  const discovered = cache.get();
  if (discovered.recommended === void 0) {
    return { problem: discovered.notes[0] ?? "no usable Git Bash / MSYS2 installation found" };
  }
  return { profile: discovered.recommended };
}

// src/host/env.ts
import { existsSync as existsSync2, statSync as statSync2 } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { normalize as normalize2, resolve, sep } from "node:path";
var BashPathError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BashPathError";
  }
};
var ENV_OVERRIDES = {
  NO_COLOR: "1",
  TERM: "dumb",
  PAGER: "cat",
  GIT_PAGER: "cat",
  CHERE_INVOKING: "1"
};
function profilePathEntries(profile) {
  if (profile.flavor === "git") {
    const entries2 = [join(profile.root, "bin"), join(profile.root, "usr", "bin")];
    for (const env of ["ucrt64", "mingw64", "mingw32"]) {
      const dir = join(profile.root, env, "bin");
      if (existsSync2(dir)) entries2.push(dir);
    }
    return entries2;
  }
  if (profile.flavor === "cygwin") {
    return [join(profile.root, "bin")];
  }
  const entries = [];
  if (profile.environmentRoot !== void 0) entries.push(join(profile.environmentRoot, "bin"));
  entries.push(join(profile.root, "usr", "bin"));
  entries.push(join(profile.root, "usr", "local", "bin"));
  return entries;
}
function join(base, ...parts) {
  return normalize2([base.replace(/[\\/]+$/, ""), ...parts].join(sep));
}
function pathKey(path) {
  return normalize2(path).replaceAll("/", "\\").toLowerCase();
}
function underRoot(entry, root) {
  const key = pathKey(entry);
  const base = pathKey(root);
  return key === base || key.startsWith(`${base}\\`);
}
function composePath(profile, inherited, foreignRoots = []) {
  const selected = new Set(profilePathEntries(profile).map(pathKey));
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const push = (entry) => {
    const trimmed = stripMatchingQuotes(entry);
    if (trimmed.length === 0) return;
    const key = pathKey(trimmed);
    if (seen.has(key)) return;
    if (foreignRoots.some((root) => underRoot(trimmed, root))) return;
    const underSelected = underRoot(trimmed, profile.root);
    const msysRoot = !underSelected && (key.includes("\\msys64\\") || key.includes("\\msys32\\") || key.includes("\\cygwin\\") || key.includes("\\cygwin64\\") || key.includes("\\cygwin32\\") || key.endsWith("\\cygwin") || key.endsWith("\\cygwin64") || key.endsWith("\\cygwin32"));
    if (profile.flavor === "git" && msysRoot) return;
    if (profile.flavor === "msys2" && key.includes("\\program files\\git\\")) return;
    if (profile.flavor === "cygwin" && (msysRoot || key.includes("\\program files\\git\\"))) return;
    if (profile.flavor === "msys2" && underRoot(trimmed, profile.root) && ![...selected].some((prefix) => key === prefix)) return;
    seen.add(key);
    out.push(trimmed);
  };
  for (const entry of profilePathEntries(profile)) push(entry);
  for (const entry of (inherited ?? "").split(";")) push(entry);
  return out.join(";");
}
function composeEnv(profile, inherited, dshEnv, foreignRoots = []) {
  const env = {
    ...ENV_OVERRIDES,
    PWD: void 0,
    OLDPWD: void 0,
    MSYSTEM: void 0,
    MSYS2_PATH_TYPE: void 0
  };
  if (profile.flavor === "git") {
    env.MSYSTEM = "MINGW64";
  } else if (profile.flavor === "msys2") {
    if (profile.msystem === void 0) {
      throw new BashPathError("MSYS2 profile is missing its environment (UCRT64 / MINGW64 / \u2026)");
    }
    env.MSYSTEM = profile.msystem;
    env.MSYS2_PATH_TYPE = "inherit";
  }
  env.PATH = composePath(profile, inherited.PATH ?? inherited.Path, foreignRoots);
  return { ...env, ...dshEnv };
}
function posixToWindows(input) {
  if (input === "/tmp" || input.startsWith("/tmp/")) {
    return resolve(tmpdir(), input.slice("/tmp/".length).replaceAll("/", sep));
  }
  if (input === "~" || input.startsWith("~/")) {
    return resolve(homedir(), input.slice(2).replaceAll("/", sep));
  }
  const cygdrive = /^\/cygdrive\/([a-zA-Z])(\/.*)?$/.exec(input);
  if (cygdrive?.[1] !== void 0) {
    return `${cygdrive[1].toUpperCase()}:${(cygdrive[2] ?? "\\").replaceAll("/", sep)}`;
  }
  const drive = /^\/([a-zA-Z])(\/.*)?$/.exec(input);
  if (drive?.[1] !== void 0) {
    return `${drive[1].toUpperCase()}:${(drive[2] ?? "\\").replaceAll("/", sep)}`;
  }
  return input;
}
function isWindowsAbsolute(path) {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\");
}
function isPosixAbsolute(path) {
  return path.startsWith("/");
}
function resolveWorkdir(requested, sessionCwd) {
  if (requested === void 0 || requested.trim().length === 0) {
    const base = sessionCwd !== void 0 && sessionCwd.length > 0 ? sessionCwd : process.cwd();
    return assertDirectory(base);
  }
  const value = stripMatchingQuotes(requested);
  if (/^[a-zA-Z]:/.test(value) && !isWindowsAbsolute(value)) {
    throw new BashPathError(
      `workdir ${JSON.stringify(value)} is drive-relative; use an absolute path such as C:\\... or a path relative to the session cwd`
    );
  }
  let windows;
  if (isWindowsAbsolute(value)) {
    windows = value;
  } else if (isPosixAbsolute(value)) {
    const converted = posixToWindows(value);
    if (!isWindowsAbsolute(converted)) {
      throw new BashPathError(
        `workdir ${JSON.stringify(value)} is an absolute POSIX path without a drive mapping; use a Windows path (C:\\...) or a path under /c, /d, /tmp, or ~`
      );
    }
    windows = converted;
  } else {
    const base = sessionCwd !== void 0 && sessionCwd.length > 0 ? sessionCwd : process.cwd();
    windows = resolve(base, value);
  }
  return assertDirectory(windows);
}
function assertDirectory(path) {
  const absolute = normalize2(path);
  try {
    if (!existsSync2(absolute)) {
      throw new BashPathError(`workdir does not exist: ${absolute}`);
    }
    if (!statSync2(absolute).isDirectory()) {
      throw new BashPathError(`workdir is not a directory: ${absolute}`);
    }
  } catch (error) {
    if (error instanceof BashPathError) throw error;
    throw new BashPathError(`workdir is not accessible: ${absolute}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return absolute;
}

// src/host/escalation.ts
var ESCALATION_TARGETS = ["workspace-write", "danger-full-access"];
var WIDER_MODES = {
  "read-only": ["workspace-write", "danger-full-access"],
  "workspace-write": ["danger-full-access"]
};
function validateEscalationArgs(sandboxPermissions, justification) {
  if (sandboxPermissions !== void 0 && justification === void 0) {
    throw new Error("invalid escalation: sandbox_permissions requires a justification");
  }
  if (justification !== void 0 && sandboxPermissions === void 0) {
    throw new Error("invalid escalation: justification is only valid together with sandbox_permissions");
  }
  if (justification !== void 0 && justification.trim().length === 0) {
    throw new Error("invalid justification: expected a non-empty sentence");
  }
}
function sandboxDenialMarker(mode) {
  return `[sandbox: file access denied under ${mode} mode]`;
}
function escalationHintMarker(subject) {
  return `[sandbox: escalation available \u2014 retry this exact ${subject} once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]`;
}
function sandboxPermissionsDescription(subject) {
  return `The narrowest wider sandbox mode for a one-shot retry of the exact ${subject} the sandbox just denied; the retry asks the user for approval.`;
}
function escalationDisplayReason(mode, justification) {
  return {
    en: `Allow this operation with ${mode} permissions: ${justification}`,
    zh: `\u5141\u8BB8\u672C\u6B21\u64CD\u4F5C\u4F7F\u7528 ${mode} \u6743\u9650\uFF1A${justification}`,
    ja: `${mode} \u6A29\u9650\u3067\u3053\u306E\u64CD\u4F5C\u3092\u8A31\u53EF\u3057\u307E\u3059\uFF1A${justification}`,
    es: `Permitir esta operaci\xF3n con permisos ${mode}: ${justification}`,
    fr: `Autoriser cette op\xE9ration avec les permissions ${mode} : ${justification}`,
    de: `Diesen Vorgang mit ${mode}-Berechtigungen zulassen: ${justification}`,
    ru: `\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044C \u044D\u0442\u0443 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044E \u0441 \u043F\u0440\u0430\u0432\u0430\u043C\u0438 ${mode}: ${justification}`,
    pt: `Permitir esta opera\xE7\xE3o com permiss\xF5es ${mode}: ${justification}`
  };
}
async function approveEscalation(request, approval) {
  const { requestedMode: mode, effectiveMode, justification, subject } = request;
  if (mode === effectiveMode) return effectiveMode;
  if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode)) {
    throw new Error(`sandbox escalation to "${mode}" is not strictly wider than this call's current "${effectiveMode}" mode`);
  }
  if (approval.approver === void 0) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`);
  }
  if (approval.agent === void 0) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but the call has no agent to route it through`);
  }
  const outcome = await approval.approver.request({
    agent: approval.agent,
    toolName: approval.toolName,
    callId: approval.callId,
    reason: `escalate sandbox to ${mode}: ${justification}`,
    displayReason: escalationDisplayReason(mode, justification),
    ...approval.signal !== void 0 ? { signal: approval.signal } : {}
  });
  switch (outcome) {
    case "allowed-once":
      return mode;
    case "rejected":
      throw new Error(`the user rejected escalating this ${subject} to "${mode}"; it stays denied, so stop and explain instead of working around it`);
    case "cancelled":
      throw new Error(`approval for escalating to "${mode}" was cancelled`);
    case "unavailable":
      throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`);
    default:
      throw new Error(`unknown approval outcome: ${String(outcome)}`);
  }
}
function approvalFor(exec, approver) {
  return {
    approver,
    agent: exec.agent,
    callId: exec.callId,
    toolName: "bash",
    signal: exec.signal
  };
}

// src/host/executor.ts
import { constants } from "node:os";

// src/host/render.ts
function streamText(output) {
  if (!output.truncated) return output.text;
  return `${output.text}
[output truncated; full output: ${output.spillPath ?? "(unavailable)"}]`;
}
function compatNote(value) {
  if (value.compat !== true) return void 0;
  return `[compat: bash runs outside the DSH file sandbox (session mode ${value.sessionMode ?? "workspace-write"})]`;
}
function parseExitStatus(text) {
  const signal = /\n\[killed by signal: ([^\]\n]+)\]$/.exec(text);
  if (signal?.[1] !== void 0) return { body: text.slice(0, signal.index), signal: signal[1] };
  const exit = /\n\[exit code: (\d+)\]$/.exec(text);
  if (exit?.[1] !== void 0) return { body: text.slice(0, exit.index), exitCode: Number(exit[1]) };
  const unavailable = /\n\[exit status unavailable\]$/.exec(text);
  if (unavailable !== null) return { body: text.slice(0, unavailable.index), unavailable: true };
  return { body: text, exitCode: 0 };
}
function renderResult(result) {
  const out = streamText(result.stdout);
  const err = streamText(result.stderr);
  let body = out;
  if (err.length > 0) {
    if (body.length > 0 && !body.endsWith("\n")) body += "\n";
    body += `[stderr]
${err}`;
  }
  if (body.length === 0) body = "(no output)";
  const notes = [];
  const compat = compatNote(result);
  if (compat !== void 0) notes.push(compat);
  if (result.timedOut) notes.push(`[timed out after ${result.timeoutMs}ms]`);
  if (result.stopped !== void 0) notes.push(`[stopped: ${result.stopped}]`);
  if (result.signal !== null) notes.push(`[killed by signal: ${result.signal}]`);
  else if (result.exitCode === null) notes.push("[exit status unavailable]");
  else if (result.exitCode !== 0) notes.push(`[exit code: ${result.exitCode}]`);
  if (notes.length === 0) return body;
  if (!body.endsWith("\n")) body += "\n";
  return body + notes.join("\n");
}
function renderPromoted(promoted) {
  const body = promoted.output.length > 0 ? promoted.output.endsWith("\n") ? promoted.output : `${promoted.output}
` : "";
  const compat = compatNote(promoted);
  return `${body}${compat !== void 0 ? `${compat}
` : ""}[still running after ${promoted.timeoutMs}ms; moved to background job ${promoted.jobId}]`;
}
function ringDelta(chunks) {
  const out = chunks.filter((chunk) => chunk.channel !== "stderr").map((chunk) => chunk.text).join("");
  const err = chunks.filter((chunk) => chunk.channel === "stderr").map((chunk) => chunk.text).join("");
  const separator = out.length > 0 && !out.endsWith("\n") ? "\n" : "";
  return out + (err.length > 0 ? `${separator}[stderr]
${err}` : "");
}
function detectStartupFailure(stderr) {
  if (/\*\*\* fatal error\s*-/.test(stderr)) return firstLine(stderr);
  if (/couldn't create signal pipe/i.test(stderr)) return firstLine(stderr);
  if (/CreateFileMapping .*Win32 error 5/i.test(stderr)) return firstLine(stderr);
  return void 0;
}
function firstLine(text) {
  const line = text.split(/\r?\n/).map((item) => item.trim()).find((item) => item.length > 0);
  return line === void 0 ? void 0 : line.slice(0, 300);
}

// src/host/executor.ts
var BashSpawnError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BashSpawnError";
  }
};
var EXEC_DEFAULTS = {
  timeoutMs: 12e4,
  maxTimeoutMs: 6e5,
  stdoutMaxBytes: 64e3,
  maxSpillBytes: 64 * 1024 * 1024,
  graceMs: 3e3
};
function clampTimeout(requested) {
  if (requested === void 0) return EXEC_DEFAULTS.timeoutMs;
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(requested)}`);
  }
  return Math.min(requested, EXEC_DEFAULTS.maxTimeoutMs);
}
var SIGNAL_NAMES = (() => {
  const names = /* @__PURE__ */ new Map();
  for (const [name, number] of Object.entries(constants.signals)) {
    if (typeof number !== "number" || number <= 0 || number > 64 || names.has(number)) continue;
    names.set(number, name);
  }
  return names;
})();
function normalizeWindowsExit(exitCode, signal, platform = process.platform) {
  if (platform !== "win32" || signal !== null || exitCode === null || exitCode <= 255) {
    return { exitCode, signal };
  }
  if (exitCode % 256 !== 0) return { exitCode, signal };
  const name = SIGNAL_NAMES.get(exitCode >>> 8);
  return name === void 0 ? { exitCode, signal } : { exitCode: null, signal: name };
}
var EMPTY_READER = {
  readFrom: (from) => ({ text: "", nextOffset: from, lossy: false })
};
function createBashExecution(subprocess, profile, request) {
  if (request.signal?.aborted === true) {
    throw request.signal.reason instanceof Error ? request.signal.reason : new Error("tool call aborted");
  }
  const stdoutMaxBytes = request.stdoutMaxBytes ?? EXEC_DEFAULTS.stdoutMaxBytes;
  const maxSpillBytes = request.maxSpillBytes ?? EXEC_DEFAULTS.maxSpillBytes;
  const graceMs = request.graceMs ?? EXEC_DEFAULTS.graceMs;
  const controller = new AbortController();
  let handle;
  try {
    handle = subprocess.spawn({
      argv: [profile.path, "-c", request.command],
      cwd: request.cwd,
      stdio: {
        stdin: "ignore",
        stdout: { maxBytes: stdoutMaxBytes, spill: { maxBytes: maxSpillBytes } },
        stderr: { maxBytes: stdoutMaxBytes, spill: { maxBytes: maxSpillBytes } }
      },
      graceMs,
      signal: controller.signal,
      env: request.env
    });
  } catch (error) {
    throw new BashSpawnError(spawnMessage(profile, error));
  }
  let status = "running";
  let exitCode = null;
  let signal = null;
  let timedOut = false;
  let aborted = false;
  let externalKill = false;
  let finished = false;
  let startupFailure;
  let providerError;
  let stdoutOffset = 0;
  let stderrOffset = 0;
  let timer;
  const stdout = handle.collected.stdout ?? EMPTY_READER;
  const stderr = handle.collected.stderr ?? EMPTY_READER;
  const stop = () => {
    try {
      controller.abort();
    } catch {
    }
    try {
      handle.terminate();
    } catch {
    }
  };
  const onAbort = () => {
    if (finished) return;
    if (!timedOut) aborted = true;
    stop();
  };
  const onTimeout = () => {
    if (finished || aborted || externalKill) return;
    timedOut = true;
    stop();
  };
  if (request.signal !== void 0) {
    request.signal.addEventListener("abort", onAbort, { once: true });
  }
  if (request.onExpiry === "kill") {
    timer = setTimeout(onTimeout, request.timeoutMs);
    timer.unref?.();
  }
  const done = (async () => {
    try {
      const outcome = await handle.done;
      const normalized = normalizeWindowsExit(outcome.exitCode, outcome.signal);
      exitCode = normalized.exitCode;
      signal = normalized.signal;
      if ((exitCode === 0 || exitCode === null) && stdout.readFrom(0).text.length === 0) {
        const failure = detectStartupFailure(stderr.readFrom(0).text);
        if (failure !== void 0) {
          startupFailure = failure;
          exitCode = 1;
        }
      }
      if (timedOut || aborted || externalKill || signal !== null) status = "killed";
      else status = "completed";
    } catch (error) {
      if (!timedOut && !aborted && !externalKill) providerError = error;
      status = "killed";
    } finally {
      finished = true;
      if (timer !== void 0) clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }
  })();
  return {
    get status() {
      return status;
    },
    get exitCode() {
      return exitCode;
    },
    get signal() {
      return signal;
    },
    get startupFailure() {
      return startupFailure;
    },
    observed: { stdout, stderr },
    done,
    kill() {
      if (finished) return;
      externalKill = true;
      stop();
    },
    readOutput() {
      const out = stdout.readFrom(stdoutOffset);
      const err = stderr.readFrom(stderrOffset);
      stdoutOffset = out.nextOffset;
      stderrOffset = err.nextOffset;
      const separator = out.text.length > 0 && !out.text.endsWith("\n") ? "\n" : "";
      const delta = out.text + (err.text.length > 0 ? `${separator}[stderr]
${err.text}` : "");
      return {
        delta,
        lossy: out.lossy || err.lossy,
        ...out.spillPath !== void 0 ? { stdoutSpillPath: out.spillPath } : {},
        ...err.spillPath !== void 0 ? { stderrSpillPath: err.spillPath } : {}
      };
    },
    async result() {
      await done;
      if (providerError !== void 0) {
        throw new BashSpawnError(spawnMessage(profile, providerError));
      }
      const out = collect(stdout);
      let err = collect(stderr);
      if (startupFailure !== void 0) {
        err = { ...err, text: `${err.text}
[bash startup failed: ${startupFailure}]` };
      }
      const value = {
        kind: "foreground",
        cwd: request.cwd,
        exitCode,
        signal,
        timedOut,
        aborted,
        timeoutMs: request.timeoutMs,
        stdout: out,
        stderr: err
      };
      return value;
    }
  };
}
function collect(reader) {
  const read = reader.readFrom(0);
  return {
    text: read.text,
    truncated: read.lossy,
    ...read.spillPath !== void 0 ? { spillPath: read.spillPath } : {}
  };
}
function spawnMessage(profile, error) {
  const detail = error instanceof Error ? error.message : String(error);
  return `bash could not start (${profile.label} at ${profile.path}): ${detail}. Re-run "auto discover" in Settings \u2192 General \u2192 Terminal tool, or fix the path.`;
}

// src/host/jobs.ts
function processSources(proc) {
  const source = (channel) => ({
    channel,
    read: (fromByte) => {
      const live = proc();
      if (live === void 0) return { text: "", nextOffset: fromByte, lossy: false };
      return live.observed[channel].readFrom(fromByte);
    }
  });
  return [source("stdout"), source("stderr")];
}
function processOutcome(proc) {
  if (proc.startupFailure !== void 0) {
    return { status: "failed", detail: `bash startup failed: ${proc.startupFailure}` };
  }
  if (proc.status === "killed") {
    return { status: "killed", detail: proc.signal !== null ? `signal: ${proc.signal}` : "killed before exit" };
  }
  return {
    status: "completed",
    detail: proc.exitCode === null ? "exit status unavailable" : `exit code: ${proc.exitCode}`
  };
}
function processJob(start, outcome) {
  const controller = new AbortController();
  let process2;
  const done = (async () => {
    try {
      process2 = await start(controller.signal);
      try {
        if (controller.signal.aborted) process2.kill();
      } finally {
        await process2.done;
      }
      return outcome(process2);
    } catch (error) {
      return {
        status: controller.signal.aborted && process2 === void 0 ? "killed" : "failed",
        detail: error instanceof Error ? error.message : String(error)
      };
    }
  })();
  return {
    cancel: (reason) => {
      if (controller.signal.aborted) return;
      controller.abort(reason);
      process2?.kill();
    },
    done
  };
}

// src/host/bash-tool.ts
function toolAborted() {
  const error = new Error("tool call aborted");
  error.name = "AbortError";
  error.code = "ABORTED";
  return error;
}
function validateBashArgs(args, effectiveMode) {
  if (args.command.trim().length === 0) throw new Error("invalid command: expected a non-empty string");
  if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
  if (args.timeoutMs !== void 0 && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
    throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(args.timeoutMs)}`);
  }
  if (args.sandbox_permissions !== void 0 && args.sandbox_permissions === effectiveMode) return;
  const justification = args.sandbox_permissions === void 0 && args.justification?.trim() === "" ? void 0 : args.justification;
  validateEscalationArgs(args.sandbox_permissions, justification);
}
function parseArgs(raw) {
  const string = (key) => {
    const value = raw[key];
    if (value === void 0) return void 0;
    if (typeof value !== "string") throw new Error(`invalid ${key}: expected a string`);
    return value;
  };
  const description = string("description");
  const command = string("command");
  if (description === void 0) throw new Error("missing required argument: description");
  if (command === void 0) throw new Error("missing required argument: command");
  const timeout = raw.timeoutMs;
  if (timeout !== void 0 && typeof timeout !== "number") throw new Error("invalid timeoutMs: expected a number");
  const background = raw.run_in_background;
  if (background !== void 0 && typeof background !== "boolean") {
    throw new Error("invalid run_in_background: expected a boolean");
  }
  const workdir = string("workdir");
  const sandboxPermissions = string("sandbox_permissions");
  const justification = string("justification");
  return {
    command,
    description,
    ...timeout !== void 0 ? { timeoutMs: timeout } : {},
    ...workdir !== void 0 ? { workdir } : {},
    ...background !== void 0 ? { run_in_background: background } : {},
    ...sandboxPermissions !== void 0 ? { sandbox_permissions: sandboxPermissions } : {},
    ...justification !== void 0 ? { justification } : {}
  };
}
function bashDescription(runtime, background, promote, escalation) {
  const profile = runtime.profile;
  const features = [
    `Execute a bash command (\`bash -c\`) through ${profile.label} on Windows and return its stdout/stderr.`,
    "Each call runs in a fresh shell; pass `workdir` instead of using `cd`.",
    "Use POSIX paths (`/c/...`, `/d/...`) and `$VAR`; do not use PowerShell syntax or `C:\\` backslash paths.",
    "Managed `$DSH_*` variables expose current harness environment facts.",
    "Long output is truncated to its tail; the full output is saved to a file whose path is reported when available.",
    "Provide `description` before `command` in the arguments.",
    "Before any delete or move, verify that the resolved absolute target path is the intended one; never run it against a computed path you have not checked.",
    "An unset variable expands to an empty string, so guard variables in such paths with `${VAR:?}`."
  ];
  if (background) {
    features.push("Use `run_in_background` for long-running work; collect with job_output and stop with job_kill.");
  }
  if (promote) {
    features.push("When a foreground call reaches its timeout, the command moves to the background instead of being killed.");
  }
  if (escalation) {
    features.push("If the session policy blocks this command, retry once with `sandbox_permissions` (the narrowest wider mode) plus a one-sentence `justification`; the user is asked for approval.");
  }
  if (runtime.compat === "auto") {
    features.push("This deployment runs bash outside the DSH file sandbox when the session mode is workspace-write, because the MSYS2 runtime cannot start under the Windows restricted token. A trailing `[compat: ...]` line is a deployment notice, not command output. Treat paths outside the workspace as read-only unless the user explicitly asks otherwise.");
  } else {
    features.push("This deployment allows bash only under danger-full-access; under read-only/workspace-write the call is refused instead of silently widening permissions.");
  }
  return features.join(" ");
}
function bashParameters(background, promotion, escalation) {
  const properties = {
    description: {
      type: "string",
      description: 'Clear, concise description of what this command does in active voice, 5-10 words (shown in the UI). Examples: "ls" \u2192 "List files in current directory"; "git status" \u2192 "Show working tree status".'
    },
    command: { type: "string", description: "The bash command to execute." },
    timeoutMs: {
      type: "number",
      description: promotion ? "Timeout in milliseconds. The executor applies its configured default and cap; on expiry the command moves to the background as a job instead of being killed." : "Timeout in milliseconds. The executor applies its configured default and cap, and kills the command on expiry."
    },
    workdir: {
      type: "string",
      description: "Working directory for this command. Defaults to the session workspace; a relative path is resolved against it."
    }
  };
  if (background) {
    properties.run_in_background = {
      type: "boolean",
      description: "Run in the background and return a job id immediately (collect with job_output, stop with job_kill). No timeout applies."
    };
  }
  if (escalation.length > 0) {
    properties.sandbox_permissions = {
      type: "string",
      enum: [...escalation],
      description: sandboxPermissionsDescription("command")
    };
    properties.justification = {
      type: "string",
      description: "Required with sandbox_permissions: one sentence for the user explaining why this exact command needs the wider access. Use the language of the user\u2019s current request."
    };
  }
  return { type: "object", properties, required: ["command", "description"] };
}
function bashOutputSchema() {
  const compatProperties = {
    compat: { type: "boolean" },
    sessionMode: { type: "string" }
  };
  return {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "jobId", "cwd"],
        properties: {
          kind: { type: "string", const: "background" },
          jobId: { type: "string" },
          cwd: { type: "string" },
          ...compatProperties
        }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "cwd", "jobId", "timeoutMs", "output"],
        properties: {
          kind: { type: "string", const: "promoted" },
          cwd: { type: "string" },
          jobId: { type: "string" },
          timeoutMs: { type: "number" },
          output: { type: "string" },
          ...compatProperties
        }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "cwd", "exitCode", "signal", "timedOut", "aborted", "timeoutMs", "stdout", "stderr"],
        properties: {
          kind: { type: "string", const: "foreground" },
          cwd: { type: "string" },
          exitCode: { oneOf: [{ type: "integer" }, { type: "null" }] },
          signal: { oneOf: [{ type: "string" }, { type: "null" }] },
          timedOut: { type: "boolean" },
          aborted: { type: "boolean" },
          stopped: { type: "string" },
          timeoutMs: { type: "number" },
          stdout: {
            type: "object",
            additionalProperties: false,
            required: ["text", "truncated"],
            properties: {
              text: { type: "string" },
              truncated: { type: "boolean" },
              spillPath: { type: "string" }
            }
          },
          stderr: {
            type: "object",
            additionalProperties: false,
            required: ["text", "truncated"],
            properties: {
              text: { type: "string" },
              truncated: { type: "boolean" },
              spillPath: { type: "string" }
            }
          },
          sandbox: {
            type: "object",
            additionalProperties: false,
            required: ["mode", "denied"],
            properties: {
              mode: { type: "string" },
              denied: { type: "boolean" },
              enforcement: { type: "string" },
              runnerFailed: { type: "boolean" }
            }
          },
          ...compatProperties
        }
      }
    ]
  };
}
function presentCall(args) {
  const record = typeof args === "object" && args !== null ? args : {};
  const command = typeof record.command === "string" ? record.command : "";
  const description = typeof record.description === "string" ? record.description : "";
  if (record.run_in_background === true) {
    const view2 = {
      card: "generic",
      title: command,
      kind: "execute",
      rawInput: command,
      content: [{ type: "text", text: description }]
    };
    return view2;
  }
  const view = {
    card: "terminal",
    title: command,
    description,
    ...typeof record.workdir === "string" ? { cwd: record.workdir } : {}
  };
  return view;
}
function presentResult(args, result) {
  const block = result.content.length === 1 ? result.content[0] : void 0;
  if (block === void 0 || block.type !== "text") return void 0;
  const raw = block.text;
  const record = typeof args === "object" && args !== null ? args : {};
  const kind = result.value?.kind;
  const isBackground = record.run_in_background === true || kind === "background";
  const isPromoted = kind === "promoted" || /(?:^|\n)\[still running after \d+ms; moved to background job [^\]\n]+\]$/.test(raw);
  if (isBackground || isPromoted || result.isError === true) {
    const view2 = {
      card: "generic",
      content: [{ type: "text", text: `\`\`\`console
${raw.replace(/\n+$/, "")}
\`\`\`` }]
    };
    return view2;
  }
  const parsed = parseExitStatus(raw);
  const view = "signal" in parsed ? { card: "terminal", output: parsed.body, signal: parsed.signal } : "unavailable" in parsed ? { card: "terminal", output: parsed.body } : { card: "terminal", output: parsed.body, exitCode: parsed.exitCode };
  return view;
}
function createBashTool(runtime) {
  const backgroundEnabled = runtime.jobs !== void 0 && typeof runtime.jobs.start === "function";
  const promote = backgroundEnabled && typeof runtime.jobs?.wait === "function" && typeof runtime.jobs?.read === "function" && typeof runtime.jobs?.kill === "function" && typeof runtime.jobs?.remove === "function";
  const escalationModes = runtime.shell?.sandboxMode !== void 0 && runtime.sandboxPolicy !== void 0 ? ESCALATION_TARGETS : [];
  const description = bashDescription(runtime, backgroundEnabled, promote, escalationModes.length > 0);
  const parameters = bashParameters(backgroundEnabled, promote, escalationModes);
  const outputSchema = bashOutputSchema();
  const resolvePolicy = (exec) => {
    if (runtime.sandboxPolicy === void 0) {
      throw new Error(
        "sandbox policy service is unavailable; refusing to run bash without a known session mode (read-only / workspace-write / danger-full-access)"
      );
    }
    const resolved = runtime.sandboxPolicy.resolve(exec.agent !== void 0 ? { session: exec.agent.session } : {});
    const validModes = ["read-only", "workspace-write", "danger-full-access"];
    if (resolved === void 0 || resolved === null || !validModes.includes(resolved.mode)) {
      throw new Error(
        "sandbox policy is unavailable or invalid; refusing to run bash without a known session mode (read-only / workspace-write / danger-full-access)"
      );
    }
    return resolved;
  };
  const resolveCwd = async (exec) => {
    let cwd;
    if (exec.agent !== void 0 && runtime.workingDirectory !== void 0) {
      try {
        cwd = await runtime.workingDirectory.ensure(exec.agent, exec.signal);
      } catch (error) {
        if (exec.signal.aborted || error instanceof Error && error.name === "AbortError") throw toolAborted();
        cwd = void 0;
      }
    }
    if (cwd === void 0) cwd = exec.agent?.session.header?.cwd;
    return cwd ?? process.cwd();
  };
  const collectDshEnv = (exec) => {
    try {
      return runtime.shellEnv?.collect(exec) ?? {};
    } catch {
      return {};
    }
  };
  const startJob = (args, exec, env, cwd, timeoutMs) => {
    const registry = runtime.jobs;
    if (registry === void 0) throw new Error("background jobs unavailable: the job registry is not composed");
    let process2;
    let stopped;
    const owner = exec.agent?.id;
    const id = registry.start({
      kind: "bash",
      label: args.command,
      ...owner !== void 0 ? { owner } : {},
      toolCall: { callId: exec.callId, rootCallId: exec.rootCallId ?? exec.callId },
      output: processSources(() => process2),
      run: () => {
        const hooks = processJob(
          async (signal) => {
            process2 = createBashExecution(runtime.subprocess, runtime.profile, {
              command: args.command,
              cwd,
              env,
              onExpiry: "none",
              timeoutMs,
              signal
            });
            return process2;
          },
          processOutcome
        );
        return {
          done: hooks.done,
          cancel: (reason) => {
            stopped = reason;
            hooks.cancel(reason);
          }
        };
      }
    });
    return { id, process: () => process2, stopped: () => stopped };
  };
  const stopJob = async (registry, id, owner) => {
    try {
      registry.kill(id, owner, "tool call aborted");
    } catch {
    }
    try {
      const settled = await registry.wait(id, 1e4, owner);
      if (settled.status !== "running" && settled.status !== "stopping") {
        try {
          registry.remove(id, owner);
        } catch {
        }
      }
      return settled;
    } catch {
      return { id, kind: "bash", label: "", status: "killed", startedAt: Date.now(), output: { total: 0, earliest: 0 } };
    }
  };
  const waitOnJob = async (registry, attached, exec, timeoutMs, cwd, compat, sessionMode) => {
    const owner = exec.agent?.id;
    let view;
    try {
      view = await registry.wait(attached.id, timeoutMs, owner, exec.signal);
    } catch (error) {
      await stopJob(registry, attached.id, owner);
      if (exec.signal.aborted || error instanceof Error && error.name === "AbortError") throw toolAborted();
      throw error instanceof Error ? error : new Error(String(error));
    }
    if (view.status === "running" || view.status === "stopping") {
      if (attached.process() === void 0) {
        await stopJob(registry, attached.id, owner);
        const synthetic = {
          kind: "foreground",
          cwd,
          exitCode: null,
          signal: null,
          timedOut: true,
          aborted: false,
          timeoutMs,
          stdout: { text: "", truncated: false },
          stderr: { text: "", truncated: false },
          sandbox: { mode: "danger-full-access", denied: false },
          ...compat ? { compat: true, ...sessionMode !== void 0 ? { sessionMode } : {} } : {}
        };
        return synthetic;
      }
      let read;
      try {
        read = registry.read(attached.id, owner);
      } catch {
        read = { chunks: [], lossy: false, job: view };
      }
      const output = ringDelta(read.chunks);
      const lossy = read.lossy;
      const spill = read.job.output.spillPaths ?? [];
      const promoted = {
        kind: "promoted",
        cwd,
        jobId: attached.id,
        timeoutMs,
        output: lossy ? `${output}${output.length > 0 && !output.endsWith("\n") ? "\n" : ""}[some output was dropped from memory; full output: ${spill.length > 0 ? spill.join(", ") : "(unavailable)"}]` : output,
        ...compat ? { compat: true, ...sessionMode !== void 0 ? { sessionMode } : {} } : {}
      };
      return promoted;
    }
    try {
      registry.remove(attached.id, owner);
    } catch {
    }
    const process2 = attached.process();
    if (process2 === void 0) throw new Error(view.detail ?? "the bash job failed before its process was published");
    const result = await process2.result();
    const stopped = attached.stopped();
    return {
      ...result,
      sandbox: { mode: "danger-full-access", denied: false },
      ...stopped !== void 0 ? { stopped } : {},
      ...compat ? { compat: true, ...sessionMode !== void 0 ? { sessionMode } : {} } : {}
    };
  };
  return {
    name: "bash",
    description,
    parameters,
    output: {
      schema: outputSchema,
      render(_args, value) {
        const typed = value;
        const backgroundNote = typed.kind === "background" ? compatNote(typed) : void 0;
        const text = typed.kind === "background" ? `started background job ${typed.jobId}${backgroundNote !== void 0 ? `
${backgroundNote}` : ""}` : typed.kind === "promoted" ? renderPromoted(typed) : renderResult(typed);
        return [{ type: "text", text }];
      },
      presentationMeta(_args, value) {
        const cwd = value?.cwd;
        return typeof cwd === "string" ? { cwd } : void 0;
      }
    },
    async execute(rawArgs, exec) {
      const args = parseArgs(rawArgs);
      const standingPolicy = resolvePolicy(exec);
      const standingMode = standingPolicy.mode;
      validateBashArgs(args, standingMode);
      if (args.sandbox_permissions !== void 0 && escalationModes.length === 0) {
        throw new Error("sandbox_permissions is not available in this composition (no sandboxing executor to escalate)");
      }
      let approvedMode;
      if (args.sandbox_permissions !== void 0 && args.justification !== void 0) {
        approvedMode = await approveEscalation(
          {
            requestedMode: args.sandbox_permissions,
            justification: args.justification,
            effectiveMode: standingMode,
            subject: "command"
          },
          approvalFor(exec, runtime.approval)
        );
      }
      const mode = approvedMode ?? standingMode;
      let compat = false;
      let sessionMode;
      if (mode === "read-only") {
        throw new Error(
          'bash cannot run in a read-only session: the Windows sandbox cannot start the MSYS2 runtime, and running unconfined would break the read-only promise. Switch the session permission to workspace-write (compatibility mode) or danger-full-access, or retry with sandbox_permissions: "workspace-write"/"danger-full-access" plus a justification.'
        );
      }
      if (mode === "workspace-write") {
        if (runtime.compat === "strict") {
          throw new Error(
            'bash cannot run under the Windows file sandbox: the MSYS2 runtime is blocked by the restricted token. This deployment is in strict compatibility mode. Set Settings \u2192 General \u2192 Terminal tool \u2192 Compatibility to auto, switch the session to danger-full-access, or retry with sandbox_permissions: "danger-full-access" plus a one-sentence justification.'
          );
        }
        compat = true;
        sessionMode = mode;
      }
      const cwd = resolveWorkdir(args.workdir, await resolveCwd(exec));
      const env = composeEnv(runtime.profile, process.env, collectDshEnv(exec), runtime.foreignRoots ?? []);
      const timeoutMs = clampTimeout(args.timeoutMs);
      const sandbox = { mode: "danger-full-access", denied: false };
      if (args.run_in_background === true) {
        if (!backgroundEnabled) throw new Error("run_in_background is disabled for this deployment");
        if (exec.signal.aborted) throw toolAborted();
        const attached = startJob(args, exec, env, cwd, timeoutMs);
        const value = {
          kind: "background",
          jobId: attached.id,
          cwd,
          ...compat ? { compat: true, ...sessionMode !== void 0 ? { sessionMode } : {} } : {}
        };
        return value;
      }
      if (promote && runtime.jobs !== void 0) {
        let attached;
        try {
          attached = startJob(args, exec, env, cwd, timeoutMs);
        } catch (error) {
          runtime.warn?.(`bash: job registration refused, running in the foreground with the timeout kill instead: ${String(error)}`);
        }
        if (attached !== void 0) {
          return await waitOnJob(runtime.jobs, attached, exec, timeoutMs, cwd, compat, sessionMode);
        }
      }
      const execution = createBashExecution(runtime.subprocess, runtime.profile, {
        command: args.command,
        cwd,
        env,
        onExpiry: "kill",
        timeoutMs,
        signal: exec.signal
      });
      const result = await execution.result();
      if (result.aborted) throw toolAborted();
      return {
        ...result,
        sandbox,
        ...compat ? { compat: true, ...sessionMode !== void 0 ? { sessionMode } : {} } : {}
      };
    },
    presentCall,
    presentResult
  };
}

// src/host/diag.ts
import { appendFileSync } from "node:fs";
import { tmpdir as tmpdir2 } from "node:os";
import { join as join2 } from "node:path";
function diagFile() {
  return join2(tmpdir2(), "dsh-gitbash.log");
}
function diag(message) {
  try {
    appendFileSync(diagFile(), `${(/* @__PURE__ */ new Date()).toISOString()} ${message}
`, "utf8");
  } catch {
  }
}

// src/host/replace.ts
var PWSH_TOOL_NAME = "pwsh";
var ORDER_TOOL_BASH = 1e3;
var ORDER_TOOL_PWSH = 1010;
var TOOL_BASH_TEXT = "Check the [exit code: N] marker on every bash result; investigate failures before moving on.";
function readService(ctx, name) {
  try {
    const value = typeof ctx.get === "function" ? ctx.get(name) : void 0;
    return value === void 0 || value === null ? void 0 : value;
  } catch {
    return void 0;
  }
}
function probeCapability(agentCtx) {
  const tools = readService(agentCtx, "tools");
  const systemPrompt = readService(agentCtx, "systemPrompt");
  const usableTools = tools !== void 0 && typeof tools.register === "function" && typeof tools.restrict === "function" ? tools : void 0;
  const usablePrompt = systemPrompt !== void 0 && typeof systemPrompt.section === "function" ? systemPrompt : void 0;
  return {
    ...usableTools !== void 0 ? { tools: usableTools } : {},
    ...usablePrompt !== void 0 ? { systemPrompt: usablePrompt } : {}
  };
}
function sectionOrder(prompt, name, fallback) {
  try {
    const value = prompt.getSectionOrder(name);
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
function buildToolRuntime(host, profile, settings, foreignRoots) {
  const subprocess = readService(host, "subprocess");
  if (subprocess === void 0 || typeof subprocess.spawn !== "function") {
    return { reason: "ctx.subprocess.spawn is not available" };
  }
  const sandboxPolicy = readService(host, "sandboxPolicy");
  if (sandboxPolicy === void 0 || typeof sandboxPolicy.resolve !== "function") {
    return { reason: "ctx.sandboxPolicy.resolve is not available" };
  }
  const jobs = readService(host, "jobs");
  const shell = readService(host, "shell");
  const shellEnv = readService(host, "shellEnv");
  const workingDirectory = readService(host, "workingDirectory");
  const approval = readService(host, "approval");
  return {
    runtime: {
      subprocess,
      profile,
      compat: settings.compat,
      ...jobs !== void 0 && typeof jobs.start === "function" ? { jobs } : {},
      sandboxPolicy,
      ...shell !== void 0 ? { shell } : {},
      ...shellEnv !== void 0 && typeof shellEnv.collect === "function" ? { shellEnv } : {},
      ...workingDirectory !== void 0 && typeof workingDirectory.ensure === "function" ? { workingDirectory } : {},
      ...approval !== void 0 && typeof approval.request === "function" ? { approval } : {},
      foreignRoots,
      warn: (message) => diag(`tool: ${message}`)
    }
  };
}
function replaceTerminalTool(host, agent, settings, profile, foreignRoots = []) {
  if (process.platform !== "win32") return { applied: false, reason: "platform is not win32" };
  if (!profile.valid) return { applied: false, reason: profile.problem ?? "bash profile is invalid" };
  const agentCtx = agent.ctx;
  if (agentCtx === void 0 || agentCtx === null) return { applied: false, reason: "agent has no scoped context" };
  const capability = probeCapability(agentCtx);
  if (capability.tools === void 0) return { applied: false, reason: "ctx.tools.register/restrict is not available" };
  if (capability.systemPrompt === void 0) return { applied: false, reason: "ctx.systemPrompt.section is not available" };
  const built = buildToolRuntime(host, profile, settings, foreignRoots);
  if ("reason" in built) return { applied: false, reason: built.reason };
  const runtime = built.runtime;
  let releaseRestriction;
  try {
    releaseRestriction = capability.tools.restrict({ deny: [PWSH_TOOL_NAME] });
  } catch (error) {
    return { applied: false, reason: `pwsh is not restrictable here (already hidden?): ${messageOf(error)}` };
  }
  const releases = [releaseRestriction];
  try {
    const tool = createBashTool(runtime);
    releases.push(capability.tools.register(tool));
    const orderPwsh = sectionOrder(capability.systemPrompt, "TOOL_PWSH", ORDER_TOOL_PWSH);
    const orderBash = sectionOrder(capability.systemPrompt, "TOOL_BASH", ORDER_TOOL_BASH);
    releases.push(capability.systemPrompt.section({ name: "tool:pwsh", order: orderPwsh, text: "" }));
    releases.push(capability.systemPrompt.section({ name: "tool:bash", order: orderBash, text: TOOL_BASH_TEXT }));
    const windowsText = settings.compat === "auto" ? "bash on Windows runs outside the DSH file sandbox when the session mode is workspace-write, because the MSYS2 runtime cannot start under the Windows restricted token. Do not write outside the workspace; treat outside paths as read-only unless the user explicitly asks otherwise." : "Bash is available only under danger-full-access in this deployment; under read-only/workspace-write the bash tool refuses instead of widening permissions.";
    releases.push(capability.systemPrompt.section({
      name: "tool:bash:windows",
      order: orderBash + 1,
      text: windowsText
    }));
    for (const release of releases) {
      try {
        agentCtx.effect?.(() => release, "dsh-gitbash: replacement");
      } catch {
      }
    }
    diag(`replace: applied agent=${agent.id} profile=${profile.id} compat=${settings.compat}`);
    return { applied: true };
  } catch (error) {
    for (const release of [...releases].reverse()) {
      try {
        release();
      } catch {
      }
    }
    diag(`replace: failed agent=${agent.id}: ${messageOf(error)}`);
    return { applied: false, reason: messageOf(error) };
  }
}
function readAgent(payload) {
  if (typeof payload !== "object" || payload === null) return null;
  const agent = payload.agent;
  if (typeof agent !== "object" || agent === null) return null;
  const record = agent;
  if (typeof record.id !== "string") return null;
  if (typeof record.ctx !== "object" || record.ctx === null) return null;
  if (typeof record.session !== "object" || record.session === null) return null;
  return agent;
}
function registerReplacement(options) {
  const seen = options.seen ?? /* @__PURE__ */ new WeakSet();
  const listener = (payload) => {
    try {
      const agent = readAgent(payload);
      if (agent === null) return;
      if (seen.has(agent)) return;
      seen.add(agent);
      const settings = options.settings();
      const resolved = resolveEffectiveProfile(settings, options.cache, false);
      if (resolved.profile === void 0) {
        const attempt2 = { applied: false, reason: resolved.problem ?? "no usable bash profile" };
        diag(`replace: skipped agent=${agent.id}: ${attempt2.reason ?? "unknown"}`);
        options.onAttempt(attempt2, agent);
        return;
      }
      const profile = resolved.profile;
      const roots = [...new Set(options.cache.get().candidates.map((candidate) => candidate.root))];
      const foreignRoots = roots.filter((root) => normalizePathKey(root) !== normalizePathKey(profile.root));
      const attempt = replaceTerminalTool(options.host, agent, settings, profile, foreignRoots);
      options.onAttempt(attempt, agent);
    } catch (error) {
      diag(`replace: listener failed: ${messageOf(error)}`);
    }
  };
  const dispose = options.host.on("agent/created", listener);
  return typeof dispose === "function" ? dispose : () => void 0;
}
function messageOf(error) {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}

// src/host/routes.ts
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}
async function readBody(request) {
  try {
    const parsed = await request.json();
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
function toView(profile) {
  return profile;
}
function registerRoutes(ctx, deps) {
  const attach = (target) => {
    let connection;
    try {
      connection = target.get("connection");
    } catch (error) {
      diag(`routes: ctx.get(connection) failed: ${messageOf2(error)}`);
      return;
    }
    let register;
    try {
      register = connection?.fetch?.register;
    } catch (error) {
      diag(`routes: connection.fetch failed: ${messageOf2(error)}`);
      return;
    }
    if (connection === void 0 || connection === null || typeof register !== "function") {
      diag("routes: ctx.connection.fetch is not visible");
      return;
    }
    const make = (path, handler) => {
      try {
        const dispose = register.call(connection.fetch, {
          path,
          methods: ["POST"],
          requestBody: "buffered",
          fetch: async (request) => {
            try {
              return json(handler(await readBody(request)));
            } catch (error) {
              diag(`routes: ${path} failed: ${messageOf2(error)}`);
              return json({ ok: false, error: messageOf2(error) });
            }
          }
        });
        target.effect?.(() => () => {
          if (typeof dispose === "function") void dispose();
        }, `dsh-gitbash: route ${path}`);
        diag(`routes: registered ${path}`);
      } catch (error) {
        diag(`routes: register ${path} failed: ${messageOf2(error)}`);
      }
    };
    make(ROUTE_STATE, () => {
      const settings = deps.readSettings();
      const resolved = resolveEffectiveProfile(settings, deps.cache, false);
      const cached = deps.cache.get();
      const lastReplace = deps.lastReplace();
      return {
        ok: true,
        platform: process.platform,
        settingsAvailable: deps.settingsAvailable(),
        bashPath: settings.bashPath,
        msystem: settings.msystem,
        compat: settings.compat,
        ...resolved.profile !== void 0 ? { effective: toView(resolved.profile) } : {},
        ...resolved.problem !== void 0 ? { problem: resolved.problem } : {},
        candidates: cached.candidates.map(toView),
        ...cached.recommended !== void 0 ? { recommended: toView(cached.recommended) } : {},
        capability: deps.capability(),
        ...lastReplace !== void 0 ? { lastReplace } : {},
        namespace: SETTINGS_NAMESPACE
      };
    });
    make(ROUTE_DISCOVER, (body) => {
      const savedPath = typeof body.savedPath === "string" && body.savedPath.length > 0 ? body.savedPath : void 0;
      const msystem = typeof body.msystem === "string" ? body.msystem : void 0;
      const discovered = deps.cache.refresh({
        ...savedPath !== void 0 ? { savedPath } : {},
        ...msystem !== void 0 ? { msystem } : {},
        probe: true
      });
      return {
        ok: true,
        candidates: discovered.candidates.map(toView),
        ...discovered.recommended !== void 0 ? { recommended: toView(discovered.recommended) } : {},
        notes: discovered.notes
      };
    });
    make(ROUTE_VALIDATE, (body) => {
      const path = typeof body.path === "string" ? body.path : "";
      const msystem = typeof body.msystem === "string" ? body.msystem : "auto";
      if (path.trim().length === 0) return { ok: true, problem: "bashPath is empty" };
      const resolved = profileFromPath(path, msystem, true);
      return resolved.profile !== void 0 ? { ok: true, profile: toView(resolved.profile) } : { ok: true, problem: resolved.problem ?? "invalid bash path" };
    });
  };
  if (typeof ctx.inject === "function") {
    ctx.inject(["connection"], (scoped) => attach(scoped));
    return;
  }
  attach(ctx);
}
function messageOf2(error) {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}

// src/index.ts
var inject = [];
function readService2(ctx, name) {
  try {
    const value = ctx.get(name);
    return value === void 0 || value === null ? void 0 : value;
  } catch {
    return void 0;
  }
}
function probeDeploymentCapability(ctx) {
  const shell = readService2(ctx, "shell");
  const jobs = readService2(ctx, "jobs");
  const subprocess = readService2(ctx, "subprocess");
  const sandboxPolicy = readService2(ctx, "sandboxPolicy");
  const supported = process.platform === "win32" && subprocess !== void 0 && typeof subprocess.spawn === "function" && sandboxPolicy !== void 0 && typeof sandboxPolicy.resolve === "function";
  let shellMode;
  try {
    shellMode = shell?.sandboxMode;
  } catch {
    shellMode = void 0;
  }
  return {
    supported,
    ...!supported ? {
      reason: process.platform !== "win32" ? "bash replacement is Windows-only" : subprocess === void 0 || typeof subprocess.spawn !== "function" ? "this DSH composition is missing ctx.subprocess" : "this DSH composition is missing ctx.sandboxPolicy"
    } : {},
    ...shellMode !== void 0 ? { shellSandboxMode: shellMode } : {},
    backgroundJobs: jobs !== void 0 && typeof jobs.start === "function",
    bashAvailable: false
  };
}
function apply(ctx, config) {
  if (process.platform !== "win32") {
    diag("apply: skipped, platform is not win32");
    return;
  }
  const cache = createDiscoveryCache();
  const state = {
    applied: false,
    agents: 0
  };
  const settingsForSession = () => readSettings(config);
  const initial = settingsForSession();
  diag(`apply: pid=${process.pid} settings=${JSON.stringify({ bashPath: initial.bashPath, msystem: initial.msystem, compat: initial.compat })} log=${diagFile()}`);
  try {
    const scan = cache.get();
    diag(`discover: ${scan.candidates.length} profile(s), recommended=${scan.recommended?.id ?? "(none)"}`);
    if (scan.recommended === void 0) diag(`discover: ${scan.notes.join("; ") || "no usable profile"}`);
  } catch (error) {
    diag(`discover: scan failed: ${messageOf3(error)}`);
  }
  const capability = () => {
    const base = probeDeploymentCapability(ctx);
    const resolved = resolveEffectiveProfile(settingsForSession(), cache, false);
    return { ...base, bashAvailable: resolved.profile !== void 0 };
  };
  registerRoutes(ctx, {
    readSettings: settingsForSession,
    cache,
    settingsAvailable: () => true,
    capability,
    lastReplace: () => state.lastReplace
  });
  const dispose = registerReplacement({
    host: ctx,
    settings: settingsForSession,
    cache,
    onAttempt: (attempt, agent) => {
      state.agents += 1;
      state.lastReplace = {
        at: Date.now(),
        applied: attempt.applied,
        ...attempt.reason !== void 0 ? { reason: attempt.reason } : {}
      };
      if (attempt.applied) state.applied = true;
      else diag(`replace: skipped agent=${agent.id} reason=${attempt.reason ?? "unknown"}`);
    }
  });
  ctx.effect?.(() => dispose, "dsh-gitbash: agent/created listener");
}
function messageOf3(error) {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}
export {
  BashSpawnError,
  Config,
  ENV_OVERRIDES,
  ESCALATION_TARGETS,
  EXEC_DEFAULTS,
  PWSH_TOOL_NAME,
  WIDER_MODES,
  apply,
  approveEscalation,
  clampTimeout,
  compatNote,
  composeEnv,
  composePath,
  createBashExecution,
  createBashTool,
  createDiscoveryCache,
  defaultMsystemFor,
  deriveRootFromBash,
  deriveRootFromGit,
  detectFlavor,
  diag,
  diagFile,
  discoverBash,
  environmentRootFor,
  escalationDisplayReason,
  escalationHintMarker,
  inject,
  isBlockedBash,
  normalizeWindowsExit,
  parseBashVersion,
  parseExitStatus,
  posixToWindows,
  probeCapability,
  probeDeploymentCapability,
  profileFromPath,
  profilesForRoot,
  readSettings,
  registerReplacement,
  registerRoutes,
  renderPromoted,
  renderResult,
  replaceTerminalTool,
  resolveEffectiveProfile,
  resolveWorkdir,
  sandboxDenialMarker,
  sandboxPermissionsDescription,
  validateEscalationArgs
};
//# sourceMappingURL=index.js.map
