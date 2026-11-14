window.__ModuleLoader__.load({
	id: "@riverzh/dsh-gitbash",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  GENERAL_ITEM_ID: () => GENERAL_ITEM_ID,
  GENERAL_ITEM_ORDER: () => GENERAL_ITEM_ORDER,
  NOTICE_VERSION_OK: () => NOTICE_VERSION_OK,
  NOTICE_VERSION_OK_UNSAVED: () => NOTICE_VERSION_OK_UNSAVED,
  apply: () => apply,
  createRowController: () => createRowController,
  decodeConfig: () => decodeConfig,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");

// src/client/locales.ts
var LOCALE_NS = "dsh-gitbash";
var zh = {
  title: "\u7EC8\u7AEF\u5DE5\u5177\uFF08Git Bash / MSYS2\uFF09",
  subtitle: "\u5728 Windows \u4E0A\u628A\u6A21\u578B\u7EC8\u7AEF\u5DE5\u5177\u4ECE PowerShell \u6362\u6210 Git Bash \u6216 MSYS2 bash\u3002\u4EC5\u5BF9\u65B0\u4F1A\u8BDD\u751F\u6548\u3002",
  subtitleShort: "Windows \u4E0A\u7528 bash \u66FF\u4EE3 pwsh\uFF1B\u4EC5\u5BF9\u65B0\u4F1A\u8BDD\u751F\u6548\u3002",
  shell: "Shell",
  refresh: "\u5237\u65B0",
  refreshing: "\u5237\u65B0\u4E2D\u2026",
  autoRecommended: "\u81EA\u52A8\uFF08\u63A8\u8350\uFF09",
  manualPath: "\u624B\u52A8\u8DEF\u5F84",
  advanced: "\u9AD8\u7EA7\u4E0E\u8BCA\u65AD",
  warningShort: "\u26A0 \u517C\u5BB9\u6A21\u5F0F\uFF1Aworkspace-write \u4E0B bash \u4E0D\u53D7\u6587\u4EF6\u6C99\u7BB1\uFF1Bread-only \u62D2\u7EDD\u3002\u6587\u4EF6\u5DE5\u5177\u4ECD\u53D7\u6C99\u7BB1\u3002",
  warningStrictShort: "\u4E25\u683C\u6A21\u5F0F\uFF1A\u4EC5 danger-full-access \u4F1A\u8BDD\u53EF\u7528\u3002",
  msystemHint: "\u4EC5\u624B\u52A8\u8DEF\u5F84 / MSYS2 \u9700\u8981",
  pathLabel: "bash \u8DEF\u5F84",
  pathPlaceholder: "\u7559\u7A7A = \u81EA\u52A8\u53D1\u73B0\uFF1B\u6216\u586B C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  auto: "\u81EA\u52A8\u53D1\u73B0",
  discovering: "\u6B63\u5728\u626B\u63CF\u2026",
  test: "\u6D4B\u8BD5",
  testing: "\u6B63\u5728\u6D4B\u8BD5\u2026",
  apply: "\u4F7F\u7528\u6B64\u8DEF\u5F84",
  reset: "\u6062\u590D\u81EA\u52A8",
  current: "\u5F53\u524D\u751F\u6548",
  sourceConfigured: "\u5DF2\u914D\u7F6E",
  sourceAuto: "\u81EA\u52A8\u53D1\u73B0",
  sourceNone: "\u672A\u627E\u5230",
  msystem: "MSYS2 \u73AF\u5883",
  msystemAuto: "\u81EA\u52A8",
  compat: "\u517C\u5BB9",
  compatAuto: "\u517C\u5BB9\u6A21\u5F0F\uFF08\u63A8\u8350\uFF09",
  compatStrict: "\u4E25\u683C\u6A21\u5F0F",
  warningAuto: "Git Bash / MSYS2 \u4E0E DSH \u7684 Windows \u6587\u4EF6\u6C99\u7BB1\u5728 OS \u5C42\u4E0D\u517C\u5BB9\u3002\u517C\u5BB9\u6A21\u5F0F\u4E0B\uFF0Cworkspace-write \u4F1A\u8BDD\u4E2D\u7684 bash \u4EE5\u5B8C\u5168\u8BBF\u95EE\u8FD0\u884C\uFF08\u53EF\u5199\u5DE5\u4F5C\u533A\u5916\u6587\u4EF6\uFF09\uFF1Bread-only \u4ECD\u62D2\u7EDD\u3002\u6587\u4EF6\u5DE5\u5177\u4ECD\u53D7\u6C99\u7BB1\u4FDD\u62A4\u3002",
  warningStrict: "\u4E25\u683C\u6A21\u5F0F\u53EA\u5141\u8BB8 danger-full-access \u4F1A\u8BDD\u4F7F\u7528 bash\uFF1Bworkspace-write / read-only \u4F1A\u88AB\u62D2\u7EDD\u3002\u5B89\u5168\u4F46\u53D7\u9650\u3002",
  status: "\u72B6\u6001",
  platform: "\u5E73\u53F0",
  sandboxMode: "\u6C99\u7BB1\u80FD\u529B",
  backgroundJobs: "\u540E\u53F0\u4EFB\u52A1",
  lastReplace: "\u6700\u8FD1\u66FF\u6362",
  applied: "\u5DF2\u66FF\u6362",
  skipped: "\u672A\u66FF\u6362",
  candidates: "\u626B\u63CF\u7ED3\u679C",
  recommended: "\u63A8\u8350",
  noCandidates: "\u6CA1\u6709\u627E\u5230\u53EF\u7528\u7684 Git Bash / MSYS2\u3002\u8BF7\u5B89\u88C5 Git for Windows \u6216 MSYS2\uFF0C\u6216\u624B\u52A8\u586B\u5199\u8DEF\u5F84\u3002",
  selectCandidate: "\u9009\u62E9\u4E00\u4E2A\u626B\u63CF\u7ED3\u679C\u2026",
  version: "\u7248\u672C",
  flavor: "\u6765\u6E90",
  loading: "\u52A0\u8F7D\u4E2D\u2026",
  unavailable: "\u8BBE\u7F6E\u8868\u5355\u4E0D\u53EF\u7528\uFF08\u5F53\u524D DSH \u7EC4\u5408\u6CA1\u6709 configForms\uFF09",
  namespaceUnavailable: "\u8BBE\u7F6E\u547D\u540D\u7A7A\u95F4\u5C1A\u672A\u7531 Host \u63D0\u4F9B\uFF08\u63D2\u4EF6\u53EF\u80FD\u672A\u542F\u7528\u6216\u52A0\u8F7D\u5931\u8D25\uFF09",
  namespaceLoading: "\u6B63\u5728\u52A0\u8F7D\u8BBE\u7F6E\u547D\u540D\u7A7A\u95F4\u2026",
  noticeVersionOk: "bash --version \u6D4B\u8BD5\u901A\u8FC7",
  noticeVersionOkUnsaved: "bash --version \u6D4B\u8BD5\u901A\u8FC7\uFF08\u8BE5\u8DEF\u5F84\u5C1A\u672A\u4FDD\u5B58\uFF09",
  unsupported: "\u5F53\u524D DSH \u7EC4\u5408\u4E0D\u652F\u6301 bash \u66FF\u6362\uFF1A",
  readOnly: "\u53EA\u8BFB\uFF1A\u8BBE\u7F6E\u8868\u5355\u5F53\u524D\u4E0D\u53EF\u5199",
  saveFailed: "\u4FDD\u5B58\u5931\u8D25",
  discoverFailed: "\u626B\u63CF\u5931\u8D25",
  validateFailed: "\u6D4B\u8BD5\u5931\u8D25",
  invalidPath: "\u8DEF\u5F84\u65E0\u6548",
  saved: "\u5DF2\u4FDD\u5B58",
  git: "Git for Windows",
  msys2: "MSYS2",
  cygwin: "Cygwin\uFF08\u5B9E\u9A8C\uFF09",
  yes: "\u53EF\u7528",
  no: "\u4E0D\u53EF\u7528",
  noPath: "\u5C1A\u672A\u627E\u5230 bash",
  configFromState: "\u6765\u81EA\u8BBE\u7F6E"
};
var en = {
  title: "Terminal tool (Git Bash / MSYS2)",
  subtitle: "Replace the model terminal tool with Git Bash or MSYS2 bash on Windows. Applies to new sessions only.",
  subtitleShort: "Use bash instead of pwsh on Windows; applies to new sessions only.",
  shell: "Shell",
  refresh: "Refresh",
  refreshing: "Refreshing\u2026",
  autoRecommended: "Auto (recommended)",
  manualPath: "Manual path",
  advanced: "Advanced & diagnostics",
  warningShort: "\u26A0 Compatibility: bash is not file-sandboxed under workspace-write; read-only refuses. File tools stay sandboxed.",
  warningStrictShort: "Strict: bash is available only in danger-full-access sessions.",
  msystemHint: "manual paths / MSYS2 only",
  pathLabel: "bash path",
  pathPlaceholder: "Empty = auto-discover, or C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  auto: "Auto discover",
  discovering: "Scanning\u2026",
  test: "Test",
  testing: "Testing\u2026",
  apply: "Use this path",
  reset: "Reset to auto",
  current: "Effective",
  sourceConfigured: "Configured",
  sourceAuto: "Auto-discovered",
  sourceNone: "Not found",
  msystem: "MSYS2 environment",
  msystemAuto: "Auto",
  compat: "Compat",
  compatAuto: "Compatibility (recommended)",
  compatStrict: "Strict",
  warningAuto: "Git Bash / MSYS2 cannot start under DSH\u2019s Windows file sandbox. In compatibility mode, bash in workspace-write sessions runs with full access (it can write outside the workspace); read-only still refuses. File tools remain sandboxed.",
  warningStrict: "Strict mode allows bash only in danger-full-access sessions; workspace-write / read-only are refused. Safer, but limited.",
  status: "Status",
  platform: "Platform",
  sandboxMode: "Sandbox capability",
  backgroundJobs: "Background jobs",
  lastReplace: "Last replacement",
  applied: "Applied",
  skipped: "Skipped",
  candidates: "Scan results",
  recommended: "Recommended",
  noCandidates: "No usable Git Bash / MSYS2 was found. Install Git for Windows or MSYS2, or enter a path manually.",
  selectCandidate: "Choose a scan result\u2026",
  version: "Version",
  flavor: "Flavor",
  loading: "Loading\u2026",
  unavailable: "Settings form unavailable (this DSH composition has no configForms)",
  namespaceUnavailable: "The settings namespace is not served by the Host (plugin disabled or failed)",
  namespaceLoading: "Loading the settings namespace\u2026",
  noticeVersionOk: "bash --version OK",
  noticeVersionOkUnsaved: "bash --version OK (path not saved yet)",
  unsupported: "This DSH composition cannot replace bash: ",
  readOnly: "Read-only: the settings form is not writable right now",
  saveFailed: "Save failed",
  discoverFailed: "Discovery failed",
  validateFailed: "Test failed",
  invalidPath: "Invalid path",
  saved: "Saved",
  git: "Git for Windows",
  msys2: "MSYS2",
  cygwin: "Cygwin (experimental)",
  yes: "Available",
  no: "Unavailable",
  noPath: "No bash found yet",
  configFromState: "From settings"
};
var dictionaries = { zh, en };

// src/client/row.tsx
var import_react = require("react");

// src/shared/protocol.ts
var SETTINGS_NAMESPACE = "dsh-gitbash";
var ROUTE_STATE = "/api/dsh-gitbash/state";
var ROUTE_DISCOVER = "/api/dsh-gitbash/discover";
var ROUTE_VALIDATE = "/api/dsh-gitbash/validate";
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
var COMPAT_MODES = ["auto", "strict"];

// src/client/api.ts
var REQUEST_TIMEOUT_MS = 2e4;
async function post(path, body, timeoutMs = REQUEST_TIMEOUT_MS) {
  const timeout = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : void 0;
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...timeout !== void 0 ? { signal: timeout } : {}
    });
  } catch (error) {
    const detail = typeof error === "object" && error !== null && "message" in error ? String(error.message) : String(error);
    throw new Error(`request failed: ${path}: ${detail}`);
  }
  const text = await response.text();
  if (text.length === 0) {
    throw new Error(`request failed: ${path} (${response.status}): empty response`);
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`request failed: ${path} (${response.status}): ${text.slice(0, 200)}`);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error(`unexpected response from ${path} (${response.status})`);
  }
  const record = payload;
  if (!response.ok) {
    throw new Error(
      typeof record.error === "string" ? record.error : `request failed: ${path} (${response.status})`
    );
  }
  if (record.ok !== true) {
    throw new Error(
      typeof record.error === "string" ? record.error : `request failed: ${path}: unexpected response envelope`
    );
  }
  return payload;
}
function fetchState() {
  return post(ROUTE_STATE, {});
}
function fetchDiscover(savedPath) {
  return post(ROUTE_DISCOVER, { savedPath }, 6e4);
}
function fetchValidate(path, msystem) {
  return post(ROUTE_VALIDATE, { path, msystem });
}

// src/client/store.ts
var DEFAULT_CAPABILITY = {
  supported: false,
  backgroundJobs: false,
  bashAvailable: false
};
function createStore(initial) {
  let state = initial;
  const listeners = /* @__PURE__ */ new Set();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState(patch) {
      const next = { ...state, ...patch };
      if (shallowEqual(state, next)) return;
      state = next;
      for (const listener of [...listeners]) listener();
    }
  };
}
function shallowEqual(a, b) {
  const left = a;
  const right = b;
  const keys = /* @__PURE__ */ new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if (left[key] !== right[key]) return false;
  return true;
}
function configOf(value) {
  const record = typeof value === "object" && value !== null ? value : {};
  const msystem = typeof record.msystem === "string" && MSYSTEM_SETTINGS.includes(record.msystem) ? record.msystem : "auto";
  const compat = typeof record.compat === "string" && COMPAT_MODES.includes(record.compat) ? record.compat : "auto";
  return {
    bashPath: typeof record.bashPath === "string" ? stripMatchingQuotes(record.bashPath) : "",
    msystem,
    compat
  };
}
var NOTICE_VERSION_OK = "bash --version OK";
var NOTICE_VERSION_OK_UNSAVED = "bash --version OK (unsaved path)";
function createRowController(scope) {
  const snapshotOf = () => {
    try {
      return scope?.getSnapshot();
    } catch {
      return void 0;
    }
  };
  const initial = snapshotOf();
  const store = createStore({
    status: "loading",
    scopeStatus: initial?.status ?? "unavailable",
    writable: initial?.writable ?? false,
    platform: "",
    config: configOf(initial?.value),
    capability: DEFAULT_CAPABILITY,
    candidates: [],
    discovered: false,
    saving: false,
    discovering: false,
    validating: false
  });
  let disposed = false;
  let pendingSaves = 0;
  let stateSequence = 0;
  let discoverSequence = 0;
  let validateSequence = 0;
  let errorOwner;
  const clearOwnedError = (owner) => {
    if (errorOwner !== owner) return;
    errorOwner = void 0;
    store.setState({ error: void 0 });
  };
  const isProfile = (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value;
    return typeof record.id === "string" && typeof record.path === "string" && typeof record.root === "string" && typeof record.label === "string" && typeof record.flavor === "string" && typeof record.valid === "boolean";
  };
  const isCapability = (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value;
    return typeof record.supported === "boolean" && typeof record.backgroundJobs === "boolean" && typeof record.bashAvailable === "boolean";
  };
  const isLastReplace = (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value;
    return typeof record.applied === "boolean" && (record.reason === void 0 || typeof record.reason === "string");
  };
  const assertState = (state) => {
    if (typeof state !== "object" || state === null || Array.isArray(state)) throw new Error("unexpected /state response");
    const record = state;
    if (typeof record.platform !== "string" || !Array.isArray(record.candidates) || !record.candidates.every(isProfile) || !isCapability(record.capability) || record.problem !== void 0 && typeof record.problem !== "string" || record.capability.reason !== void 0 && typeof record.capability.reason !== "string" || record.capability.shellSandboxMode !== void 0 && typeof record.capability.shellSandboxMode !== "string" || record.lastReplace !== void 0 && !isLastReplace(record.lastReplace) || record.effective !== void 0 && !isProfile(record.effective) || record.recommended !== void 0 && !isProfile(record.recommended)) {
      throw new Error("unexpected /state response");
    }
  };
  const applyState = (state) => {
    assertState(state);
    const snapshot = snapshotOf();
    const fromState = configOf({ bashPath: state.bashPath, msystem: state.msystem, compat: state.compat });
    store.setState({
      status: "ready",
      scopeStatus: snapshot?.status ?? "unavailable",
      writable: snapshot?.writable ?? false,
      platform: state.platform,
      config: snapshot?.value !== void 0 ? configOf(snapshot.value) : fromState,
      ...state.effective !== void 0 ? { effective: state.effective } : { effective: void 0 },
      ...state.problem !== void 0 ? { problem: state.problem } : { problem: void 0 },
      candidates: state.candidates,
      ...state.recommended !== void 0 ? { recommended: state.recommended } : { recommended: void 0 },
      discovered: true,
      capability: state.capability,
      ...state.lastReplace !== void 0 ? { lastReplace: state.lastReplace } : { lastReplace: void 0 },
      // A fresh problem invalidates an older success notice.
      ...state.problem !== void 0 ? { notice: void 0 } : {}
    });
  };
  const refresh = async () => {
    const sequence = ++stateSequence;
    try {
      const state = await fetchState();
      if (disposed || sequence !== stateSequence) return;
      clearOwnedError("refresh");
      applyState(state);
    } catch (error) {
      if (disposed || sequence !== stateSequence) return;
      if (errorOwner === void 0 || errorOwner === "refresh") {
        errorOwner = "refresh";
        store.setState({ status: "error", error: messageOf(error) });
      }
    }
  };
  const start = () => {
    disposed = false;
    const unsubscribers = [];
    if (scope !== void 0) {
      const sync = () => {
        const snapshot = snapshotOf();
        if (snapshot === void 0) return;
        const current = store.getState().config;
        const next = snapshot.value !== void 0 ? configOf(snapshot.value) : void 0;
        const changed = next !== void 0 && (next.bashPath !== current.bashPath || next.msystem !== current.msystem || next.compat !== current.compat);
        store.setState({
          scopeStatus: snapshot.status,
          writable: snapshot.writable,
          ...next !== void 0 ? { config: next } : {},
          ...changed ? { notice: void 0 } : {}
        });
      };
      sync();
      try {
        unsubscribers.push(scope.subscribe(sync));
      } catch {
      }
    }
    void refresh();
    return () => {
      disposed = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  };
  const save = async (patch) => {
    if (scope === void 0) throw new Error("settings form unavailable");
    validateSequence += 1;
    pendingSaves += 1;
    errorOwner = void 0;
    store.setState({ saving: true, validating: false, error: void 0, notice: void 0 });
    try {
      const entries = Object.entries(patch);
      if (entries.length > 0) {
        if (typeof scope.mutate === "function") {
          const accepted = await scope.mutate(entries.map(([key, value]) => ({
            op: "set",
            path: [key],
            value
          })));
          if (accepted === false) throw new Error("the host rejected the settings update");
        } else {
          for (const [key, value] of entries) {
            const result = await scope.set(key, value);
            if (result === false) throw new Error(`the host rejected the ${key} update`);
          }
        }
      }
      store.setState({ config: { ...store.getState().config, ...patch }, notice: void 0 });
      await refresh();
    } catch (error) {
      errorOwner = "save";
      store.setState({ error: messageOf(error) });
      throw error;
    } finally {
      pendingSaves = Math.max(0, pendingSaves - 1);
      store.setState({ saving: pendingSaves > 0 });
    }
  };
  const setConfig = async (patch) => {
    try {
      await save(patch);
    } catch {
    }
  };
  const discover = async () => {
    const sequence = ++discoverSequence;
    errorOwner = void 0;
    store.setState({ discovering: true, error: void 0, notice: void 0 });
    const { config } = store.getState();
    try {
      const result = await fetchDiscover(config.bashPath);
      if (disposed || sequence !== discoverSequence) return;
      if (typeof result !== "object" || result === null || !Array.isArray(result.candidates) || !result.candidates.every(isProfile) || !Array.isArray(result.notes) || result.recommended !== void 0 && !isProfile(result.recommended)) {
        throw new Error("unexpected /discover response");
      }
      store.setState({
        discovering: false,
        discovered: true,
        candidates: result.candidates,
        ...result.recommended !== void 0 ? { recommended: result.recommended } : { recommended: void 0 },
        notice: result.notes.length > 0 ? result.notes.join("; ") : void 0
      });
      await refresh();
    } catch (error) {
      if (disposed || sequence !== discoverSequence) return;
      errorOwner = "discover";
      store.setState({ discovering: false, error: messageOf(error) });
    }
  };
  const validate = async (override) => {
    const sequence = ++validateSequence;
    errorOwner = void 0;
    store.setState({ validating: true, error: void 0, notice: void 0 });
    const { config } = store.getState();
    const draft = override === void 0 ? "" : stripMatchingQuotes(override).trim();
    const path = draft.length > 0 ? draft : config.bashPath.length > 0 ? config.bashPath : store.getState().effective?.path ?? "";
    const normalize = (value) => value.replaceAll("/", "\\").toLowerCase();
    const configuredPath = config.bashPath.length > 0 ? config.bashPath : store.getState().effective?.path ?? "";
    const saved = normalize(path) === normalize(configuredPath);
    const msystemForTest = saved ? config.msystem : "auto";
    try {
      const result = await fetchValidate(path, msystemForTest);
      if (disposed || sequence !== validateSequence) return;
      if (typeof result !== "object" || result === null) throw new Error("unexpected /validate response");
      if (result.problem !== void 0) {
        if (typeof result.problem !== "string") throw new Error("unexpected /validate response");
        errorOwner = "validate";
        store.setState({
          validating: false,
          error: result.problem,
          ...saved ? { effective: void 0 } : {}
        });
      } else {
        if (result.profile !== void 0 && !isProfile(result.profile)) throw new Error("unexpected /validate response");
        store.setState({
          validating: false,
          ...saved ? { effective: result.profile, problem: void 0 } : {},
          notice: saved ? NOTICE_VERSION_OK : NOTICE_VERSION_OK_UNSAVED
        });
      }
    } catch (error) {
      if (disposed || sequence !== validateSequence) return;
      errorOwner = "validate";
      store.setState({ validating: false, error: messageOf(error) });
    }
  };
  const useProfile = async (profile) => {
    await setConfig({ bashPath: profile.path, msystem: profile.msystem ?? "auto" });
  };
  const resetAuto = async () => {
    await setConfig({ bashPath: "", msystem: "auto" });
  };
  return {
    store,
    start,
    setConfig,
    discover,
    validate,
    useProfile,
    resetAuto,
    refresh
  };
}
function messageOf(error) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}

// src/client/row.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var AUTO = "__auto__";
var MANUAL = "__manual__";
var styles = {
  card: {
    border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
    borderRadius: 10,
    padding: "10px 12px",
    display: "grid",
    gap: 8,
    fontSize: 13
  },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  title: { fontWeight: 600, fontSize: 14 },
  subtitle: { opacity: 0.65, lineHeight: 1.4, fontSize: 12 },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label: { minWidth: 62, opacity: 0.75, fontSize: 12 },
  select: {
    minWidth: 220,
    maxWidth: "100%",
    padding: "4px 7px",
    // Native <select> popups do not inherit the page's surface color on
    // Windows: a transparent control yields a white list with the theme's
    // white text. Use the host's theme tokens on both the control and every
    // <option>, with system-color fallbacks for older hosts.
    border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 22%, transparent))",
    borderRadius: 6,
    backgroundColor: "var(--dsw-alias-bg-layer-2, Canvas)",
    color: "var(--dsw-alias-brand-text, CanvasText)",
    fontSize: 12
  },
  option: {
    backgroundColor: "var(--dsw-alias-bg-layer-2, Canvas)",
    color: "var(--dsw-alias-brand-text, CanvasText)"
  },
  input: {
    flex: 1,
    minWidth: 220,
    padding: "4px 8px",
    border: "1px solid var(--dsw-alias-border-l2, color-mix(in srgb, currentColor 22%, transparent))",
    borderRadius: 6,
    backgroundColor: "var(--dsw-alias-bg-layer-1, Canvas)",
    color: "var(--dsw-alias-brand-text, CanvasText)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: 12
  },
  button: {
    padding: "3px 9px",
    border: "1px solid color-mix(in srgb, currentColor 22%, transparent)",
    borderRadius: 6,
    background: "color-mix(in srgb, currentColor 6%, transparent)",
    color: "inherit",
    cursor: "pointer",
    fontSize: 12
  },
  buttonPrimary: {
    padding: "3px 9px",
    border: "1px solid color-mix(in srgb, currentColor 30%, transparent)",
    borderRadius: 6,
    background: "color-mix(in srgb, currentColor 14%, transparent)",
    color: "inherit",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600
  },
  warning: {
    border: "1px solid color-mix(in srgb, #e5484d 40%, transparent)",
    background: "color-mix(in srgb, #e5484d 7%, transparent)",
    borderRadius: 7,
    padding: "5px 8px",
    lineHeight: 1.45,
    fontSize: 12,
    color: "var(--dsw-alias-state-error-primary, #e5484d)"
  },
  strict: {
    border: "1px solid color-mix(in srgb, #f5a623 40%, transparent)",
    background: "color-mix(in srgb, #f5a623 7%, transparent)",
    borderRadius: 7,
    padding: "5px 8px",
    lineHeight: 1.45,
    fontSize: 12
  },
  muted: { opacity: 0.65, fontSize: 12 },
  error: { color: "var(--dsw-alias-state-error-primary, #e5484d)", fontSize: 12, lineHeight: 1.45 },
  notice: { fontSize: 12, lineHeight: 1.45, opacity: 0.8 },
  badge: {
    border: "1px solid color-mix(in srgb, currentColor 20%, transparent)",
    borderRadius: 999,
    padding: "0 8px",
    fontSize: 11,
    opacity: 0.85,
    whiteSpace: "nowrap",
    maxWidth: "55%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    flexShrink: 1
  },
  summary: { cursor: "pointer", opacity: 0.75, fontSize: 12 },
  detailsBody: { display: "grid", gap: 8, paddingTop: 8 },
  status: { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "1px 10px", fontSize: 11, opacity: 0.8, minWidth: 0 },
  code: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", overflowWrap: "anywhere", minWidth: 0 }
};
function profileLabel(profile) {
  return profile.version !== void 0 ? `${profile.label} ${profile.version}` : profile.label;
}
function samePath(a, b) {
  return a.replaceAll("/", "\\").toLowerCase() === b.replaceAll("/", "\\").toLowerCase();
}
function TerminalToolRow({ t, scope }) {
  const controller = (0, import_react.useMemo)(() => createRowController(scope), [scope]);
  const state = (0, import_react.useSyncExternalStore)(controller.store.subscribe, controller.store.getState, controller.store.getState);
  const [draftPath, setDraftPath] = (0, import_react.useState)(state.config.bashPath);
  const [advanced, setAdvanced] = (0, import_react.useState)(false);
  const pathInput = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => controller.start(), [controller]);
  (0, import_react.useEffect)(() => {
    setDraftPath(state.config.bashPath);
  }, [state.config.bashPath]);
  const scopeReady = state.scopeStatus === "ready";
  const disabled = !scopeReady || !state.writable || state.saving || state.discovering || state.validating;
  const compat = state.config.compat;
  const candidates = state.candidates;
  const matched = state.config.bashPath.length === 0 ? void 0 : candidates.find((candidate) => samePath(candidate.path, state.config.bashPath) && (state.config.msystem === "auto" || (candidate.msystem ?? "auto") === state.config.msystem));
  const selectedValue = state.config.bashPath.length === 0 ? AUTO : matched?.id ?? MANUAL;
  const choose = (value) => {
    if (value === AUTO) {
      void controller.resetAuto();
      return;
    }
    if (value === MANUAL) {
      setAdvanced(true);
      setTimeout(() => pathInput.current?.focus(), 0);
      return;
    }
    const profile = candidates.find((candidate) => candidate.id === value);
    if (profile !== void 0) void controller.useProfile(profile);
  };
  const applyManualPath = () => {
    const next = stripMatchingQuotes(draftPath);
    void controller.setConfig(next !== state.config.bashPath ? { bashPath: next, msystem: "auto" } : { bashPath: next });
  };
  const notice = state.notice === NOTICE_VERSION_OK ? t("noticeVersionOk") : state.notice === NOTICE_VERSION_OK_UNSAVED ? t("noticeVersionOkUnsaved") : state.notice;
  const scopeProblem = state.scopeStatus === "unavailable" ? scope === void 0 ? t("unavailable") : t("namespaceUnavailable") : state.scopeStatus === "loading" ? t("namespaceLoading") : !state.writable ? t("readOnly") : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.card, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.title, children: t("title") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.subtitle, children: t("subtitleShort") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.badge, title: state.effective?.path, children: state.effective?.label ?? t("noPath") })
    ] }),
    scopeProblem !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.muted, children: scopeProblem }) : null,
    !state.capability.supported && state.capability.reason !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.error, children: [
      t("unsupported"),
      state.capability.reason
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.label, children: t("shell") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "select",
        {
          style: styles.select,
          value: selectedValue,
          disabled,
          "aria-label": t("shell"),
          onChange: (event) => choose(event.target.value),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: AUTO, style: styles.option, children: t("autoRecommended") }),
            candidates.map((profile) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: profile.id, disabled: !profile.valid, style: styles.option, children: [
              profileLabel(profile),
              profile.valid ? "" : ` \u2014 ${profile.problem ?? t("invalidPath")}`
            ] }, profile.id)),
            selectedValue === MANUAL ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: MANUAL, style: styles.option, children: [
              t("manualPath"),
              ": ",
              state.config.bashPath
            ] }) : null
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          style: styles.button,
          disabled,
          "aria-busy": state.discovering,
          onClick: () => void controller.discover(),
          children: state.discovering ? t("refreshing") : t("refresh")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.label, children: t("compat") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "select",
        {
          style: styles.select,
          value: compat,
          disabled: !scopeReady || !state.writable || state.saving || state.validating,
          "aria-label": t("compat"),
          onChange: (event) => void controller.setConfig({ compat: event.target.value }),
          children: COMPAT_MODES.map((mode) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: mode, style: styles.option, children: t(mode === "auto" ? "compatAuto" : "compatStrict") }, mode))
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: compat === "auto" ? styles.warning : styles.strict,
        title: compat === "auto" ? t("warningAuto") : t("warningStrict"),
        children: compat === "auto" ? t("warningShort") : t("warningStrictShort")
      }
    ),
    state.error !== void 0 || state.problem !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.error, role: "alert", "aria-live": "assertive", children: state.error ?? state.problem }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "details",
      {
        open: advanced,
        onToggle: (event) => setAdvanced(event.currentTarget.open),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { style: styles.summary, children: t("advanced") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.detailsBody, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.label, children: t("pathLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "input",
                {
                  ref: pathInput,
                  style: styles.input,
                  value: draftPath,
                  placeholder: t("pathPlaceholder"),
                  "aria-label": t("pathLabel"),
                  spellCheck: false,
                  disabled: !scopeReady || !state.writable || state.saving || state.validating,
                  onChange: (event) => setDraftPath(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter") applyManualPath();
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: styles.buttonPrimary, disabled, onClick: applyManualPath, children: t("apply") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: styles.button, disabled, onClick: () => void controller.resetAuto(), children: t("reset") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  style: styles.button,
                  disabled,
                  "aria-busy": state.validating,
                  onClick: () => void controller.validate(draftPath),
                  children: state.validating ? t("testing") : t("test")
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.label, children: t("msystem") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "select",
                {
                  style: styles.select,
                  value: state.config.msystem,
                  disabled: !scopeReady || !state.writable || state.saving || state.validating || state.effective?.flavor === "git",
                  "aria-label": t("msystem"),
                  onChange: (event) => void controller.setConfig({ msystem: event.target.value }),
                  children: MSYSTEM_SETTINGS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option, style: styles.option, children: option === "auto" ? t("msystemAuto") : option }, option))
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.muted, children: t("msystemHint") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.status, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("platform") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.code, children: state.platform || "\u2014" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("sandboxMode") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.code, children: state.capability.shellSandboxMode ?? "\u2014" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("backgroundJobs") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.code, children: state.capability.backgroundJobs ? t("yes") : t("no") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("lastReplace") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.code, children: state.lastReplace === void 0 ? "\u2014" : `${state.lastReplace.applied ? t("applied") : t("skipped")}${state.lastReplace.reason !== void 0 ? `: ${state.lastReplace.reason}` : ""}` })
            ] }),
            notice !== void 0 && state.error === void 0 && state.problem === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.notice, role: "status", "aria-live": "polite", children: notice }) : null
          ] })
        ]
      }
    )
  ] });
}

// src/client/index.ts
var GENERAL_ITEM_ID = "git-bash";
var GENERAL_ITEM_ORDER = 60;
var inject = ["slots", "locale"];
function decodeConfig(section) {
  if (typeof section !== "object" || section === null || Array.isArray(section)) return void 0;
  const record = section;
  return {
    bashPath: typeof record.bashPath === "string" ? stripMatchingQuotes(record.bashPath) : "",
    msystem: typeof record.msystem === "string" ? record.msystem : "auto",
    compat: typeof record.compat === "string" ? record.compat : "auto"
  };
}
function asDisposer(value) {
  return typeof value === "function" ? value : () => void 0;
}
function registerLocale(ctx, locale) {
  if (locale === void 0) return () => void 0;
  const register = () => {
    const disposers = [];
    try {
      disposers.push(asDisposer(locale.register(LOCALE_NS, dictionaries)));
    } catch {
      try {
        disposers.push(asDisposer(locale.register(LOCALE_NS, "zh", dictionaries.zh ?? {})));
        disposers.push(asDisposer(locale.register(LOCALE_NS, "en", dictionaries.en ?? {})));
      } catch {
      }
    }
    return () => {
      for (const dispose of disposers) dispose();
    };
  };
  if (typeof ctx.effect === "function") {
    ctx.effect(register, "dsh-gitbash: dictionaries");
    return () => void 0;
  }
  return register();
}
function readService(ctx, name) {
  try {
    const value = ctx.get(name);
    return value === void 0 || value === null ? void 0 : value;
  } catch {
    return void 0;
  }
}
function apply(ctx) {
  const locale = readService(ctx, "locale");
  registerLocale(ctx, locale);
  const t = locale?.bind(LOCALE_NS) ?? ((key) => key);
  const slots = readService(ctx, "slots");
  if (slots === void 0 || slots === null || typeof slots.inject !== "function") return;
  const binder = () => {
    const candidate = readService(ctx, "webUiSettings") ?? readService(ctx, "settingsScope");
    return candidate !== void 0 && candidate !== null && typeof candidate.bind === "function" ? candidate : void 0;
  };
  const nativeForm = (scopeCtx = ctx) => {
    const forms2 = readService(scopeCtx, "configForms");
    if (forms2 === void 0 || forms2 === null || typeof forms2.get !== "function") return void 0;
    try {
      return forms2.get(SETTINGS_NAMESPACE);
    } catch {
      return void 0;
    }
  };
  const bind = (scopeBinder) => {
    try {
      return scopeBinder.bind({ namespace: SETTINGS_NAMESPACE, decode: decodeConfig });
    } catch {
      return void 0;
    }
  };
  let seated = false;
  let seatDispose;
  let seatedScope;
  const noop = () => {
  };
  const seatRow = (scope) => {
    if (seated && seatedScope === scope) return seatDispose ?? noop;
    if (seated) {
      const previous = seatDispose;
      seatDispose = void 0;
      seated = false;
      seatedScope = void 0;
      previous?.();
    }
    seated = true;
    let inner;
    const release = () => {
      try {
        inner?.();
      } catch {
      }
      if (seatDispose === release) {
        seatDispose = void 0;
        seated = false;
        seatedScope = void 0;
      }
    };
    try {
      const dispose = slots.inject("settings.general.item", () => slots.register(
        { name: "settings.general.item", id: GENERAL_ITEM_ID, order: GENERAL_ITEM_ORDER, locale: LOCALE_NS },
        () => (0, import_react2.createElement)(TerminalToolRow, { t, scope })
      ));
      if (typeof dispose === "function") inner = dispose;
      seatDispose = release;
      seatedScope = scope;
      return release;
    } catch (error) {
      console.warn("[dsh-gitbash] settings row registration failed:", error);
      seated = false;
      seatedScope = void 0;
      return noop;
    }
  };
  const seat = (scope) => {
    const dispose = seatRow(scope);
    if (dispose !== noop && typeof ctx.effect === "function") {
      try {
        ctx.effect(() => dispose, "dsh-gitbash: settings row");
      } catch {
      }
    }
  };
  let stopWatch;
  const installWatch = (forms2, scopeCtx) => {
    if (typeof forms2.whileServed !== "function") return false;
    const previous = stopWatch;
    stopWatch = void 0;
    try {
      previous?.();
    } catch {
    }
    let releaseWatch;
    try {
      const whileServed = forms2.whileServed.bind(forms2);
      releaseWatch = asDisposer(whileServed([SETTINGS_NAMESPACE], () => {
        const servedScope = nativeForm(scopeCtx);
        return servedScope === void 0 ? noop : seatRow(servedScope);
      }));
    } catch (error) {
      console.warn("[dsh-gitbash] settings namespace watch failed:", error);
      return false;
    }
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (stopWatch === stop) stopWatch = void 0;
      releaseWatch();
    };
    stopWatch = stop;
    if (typeof scopeCtx.effect === "function") {
      try {
        scopeCtx.effect(() => stop, "dsh-gitbash: settings row watch");
      } catch {
      }
    }
    return true;
  };
  const forms = readService(ctx, "configForms");
  if (forms !== void 0 && installWatch(forms, ctx)) {
    if (typeof ctx.inject === "function") {
      try {
        ctx.inject(["configForms"], (scope) => {
          const target = scope ?? ctx;
          const next = readService(target, "configForms");
          if (next !== void 0 && typeof next.whileServed === "function" && installWatch(next, target)) return;
          const lateScope = nativeForm(target);
          if (lateScope !== void 0) seat(lateScope);
        });
      } catch {
      }
    }
    return;
  }
  const family = binder();
  if (family !== void 0) {
    const scoped = bind(family) ?? nativeForm();
    if (scoped !== void 0) {
      seat(scoped);
      return;
    }
  }
  const native = nativeForm();
  if (native !== void 0) {
    seat(native);
    return;
  }
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["webUiSettings"], () => {
        if (seated) return;
        const late = binder();
        const scoped = late !== void 0 ? bind(late) : void 0;
        if (scoped !== void 0) seat(scoped);
      });
    } catch {
    }
    try {
      ctx.inject(["configForms"], (scope) => {
        const target = scope ?? ctx;
        const late = readService(target, "configForms");
        if (late !== void 0 && installWatch(late, target)) return;
        const lateScope = nativeForm(target);
        if (lateScope !== void 0) seat(lateScope);
      });
    } catch {
    }
  }
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
