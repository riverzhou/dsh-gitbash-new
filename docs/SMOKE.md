# 真机冒烟记录 — 2026-10-18

> 目标：在**真实的 DSH 0.2.1-rc.2** 里验证插件加载、设置路由、per-agent 替换、
> 模型工具目录、bash 执行与 `meta.cwd`。不是单元测试的替代品；可复跑。

## 环境

| 项 | 值 |
|---|---|
| DSH | `0.2.1-rc.2`（Desktop 自带 CLI：`resources/runtime/cli/bin/dsh.cmd`） |
| OS | Windows 10 19045 x64 |
| Git for Windows | 2.56.0；bash 5.3.15 |
| MSYS2 | 5.3.20（UCRT64） |
| 测试 profile | `gitbash-test-web`（从 `web` 模板创建，bundles = base + web-app + dsh-gitbash） |
| 服务 | `http://127.0.0.1:55999`（独立端口，不影响桌面 55824） |

## 复跑步骤

> 原始测试 profile `gitbash-test-web` 已清理；复跑时先用 web 模板新建一个 profile，
> 把本仓库 `link:` 进去，端口可自选。下面的命令保留当时的 URL/cookie 形式，token
> 已过期，仅作为流程证据。


```bat
:: 1. 从 web 模板创建测试 profile（只需一次）
dsh --profile gitbash-test-web --from-default-profile web --dump-config

:: 2. 链接本仓库
dsh plugin --profile gitbash-test-web add link:D:/GitHub/dsh-gitbash-new

:: 3. 启动独立 Web 服务
dsh --profile gitbash-test-web --port 55999 --no-open
```

浏览器打开打印出来的 `?token=...` URL（或 curl 先取 cookie），然后：

```bash
# state：插件加载 + profile 发现 + 路由
curl -b cookie -X POST http://127.0.0.1:55999/api/dsh-gitbash/state \
  -H 'content-type: application/json' -d '{}'

# 创建会话（触发 agent/created → 替换）
curl -b cookie -X POST http://127.0.0.1:55999/api/session/create \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"smoke-create","method":"session/create","payload":{"args":{"request":{}}}}'

# 发一个只让模型调用 bash 的 prompt
curl -b cookie -X POST http://127.0.0.1:55999/api/session/prompt \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"smoke-prompt","method":"session/prompt","payload":{"args":{"request":{"requestId":"smoke-1","sessionId":"<id>","mode":"queue","content":[{"type":"text","text":"Call the bash tool with command exactly \\"echo LIVE_BASH_OK\\", description \\"live bash smoke\\", then report the exact stdout."}],"clientTimeZone":"Asia/Shanghai"}}}}'
```

再用 `session/page`（`throughSeq` 取 `session/list` 的 `asOfSeq`）读取事件。

## 观察结果

### 1. 插件加载与 profile 发现

`/api/dsh-gitbash/state` 返回（节选）：

```json
{
  "ok": true,
  "platform": "win32",
  "settingsAvailable": true,
  "capability": {
    "supported": true,
    "shellSandboxMode": "workspace-write",
    "backgroundJobs": true,
    "bashAvailable": true
  },
  "effective": {
    "id": "git|c:\\program files\\git|MINGW64",
    "flavor": "git",
    "path": "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "msystem": "MINGW64",
    "valid": true
  },
  "lastReplace": { "at": 1792281296408, "applied": true }
}
```

诊断日志：

```text
apply: pid=... settings={"bashPath":"","msystem":"auto","compat":"auto"}
discover: 7 profile(s), recommended=git|c:\program files\git|MINGW64
routes: registered /api/dsh-gitbash/state
routes: registered /api/dsh-gitbash/discover
routes: registered /api/dsh-gitbash/validate
replace: applied agent=session-... profile=git|c:\program files\git|MINGW64 compat=auto
```

### 2. 模型工具目录

`request/header.tools` 中出现 `name: "bash"`；**没有 `pwsh`**（整个事件流 `pwsh` 命中 0 次）。
`bash.parameters` 是标准 JSON Schema（`required: ["command","description"]`）。
`system/message` 只包含 `tool:bash` 与 `tool:bash:windows`，没有 PowerShell 提示词。

### 3. 工具调用与结果

模型调用：

```json
{ "name": "bash", "arguments": "{\"command\": \"echo LIVE_BASH_OK\", \"description\": \"live bash smoke\"}" }
```

工具结果（`tool/result`）：

```json
{
  "content": [{ "type": "text", "text": "LIVE_BASH_OK\n[compat: Git Bash runs outside the DSH file sandbox (session mode workspace-write)]" }],
  "isError": false,
  "meta": { "cwd": "D:\\GitHub\\dsh-gitbash-new" }
}
```

- `LIVE_BASH_OK` 是真实 stdout。
- `[compat: ...]` 是**部署提示**，不是 stderr；模型回复中把它称为 “trailing note on stderr”，但它来自我们的渲染器，位于 stdout 之后。
- `meta.cwd` 是绝对 Windows 路径（Web 终端卡片依赖它）。
- `turn/end` = `completed`；`tool/result.isError=false`。

助手最终回复（节选）：

```text
The bash tool executed successfully.
**Exact stdout:** `LIVE_BASH_OK`
```

## 未覆盖 / 后续

> 本节记录**首次冒烟（仅 Git 直接调用）时**的状态。其中 MSYS2 模型回合、
> 两套环境的后台任务/子智能体、UI 卡片都已在下方“追加”节覆盖。

- read-only / strict / 提权审批仍未在真机 UI 点过；由单元测试覆盖决策表，
  正式安装后按 README 的权限表复核。
- `job_kill` / 超时 promote 的 UI 未在本轮单独点过；job 逻辑由单元测试与官方
  job 契约覆盖。
- 截图中的 `[compat: Git Bash ...]` 是当时文本；当前实现已泛化为
  `[compat: bash ...]`，机制与位置不变。

---

## 追加：Git / MSYS2 全链路 + UI 显示（2026-10-18 08:0x）

测试 profile：`gitbash-e2e`（web 模板 + `link:D:/GitHub/dsh-gitbash-new`），端口 `56001`；
模型 `deepseek-flash`；每个场景独立会话，避免历史串扰。

### 结果矩阵

| 场景 | Git for Windows | MSYS2 UCRT64 |
|---|---|---|
| 直接 bash | ✅ `GIT_OK` / `MSYSTEM=MINGW64` | ✅ `MSYS2_OK` / `MSYSTEM=UCRT64` |
| 后台任务 | ✅ job `bash-2928682190734a06`；`job_output(wait=true)` → `BG_OK` + `completed, exit code: 0` | ✅ job `bash-f3faa97635d24518`；同样 `BG_OK` |
| 子智能体 | ✅ child `941bee08-9491-4697-af47-62e832080c72`；child bash → `SUBAGENT_GIT_OK` | ✅ child `964108f7-a4e1-462d-a454-3107b1710176`；child bash → `SUBAGENT_MSYS2_OK` |
| 子会话工具目录 | ✅ `bash` 在、`pwsh` 不在 | ✅ 同左 |
| `meta.cwd` | ✅ `D:\GitHub\dsh-gitbash-new` | ✅ 同左 |

后台事件（Git 示例）：

```text
job/registered  jobId=bash-2928682190734a06  owner=session-5844...  kind=bash
                toolCall={ callId: call_00_SlL..., rootCallId: call_00_SlL... }
job/settled     status=completed  cause=producer  detail="exit code: 0"
```

子智能体（Git 示例）：

```text
parent tool/call    subagent { description: "subagent bash smoke", prompt: "..." }
parent tool/result  started subagent 941bee08-...
parent catalog      [{ id: 941bee08-..., mode: continuable, label: "subagent bash smoke" }]
child tool/call     bash { command: "echo SUBAGENT_GIT_OK" }
child tool/result   "SUBAGENT_GIT_OK\n[compat: ...]"  meta.cwd=D:\GitHub\dsh-gitbash-new
child send_message  -> parent session-dce...
parent notice       子代理收尾消息原文照录，含 SUBAGENT_GIT_OK
```

MSYS2 子智能体同样走 `subagent` → child `964108f7-...` → `bash` → `SUBAGENT_MSYS2_OK`
→ `send_message` 回父会话；父会话第二轮通知里出现结果。

### Git `bin` launcher 的修复

真机首次把 `msystem: auto` + `bashPath: C:\Program Files\Git\bin\bash.exe` 组合时，
子进程里 `MSYSTEM` 仍是 `UCRT64`。定位：Git 2.56 的 `bin\bash.exe` 是 launcher，
会按安装自带的 UCRT64 重置 `MSYSTEM`/PATH，覆盖我们传入的 `MINGW64`；
`usr\bin\bash.exe` 才遵守环境。

修复：`profileFromPath` 对 Git 的 `bin\bash.exe` 自动归一化到 `usr\bin\bash.exe`
（存在时）。修复后同一配置实测 `MSYSTEM=MINGW64`。

### UI 显示验证

- 设置页：`账号菜单 → 设置 → 通用设置`，截图 `docs/images/settings-row.png`；
  折叠态只有 Shell 选择、兼容选择、一行红字警告；高级/诊断折叠。
- 在 UI 的 Shell 下拉里实际切换到 Git，读回 `/api/dsh-gitbash/state`：
  `effective.id=git|...|MINGW64`、`bashPath=C:\Program Files\Git\usr\bin\bash.exe`、
  `msystem=MINGW64`；再切回 MSYS2 UCRT64，读回一致。说明设置表单写入/刷新链路正常。
- UI 会话（MSYS2）标题栏显示 `1 个子智能体`、`1 个后台任务`；
  展开工作步骤后可见：
  - `运行命令 · UI background smoke` 卡片：`dsh-gitbash-new  sleep 2; echo UI_BG_OK`；
  - `读取任务输出 · bash-... · 已完成`；
  - `已协调子智能体并调用工具` / `创建子智能体 · ... · 已启动` / `查看子智能体 · 1 个智能体`。
- 截图：`docs/images/ui-session-summary.png`、`ui-background-card.png`、`ui-subagent-card.png`。
- Git 的 UI 卡片未单独截图；工具名、参数、结果标记、`meta.cwd` 与 MSYS2 完全同形
  （同一 `bash` 工具定义），事件层已逐条核对。
