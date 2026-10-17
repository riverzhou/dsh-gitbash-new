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

- MSYS2 的**模型回合**未单独跑；但 `discover` 返回 7 个 profile（Git + MSYS2 六个环境），
  `tests/integration-real.test.mjs` 已用真实 MSYS2 验证 `MSYSTEM=UCRT64`、PATH 隔离、
  退出码、stderr、子进程与超时。
- read-only / strict / 提权审批未在真机 UI 点过；由单元测试覆盖决策表，
  真机行为需在正式安装后按 README 的权限表复核。
- `run_in_background` / promote 的 UI 卡片未在真机截图；job 逻辑由单元测试与官方 job 契约覆盖。
