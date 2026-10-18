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
  apply: () => apply,
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

// src/client/api.ts
async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (typeof payload !== "object" || payload === null) {
    throw new Error(`unexpected response from ${path}`);
  }
  const record = payload;
  if (record.ok === false) throw new Error(typeof record.error === "string" ? record.error : `request failed: ${path}`);
  if (!response.ok) throw new Error(`request failed: ${path} (${response.status})`);
  return payload;
}
function fetchState() {
  return post(ROUTE_STATE, {});
}
function fetchDiscover(savedPath, msystem) {
  return post(ROUTE_DISCOVER, { savedPath, msystem });
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
function normalizeConfigPath(value) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (first === '"' && last === '"' || first === "'" && last === "'") return trimmed.slice(1, -1).trim();
  return trimmed;
}
function configOf(value) {
  const record = typeof value === "object" && value !== null ? value : {};
  return {
    bashPath: typeof record.bashPath === "string" ? normalizeConfigPath(record.bashPath) : "",
    msystem: typeof record.msystem === "string" ? record.msystem : "auto",
    compat: typeof record.compat === "string" ? record.compat : "auto"
  };
}
function createRowController(scope) {
  const store = createStore({
    status: "loading",
    scopeStatus: scope?.getSnapshot().status ?? "unavailable",
    writable: scope?.getSnapshot().writable ?? false,
    platform: "",
    config: configOf(scope?.getSnapshot().value),
    capability: DEFAULT_CAPABILITY,
    candidates: [],
    discovered: false,
    saving: false,
    discovering: false,
    validating: false
  });
  let disposed = false;
  const applyState = (state) => {
    const snapshot = scope?.getSnapshot();
    store.setState({
      status: "ready",
      scopeStatus: snapshot?.status ?? "unavailable",
      writable: snapshot?.writable ?? false,
      platform: state.platform,
      config: snapshot?.value !== void 0 ? configOf(snapshot.value) : {
        bashPath: state.bashPath,
        msystem: state.msystem,
        compat: state.compat
      },
      ...state.effective !== void 0 ? { effective: state.effective } : { effective: void 0 },
      ...state.problem !== void 0 ? { problem: state.problem } : { problem: void 0 },
      candidates: state.candidates.length > 0 ? state.candidates : store.getState().candidates,
      ...state.recommended !== void 0 ? { recommended: state.recommended } : {},
      discovered: true,
      error: void 0,
      capability: state.capability,
      ...state.lastReplace !== void 0 ? { lastReplace: state.lastReplace } : { lastReplace: void 0 }
    });
  };
  const refresh = async () => {
    try {
      const state = await fetchState();
      if (disposed) return;
      applyState(state);
    } catch (error) {
      if (disposed) return;
      store.setState({ status: "error", error: messageOf(error) });
    }
  };
  const start = () => {
    disposed = false;
    const unsubscribers = [];
    if (scope !== void 0) {
      const sync = () => {
        const snapshot = scope.getSnapshot();
        store.setState({
          scopeStatus: snapshot.status,
          writable: snapshot.writable,
          ...snapshot.value !== void 0 ? { config: configOf(snapshot.value) } : {}
        });
      };
      sync();
      unsubscribers.push(scope.subscribe(sync));
    }
    void refresh();
    return () => {
      disposed = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  };
  const save = async (patch) => {
    if (scope === void 0) throw new Error("settings form unavailable");
    store.setState({ saving: true, error: void 0 });
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
      store.setState({ config: { ...store.getState().config, ...patch }, saving: false, notice: void 0 });
      await refresh();
    } catch (error) {
      store.setState({ saving: false, error: messageOf(error) });
      throw error;
    }
  };
  const setConfig = async (patch) => {
    try {
      await save(patch);
    } catch {
    }
  };
  const discover = async () => {
    store.setState({ discovering: true, error: void 0, notice: void 0 });
    const { config } = store.getState();
    try {
      const result = await fetchDiscover(config.bashPath, config.msystem);
      if (disposed) return;
      store.setState({
        discovering: false,
        discovered: true,
        candidates: result.candidates,
        ...result.recommended !== void 0 ? { recommended: result.recommended } : { recommended: void 0 },
        ...result.notes.length > 0 ? { notice: result.notes.join("; ") } : {}
      });
      await refresh();
    } catch (error) {
      if (disposed) return;
      store.setState({ discovering: false, error: messageOf(error) });
    }
  };
  const validate = async () => {
    store.setState({ validating: true, error: void 0, notice: void 0 });
    const { config } = store.getState();
    const path = config.bashPath.length > 0 ? config.bashPath : store.getState().effective?.path ?? "";
    try {
      const result = await fetchValidate(path, config.msystem);
      if (disposed) return;
      if (result.problem !== void 0) {
        store.setState({ validating: false, error: result.problem, effective: void 0 });
      } else {
        store.setState({ validating: false, effective: result.profile, notice: "bash --version OK" });
      }
    } catch (error) {
      if (disposed) return;
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
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}

// src/client/row.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var MSYSTEM_OPTIONS = ["auto", "UCRT64", "MINGW64", "CLANG64", "CLANGARM64", "MINGW32", "MSYS"];
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
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: 600, fontSize: 14 },
  subtitle: { opacity: 0.65, lineHeight: 1.4, fontSize: 12 },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label: { minWidth: 62, opacity: 0.75, fontSize: 12 },
  select: {
    minWidth: 220,
    maxWidth: "100%",
    padding: "4px 7px",
    border: "1px solid color-mix(in srgb, currentColor 22%, transparent)",
    borderRadius: 6,
    background: "transparent",
    color: "inherit",
    fontSize: 12
  },
  input: {
    flex: 1,
    minWidth: 220,
    padding: "4px 8px",
    border: "1px solid color-mix(in srgb, currentColor 22%, transparent)",
    borderRadius: 6,
    background: "transparent",
    color: "inherit",
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
    fontSize: 12
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
  error: { color: "#e5484d", fontSize: 12, lineHeight: 1.45 },
  badge: {
    border: "1px solid color-mix(in srgb, currentColor 20%, transparent)",
    borderRadius: 999,
    padding: "0 8px",
    fontSize: 11,
    opacity: 0.85,
    whiteSpace: "nowrap"
  },
  summary: { cursor: "pointer", opacity: 0.75, fontSize: 12 },
  detailsBody: { display: "grid", gap: 8, paddingTop: 8 },
  status: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "1px 10px", fontSize: 11, opacity: 0.8 },
  code: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }
};
function profileLabel(profile) {
  const base = profile.flavor === "git" ? "Git for Windows" : profile.flavor === "msys2" ? `MSYS2 ${profile.msystem ?? "MSYS"}` : "Cygwin";
  return profile.version !== void 0 ? `${base} ${profile.version}` : base;
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
  const disabled = !state.writable || state.saving || state.discovering;
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.card, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.title, children: t("title") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.subtitle, children: t("subtitleShort") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.badge, title: state.effective?.path, children: state.effective?.label ?? t("noPath") })
    ] }),
    !state.writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.muted, children: state.scopeStatus === "unavailable" ? t("unavailable") : t("readOnly") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.label, children: t("shell") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "select",
        {
          style: styles.select,
          value: selectedValue,
          disabled,
          onChange: (event) => choose(event.target.value),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: AUTO, children: t("autoRecommended") }),
            candidates.map((profile) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: profile.id, disabled: !profile.valid, children: [
              profileLabel(profile),
              profile.valid ? "" : ` \u2014 ${profile.problem ?? t("invalidPath")}`
            ] }, profile.id)),
            selectedValue === MANUAL ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: MANUAL, children: [
              t("manualPath"),
              ": ",
              state.config.bashPath
            ] }) : null
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: styles.button, disabled, onClick: () => void controller.discover(), children: state.discovering ? t("refreshing") : t("refresh") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.label, children: t("compat") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "select",
        {
          style: styles.select,
          value: compat,
          disabled: !state.writable || state.saving,
          onChange: (event) => void controller.setConfig({ compat: event.target.value }),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "auto", children: t("compatAuto") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "strict", children: t("compatStrict") })
          ]
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
    state.error !== void 0 || state.problem !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.error, children: state.error ?? state.problem }) : null,
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
                  spellCheck: false,
                  disabled: !state.writable || state.saving,
                  onChange: (event) => setDraftPath(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter") void controller.setConfig({ bashPath: draftPath.trim() });
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: styles.buttonPrimary, disabled, onClick: () => void controller.setConfig({ bashPath: draftPath.trim() }), children: t("apply") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: styles.button, disabled, onClick: () => void controller.resetAuto(), children: t("reset") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: styles.button, disabled: disabled || state.validating, onClick: () => void controller.validate(), children: state.validating ? t("testing") : t("test") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.label, children: t("msystem") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "select",
                {
                  style: styles.select,
                  value: state.config.msystem,
                  disabled: !state.writable || state.saving,
                  onChange: (event) => void controller.setConfig({ msystem: event.target.value }),
                  children: MSYSTEM_OPTIONS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option, children: option === "auto" ? t("msystemAuto") : option }, option))
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
            state.notice !== void 0 && state.error === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.muted, children: state.notice }) : null
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
    bashPath: typeof record.bashPath === "string" ? record.bashPath : "",
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
function apply(ctx) {
  const locale = ctx.get("locale");
  registerLocale(ctx, locale);
  const t = locale?.bind(LOCALE_NS) ?? ((key) => key);
  const slots = ctx.get("slots");
  if (slots === void 0 || slots === null || typeof slots.inject !== "function") return;
  const binder = () => {
    const candidate = ctx.get("webUiSettings") ?? ctx.get("settingsScope");
    return candidate !== void 0 && candidate !== null && typeof candidate.bind === "function" ? candidate : void 0;
  };
  const nativeForm = () => {
    const forms = ctx.get("configForms");
    if (forms === void 0 || forms === null || typeof forms.get !== "function") return void 0;
    try {
      return forms.get(SETTINGS_NAMESPACE);
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
  const seatRow = (scope) => {
    if (seated) return;
    seated = true;
    slots.inject("settings.general.item", () => slots.register(
      { name: "settings.general.item", id: GENERAL_ITEM_ID, order: GENERAL_ITEM_ORDER, locale: LOCALE_NS },
      () => (0, import_react2.createElement)(TerminalToolRow, { t, scope })
    ));
  };
  const family = binder();
  if (family !== void 0) {
    const scoped = bind(family) ?? nativeForm();
    if (scoped !== void 0) {
      seatRow(scoped);
      return;
    }
  }
  const native = nativeForm();
  if (native !== void 0) {
    seatRow(native);
    return;
  }
  if (typeof ctx.inject === "function") {
    ctx.inject(["webUiSettings"], () => {
      if (seated) return;
      const late = binder();
      if (late !== void 0) seatRow(bind(late));
    });
    ctx.inject(["configForms"], () => {
      if (seated) return;
      const late = nativeForm();
      if (late !== void 0) {
        seatRow(late);
        return;
      }
      const forms = ctx.get("configForms");
      if (typeof forms?.whileServed === "function") {
        try {
          forms.whileServed([SETTINGS_NAMESPACE], () => {
            if (seated) return;
            const served = nativeForm();
            if (served !== void 0) seatRow(served);
          });
        } catch {
        }
      }
    });
  }
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
