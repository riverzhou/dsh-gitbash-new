# dsh-gitbash 设计文档

> 状态：**已定稿（2026-11-06）**。实现以本文为准；契约改动必须先改本文。
> 基线：DSH `0.2.2-rc.1`（桌面运行时 + 源码 checkout 双重核对）。最低支持 `0.2.2`。

---

## 1. 目标与边界

### 1.1 目标

在 Windows 上把 DSH 的模型终端工具从官方 `pwsh` 换成 **bash**，并保留官方终端工具的全部行为。bash 来源**同时支持并可选**：

- **Git for Windows**（`C:\Program Files\Git` 等，默认优先）；
- **MSYS2**（`C:\msys64` 等，可选 `UCRT64` / `MINGW64` / `CLANG64` / `CLANGARM64` / `MINGW32` / `MSYS` 环境）。

两套系统的 `MSYSTEM`、`PATH`、环境根不同，插件按“shell profile”区分，而不是只换一个 `bash.exe` 路径。

- 新会话的模型工具目录里只有 `bash`，没有 `pwsh`；`tool:pwsh` 提示词被压掉。
- `command` / `description` / `timeoutMs` / `workdir` / `run_in_background` / 沙箱提权的参数与语义与官方 `tool-bash` 对齐。
- 前台任务可被 `job_kill` 停止；超时转后台（promote）与官方一致。
- cwd 跟随 `workingDirectory`（会话里的 `cd`）；`tool/result.meta.cwd` 写入真实执行目录。
- 结果文本、退出码标记、终端卡片、PTC 目录与官方 `tool-bash` 对齐。
- 设置页默认只显示 Shell 选择、兼容模式与一行安全提示；路径/自动发现/测试/MSYS2 环境/诊断折叠在“高级与诊断”；配置持久化、简单。
- 只支持 Windows；非 win32 不注册任何行为。

### 1.2 非目标

- 不改 DSH 源码/安装文件，不 fork preset，不接管 `ctx.shell`（pwsh 保留给内部调用/其它工具）。
- 不自动选择 WSL 的 `bash.exe`；不把 WSL 当 Git Bash。
- **Cygwin** 只做“可识别、默认不推荐”的 best-effort（不在首批验收范围；发现列表里标记为 experimental）。
- 不在本仓库实现持久 PTY（`minimal` preset 的 persistent shell 不保留；本插件是 one-shot `bash -c`）。

---

## 2. 平台硬约束（必须如实面对）

### 2.1 实测结论

Git Bash（MSYS2 运行时）**无法在 DSH 官方 Windows ACL 沙箱里启动**。本机实测（0.2.1-rc.2，Windows 10 19045）：

| 令牌 | 结果 |
|---|---|
| 官方受限令牌（WRITE_RESTRICTED + restricting SIDs） | `bash.exe`: `*** fatal error - CreateFileMapping S-1-5-21-…-1001.1, Win32 error 5`；`ls.exe`: `NtCreateDirectoryObject(\BaseNamedObjects\msys-2.0S5-…) 0xC0000022`；MSYS2 bash: `couldn't create signal pipe, Win32 error 5`。**且 `bash.exe` 可能以 exit 0 结束、无输出**。 |
| 受限令牌 + 当前用户 SID 加入 restricting 列表 | bash 可运行；但**用户拥有的工作区外文件也可写/可删**（实测 `C:\Users\River\...` 写入成功）——沙箱被实质击穿。 |
| 上述令牌再降到 Low 完整性 | bash 又死在 `BaseNamedObjects` 创建（`0xC0000022`）。 |

根因是 MSYS2 启动时必须创建**带当前用户 SID 的命名对象**（共享内存、signals 管道、`BaseNamedObjects` 子目录）；WRITE_RESTRICTED 令牌把这些 SID 标成 deny-only，Low 完整性又禁止向 Medium 的对象命名空间写入。二者不可兼得。

**0.2.2 复核（源码级）**：DSH 0.2.2 只从 `CreateRestrictedToken` 去掉了 `LUA_TOKEN`，仍保留 `DISABLE_MAX_PRIVILEGE | WRITE_RESTRICTED` 与 restricting SIDs（提交 `bdd75ca1a0`，`packages/sandbox/sandbox-windows-acl/src/token.ts`）。去 `LUA_TOKEN` 解决的是内置 Administrator 无法启动进程的问题，不改变上面的命名对象冲突。本插件**未**在 0.2.2 上重跑“受限令牌启动 MSYS2”实验；安全结论沿用 0.2.1-rc.2 的实测，不据此宣称 0.2.2 可沙箱化。

### 2.2 决策：体验优先 + 显式标注

所有者 2026-10-18 拍板：**体验优先**。因此：

- `danger-full-access`：bash 正常执行。
- `workspace-write`：**默认**仍启用 bash，但以**完全访问**执行；设置页红字警告；结果文本与 `sandbox.mode` 如实写 `danger-full-access`。
- `read-only`：**拒绝执行**，并给出可操作提示（切到更宽模式 / 用官方 `sandbox_permissions` 提权）。read-only 的“不写入”承诺不能被悄悄破坏。
- `strict` 模式（可选）：`workspace-write` 下也拒绝，仅 `danger-full-access` 可用。给安全敏感用户。
- **绝不静默降级**：每次 bash 结果都带一行说明“本次以完全访问执行”；设置页常驻红字；工具描述与 system prompt 都写清。
- 文件工具（`read`/`write`/`edit`/`glob`/`grep` 等）**仍由官方沙箱保护**，不受本插件影响。

> 这就是本插件唯一的安全代价，也是 Windows 上所有可用 Git Bash 插件的共同代价；本插件的区别是把代价**显式化、可关闭、可审计**，而不是偷偷绕过。

---

## 3. 总体架构

```text
agent/created (serial, awaited)
  └─ 在 agent.ctx 里（每个会话独立，子代理继承后跳过）
       ├─ tools.restrict({ deny: ['pwsh'] })      隐藏 preset 注册的 pwsh
       ├─ tools.register(bashTool)                 注册本插件的 bash
       └─ systemPrompt.section(...)                压掉 tool:pwsh，写 tool:bash
                                                            │
bashTool.execute ──► resolve cwd ──► resolve sandbox mode ──► spawn bash -c
       │                                      │
       │                                      └─ danger-full-access / compat → 不 confine
       ├─ ctx.jobs.start / wait / read / kill / remove（后台、前台可见、promote）
       ├─ ctx.subprocess.spawn（collect stdout/stderr、spill、grace、terminate）
       └─ output.render + presentationMeta.cwd（终端卡片 / PTC / meta）
```

### 3.1 为什么用 `agent/created` + scoped `tools.restrict`

- DSH 0.2.2 的 preset 是 `@deepseek-ai/dsh-web-app` 的 patch 文件；没有受支持的“改一个 preset 的某一行”的插件 API（`preset:` patch 只有文档没有实现）。重述整个 preset 会把未来官方新增的行全部丢掉。
- `agent.ctx.tools.restrict({ deny: ['pwsh'] })` 是官方 per-agent 作用域机制，只过滤**继承来的**工具，不影响 host / 其他 agent / 子代理（子代理继承父层结果后，`restrict` 因“未知工具”抛错，直接跳过）。
- `systemPrompt.section({ name: 'tool:pwsh', text: '' })` 同名 scoped section 会 shadow 外层；空文本被丢弃。
- 监听器在 `agent/created` 上是 **serial + awaited**，注册在返回前完成，模型第一轮就能看到 bash。
- 设置只在**新会话**读取一次（运行中的会话不换工具/提示词，避免 KV cache 与历史工具调用错位）。

### 3.2 模块划分

```text
src/
├── index.ts                 # host 半区入口：apply、Config、设置读取、路由/替换装配
├── shared/
│   └── protocol.ts          # host/client 共享的 wire 常量与类型（单一事实来源）
├── host/
│   ├── settings.ts          # Config（schemastery、volatile）+ 解析/校验
│   ├── discover.ts          # Git/MSYS2/Cygwin profile 发现、WSL 排除、环境枚举、校验、版本探测
│   ├── env.ts               # profile 专属 MSYSTEM/PATH/ENV 覆盖、POSIX↔Windows 路径
│   ├── escalation.ts        # 官方 escalation 语义的本地窄化实现（逐字）
│   ├── executor.ts          # ctx.subprocess.spawn 封装：deadline、collect、kill、result
│   ├── jobs.ts              # processSources / processJob / ringDelta / promote
│   ├── render.ts            # 结果文本、退出码标记、截断、兼容模式提示
│   ├── bash-tool.ts         # defineTool 等价定义：params/output/execute/present*
│   ├── replace.ts           # agent/created：restrict + register + prompt shadow
│   └── routes.ts            # /api/dsh-gitbash/{state,discover,validate}
└── client/
    ├── index.ts             # 注册 settings.general.item
    ├── row.tsx              # 设置行 UI
    ├── store.ts             # configForms + /api 状态
    ├── locales.ts           # zh/en
    └── types.ts             # 客户端契约窄化
```

---

## 4. 契约（0.2.2）

### 4.1 替换

- 事件：`agent/created`，payload `{ agent, source, signal? }`；监听器可 async，serial。
- 能力探测（缺一即跳过，不抛）：
  - `process.platform === 'win32'`
  - `agent.ctx` 存在
  - `agent.ctx.get('tools')` 的 `register` / `restrict` 是函数
  - `agent.ctx.get('systemPrompt')` 的 `section` 是函数
  - host `ctx.get('subprocess')?.spawn` 是函数
  - host `ctx.get('sandboxPolicy')?.resolve` 是函数（缺它则 bash 无法判定会话模式，宁可保留 pwsh 也不注册一个必然失败的 bash）
- 动作顺序（失败全部回滚）：
  1. `tools.restrict({ deny: ['pwsh'] })`（抛错 = 该 agent 已无 pwsh，跳过）
  2. `tools.register(bashTool)`
  3. `systemPrompt.section({ name: 'tool:pwsh', order: getSectionOrder('TOOL_PWSH'), text: '' })`
  4. `systemPrompt.section({ name: 'tool:bash', order: getSectionOrder('TOOL_BASH'), text: <官方那句> })`
  5. compat 模式追加一段 `tool:bash:windows` 安全提示
- 所有 disposer 注册到 `agent.ctx.effect`；`agent/created` 本身在 agent 释放时自动解绑。

### 4.2 工具参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `description` | string, required | 5–10 词主动语态描述（UI 展示） |
| `command` | string, required | bash 命令（`bash -c`） |
| `timeoutMs` | number | 执行器默认 120000、上限 600000；job 注册表可用时超时转后台 |
| `workdir` | string | 绝对或相对会话 cwd；相对路径按会话 cwd 解析 |
| `run_in_background` | boolean | 仅在 jobs 可用时出现；无超时 |
| `sandbox_permissions` | enum `workspace-write`/`danger-full-access` | 仅在 `ctx.shell.sandboxMode` 与 `ctx.sandboxPolicy` 都存在时出现 |
| `justification` | string | 与 `sandbox_permissions` 成对，非空一句 |

参数根是开放的（未知键被忽略）；执行只读命名字段。

> **Schema 形态（真机踩过）**：`parameters` 与 `output.schema` 都是**标准 JSON Schema**
> —— `required` 是**数组**，写在对象节点上；叶子节点不写 `required: true`。
> 官方工具用 `defineTool` 的 DSL（叶子 `required: true`）并在注册时编译；本插件无法 import
> `defineTool`，返回普通对象，**不能依赖那次编译**。真机曾因此报
> `Invalid schema for function 'bash'`；测试需断言 `parameters.type === 'object'`、
> `parameters.required` 是数组、`output.schema.oneOf` 的每个分支 `required` 是数组。

### 4.3 结果值（closed oneOf）

输出 schema 与参数一样是**标准 JSON Schema**；三个分支都 `additionalProperties: false`，
`required` 是数组。`compat` / `sessionMode` 是本插件附加的可选字段（Web UI 忽略未知字段，
PTC SDK 可见），用于在结果里携带兼容模式事实。

```ts
type BashValue =
  | { kind: 'background'; jobId: string; cwd: string }
  | { kind: 'promoted'; cwd: string; jobId: string; timeoutMs: number; output: string }
  | { kind: 'foreground'; cwd: string; exitCode: number | null; signal: string | null;
      timedOut: boolean; aborted: boolean; stopped?: string; timeoutMs: number;
      stdout: { text: string; truncated: boolean; spillPath?: string };
      stderr: { text: string; truncated: boolean; spillPath?: string };
      sandbox?: { mode: string; denied: boolean; enforcement?: string; runnerFailed?: boolean } }
```

- `output.presentationMeta(args, value) => ({ cwd: value.cwd })`，0.2.2 会写入 `tool/result.meta`；Web 终端卡片优先读它。
- `output.render` 产出**恰好一个 text block**：
  - background：`started background job <id>`
  - promoted：`<output>\n[still running after <t>ms; moved to background job <id>]`（0.2.2 删掉了旧的 “The command keeps running…” 交接句；如何跟进由 `tool:jobs` prompt section 负责。本插件逐字对齐，compat 提示仍在该标记之前）
  - foreground：stdout + `[stderr]` 段 + 标记行
- 标记（逐字）：`[exit code: N]`、`[killed by signal: X]`、`[timed out after Nms]`、`[stopped: reason]`、`[sandbox: file access denied under <mode> mode]`、`[sandbox: escalation available — retry this exact command once with sandbox_permissions ...]`。
- **0.2.2 Web UI 不消费 `presentCall`/`presentResult`**；卡片由工具名 `bash`、参数、结果文本标记、`meta.cwd` 反推。presenter 仍实现，供外部 UI bridge。

### 4.4 执行器语义

- `ctx.subprocess.spawn({ argv: [bashPath, '-c', command], cwd, stdio: { stdin:'ignore', stdout: collect(64_000, spill 64 MiB), stderr: collect(64_000, spill 64 MiB) }, graceMs: 3000, signal, env })`。
- 超时：`onExpiry:'kill'`（无 jobs / 前台）用定时器 + `terminate()`；`onExpiry:'none'`（jobs promote）交给 `jobs.wait`。
- 首因分类：`timedOut` 与 `aborted` 互斥；abort 先到就是 aborted。
- 进程结束分类：`signal !== null` → killed；否则 completed。
- **Windows 信号归一化**：Git Bash/MSYS2 被信号杀死时，Windows 退出码是
  `signalNumber << 8`（`SIGTERM` → 3840，`SIGKILL` → 2304），而 Node 在 Windows
  上始终报 `signal: null`。执行器把 `>255` 且低 8 位为 0 的退出码按
  `os.constants.signals` 反查为信号名，`exitCode` 置 null；正常 bash `exit N`
  被截断到 0..255，`0xC0000005` 等崩溃码低位非 0，仍按退出码报告。
- 输出：`readFrom(0)`；`truncated = lossy`；`spillPath` 透传；stdout/stderr 分段合并。
- **启动失败检测**：exit 0 但 stderr 命中 `*** fatal error - ` / `couldn't create signal pipe` → 视为启动失败（`exitCode` 改 1 + 说明），防止 MSYS2 的 exit-0 假成功。
- 生成失败（ENOENT/EACCES）→ 明确错误："Git Bash 无法启动：<path>；请在设置里重新发现/校验路径"。

### 4.5 Jobs

- `kind: 'bash'`（官方 `JobKindMap` 已有）；`label` = 原始 command；`owner` = `agent.id`；`toolCall: { callId, rootCallId }`；`output` = 懒读取的 stdout/stderr 两个 source。
- 前台在有 jobs 时也注册为 job（可在运行中被 kill）；在 wait 内 settle → `remove`，模型看不到 id。
- wait 超时且进程已启动 → `promoted`：做**一次** consuming `read` 作为已产生输出，job 继续跑。
- wait 超时但进程还没启动 → 合成 `foreground`：`timedOut:true, exitCode:null`，文本 `(no output)\n[timed out after <t>ms]\n[exit status unavailable]`。
- 前台走 job/promote 需要 registry 的 `start/wait/read/kill/remove` 齐全且 admission 成功；admission 失败 → warn + 退回 deadline kill。
- 后台取消：`AbortController` → `terminate()`；`done` 不 reject，异常映射为 `failed`。

### 4.6 沙箱模式解析

- `effective = ctx.sandboxPolicy.resolve({ session }).mode`；服务缺失或结果不是已知三模式 → **拒绝执行**（fail-closed），不会默认 `danger-full-access`。替换阶段也要求该服务存在，否则保留 pwsh。
- `sandbox_permissions` + `justification`：走官方提权语义（严格更宽、`ctx.approval.request`、固定文案）。批准后的 mode 只作用于本次调用。
- 本插件**不调用** `ctx.sandbox.confine`：MSYS2 在官方 ACL 令牌下无法启动。bash 以当前用户 Medium 令牌直接 spawn。
- 结果 `sandbox`：
  - 实际完全访问 → `{ mode: 'danger-full-access', denied: false }`
  - 文本追加 `[compat: bash runs outside the DSH file sandbox (session mode <mode>)]`（compat 时）
- read-only：抛错，提示升级到 `workspace-write`（compat 下仍以完全访问执行）或 `danger-full-access`；不得静默。

---

## 5. 发现与校验

### 5.1 Shell profile 模型（两套系统一等公民）

用户选的不是一个裸 `bash.exe`，而是一个 **shell profile**：

```ts
interface BashProfile {
  id: string                 // flavor|root|msystem 的稳定键
  flavor: 'git' | 'msys2' | 'cygwin'
  path: string               // bash.exe 绝对路径
  root: string               // 安装根：...\Git / ...\msys64 / ...\cygwin64
  msystem?: 'MINGW64' | 'UCRT64' | 'CLANG64' | 'CLANGARM64' | 'MINGW32' | 'MSYS'
  environmentRoot?: string   // MSYS2 的 ...\ucrt64 / ...\mingw64 / ...\usr
  label: string              // UI 文案：Git for Windows 2.56 / MSYS2 UCRT64
  version?: string
}
```

- **Git for Windows**：一个安装 = 一个 profile，`msystem='MINGW64'`，`path` 固定用 `<root>\usr\bin\bash.exe`。用户填 `<root>\bin\bash.exe` 时自动归一化到 `usr\bin`（Git 2.56 的 `bin` launcher 会把 `MSYSTEM` 重置为 UCRT64，必须绕开）。
- **MSYS2**：一个安装可枚举多个 profile（每个环境一个）：`UCRT64`、`MINGW64`、`CLANG64`、`CLANGARM64`、`MINGW32`、`MSYS`；`path` 都是 `<root>\usr\bin\bash.exe`，但 `msystem` 与 `environmentRoot` 不同。**两个 MSYS2 环境共用同一个 bash.exe，所以 `bashPath` 单独不足以区分，必须同时持久化 `msystem`。**
- **Cygwin**：best-effort，`flavor='cygwin'`，无 `MSYSTEM`；默认排在 Git/MSYS2 之后，UI 标注 experimental。

### 5.2 候选来源（按优先级）

1. 用户配置的 `bashPath` + `msystem`（最高优先；无效则**不**回退，明确报错）。
2. 注册表 `HKLM\SOFTWARE\GitForWindows` / `HKCU\SOFTWARE\GitForWindows` 的 `InstallPath` → Git profile。
3. 已知根：
   - Git：`%ProgramFiles%\Git`、`%ProgramFiles(x86)%\Git`、`%LocalAppData%\Programs\Git`、`C:\Git`、`D:\Git`；
   - MSYS2：`C:\msys64`、`D:\msys64`、`%LocalAppData%\msys64`、`C:\msys32`；
   - Cygwin：`C:\cygwin64`、`C:\cygwin`。
4. `where.exe git` → 从 `git.exe` 反推安装根（`usr\bin` 与 `ucrt64`/`mingw64`/`clang64`/... 环境 bin 都按三层推导）；`where.exe bash` → 每一行（排除 WSL 后）识别 flavor。手填 Git `bin\bash.exe` 会归一化到 `usr\bin`。
5. `PATH` 中每个目录下的 `bash.exe` / `git.exe`。

每个根先识别 flavor（MSYS2 marker 优先：`etc\msys2-release`、`msys2.exe`、`pacman.exe`、`mingw64\bin`；Git marker：`cmd\git.exe`、`mingw64\bin\git.exe`），再枚举 profile。按 `realpath + msystem + flavor` 去重。

### 5.3 硬排除

- `%WINDIR%\System32\bash.exe`、`Sysnative`、`WindowsApps\`、`\wsl$\`、任何 `wsl.exe`。
- 文件名必须是 `bash` / `bash.exe`（大小写不敏感）。
- 必须是真实存在的**文件**（不是目录/悬空链接）。
- MSYS2 profile 的 `environmentRoot\bin` 必须存在；否则该 profile 无效。

### 5.4 版本探测（只在“自动发现”/“测试”时）

- `spawnSync(path, ['--version'], { timeout: 2000, windowsHide: true })`。
- 成功输出匹配 `GNU bash, version X.Y.Z...`；记录版本。
- Git/MSYS2 的 `bash --version` 都写 `x86_64-pc-cygwin`，**不能靠版本字符串区分 flavor**；flavor 由安装 marker 判定。
- 失败 → 候选标记 `valid:false` + 原因；不阻断其它候选。
- **`/state` 路由不扫描、不 spawn**（设置行打开必须瞬时）。

### 5.5 路径与 cwd

- 绝对 POSIX 盘符路径 `/c/...`、`/d/...`、`/cygdrive/c/...` → 转 Windows `C:\...`（作为 spawn cwd / meta.cwd）。
- 相对路径 → `path.resolve(sessionCwd, workdir)`。
- `/tmp` → `os.tmpdir()`；其它非盘符绝对 POSIX 路径（`/home/...`）→ 明确报错，要求 Windows 路径（避免猜错 MSYS 映射）。
- `pwd` 在 bash 里仍是 `/d/...`；模型看到 POSIX，`meta.cwd` 是 Windows 绝对路径（Web UI 要求）。

### 5.6 环境（按 profile 区分）

- 公共：`NO_COLOR=1`、`TERM=dumb`、`PAGER=cat`、`GIT_PAGER=cat`、`CHERE_INVOKING=1`。
- **Git for Windows**：`MSYSTEM=MINGW64`；`PATH = <root>\bin;<root>\usr\bin`，再追加存在的 `<root>\ucrt64\bin` / `<root>\mingw64\bin` / `<root>\mingw32\bin`，最后 `<inherited>`。
- **MSYS2**：`MSYSTEM=<profile.msystem>`；`MSYS2_PATH_TYPE=inherit`；`PATH = <environmentRoot>\bin;<root>\usr\bin;<root>\usr\local\bin;<inherited>`；`MSYS` 环境则 `<root>\usr\bin;<root>\usr\local\bin;<inherited>`。
- **Cygwin**：不写 `MSYSTEM`；`PATH = <root>\bin;<inherited>`。
- `dshEnv = ctx.shellEnv.collect(exec)` 最后合并，保证 `DSH_*` 不被覆盖。
- **清除继承的 `PWD`/`OLDPWD`**：宿主进程可能导出 Windows 形式（如 `D:\work`）；
  bash 在 cwd 匹配时会信任它，导致 `$PWD`/`pwd` 变成 `D:/...`。`composeEnv`
  用显式 `undefined` tombstone 让 subprocess 服务删除这两个环境项，由 bash 从真实
  cwd 推导 POSIX 路径。
- 不覆盖 `HOME`、`TMP`、`TEMP`、`LANG`（尊重用户 dotfiles 与区域设置）。
- 若 `msystem` 与 path 的 flavor 不匹配（例如 Git 配 `UCRT64`），**拒绝执行**并提示重新选择，而不是猜。

### 5.7 选择与持久化

- Config：`bashPath`（空 = auto）+ `msystem`（`auto` 或具体值）。
- `auto` 的推导：Git → `MINGW64`；MSYS2 → 按存在的环境根优先 `UCRT64 > MINGW64 > CLANG64 > CLANGARM64 > MINGW32 > MSYS`；Cygwin → 空。
- “自动发现”的默认选中：Git for Windows 优先；没有 Git 再选 MSYS2 的最佳环境。用户可显式选 MSYS2。
- UI 选择某个 profile 时，同时写入 `bashPath` 与 `msystem`；手填路径时自动识别 flavor，MSYS2 多环境则由 `msystem` 下拉决定。
- 配置了 MSYS2 的 `msystem` 但该环境根不存在 → 无效，设置页红字，替换跳过。

---

## 6. 设置与 UX

### 6.1 配置（entry Config，namespace = entry id `dsh-gitbash`）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `bashPath` | string, volatile | `''` | 空 = 自动发现；非空必须是绝对 Windows 路径并通过校验 |
| `msystem` | `'auto' \| 'MINGW64' \| 'UCRT64' \| 'CLANG64' \| 'CLANGARM64' \| 'MINGW32' \| 'MSYS'`, volatile | `'auto'` | MSYS2 需要；Git 只接受 `auto`/`MINGW64`，其它值拒绝而不是忽略 |
| `compat` | `'auto' \| 'strict'`, volatile | `'auto'` | auto：workspace-write 以完全访问跑；strict：只允许 danger-full-access |

- 只有 `.volatile()` 字段进设置表单；值由 profile `cordis.patch.yml` 持久化。
- 新会话生效；运行中会话不换工具。
- 跨字段校验（路径存在/非 WSL）放在**使用点**（`agent/created` 与路由），schema 不表达。

### 6.2 设置行（`settings.general.item`，id `git-bash`，order 60）

默认只显示三层，保持和官方 General 行相近的密度：

1. **标题 + 生效 profile 徽章**（如 `Git for Windows` / `MSYS2 UCRT64`）。
2. **Shell 选择**：`自动（推荐）` + 已缓存 profile（Git / 各 MSYS2 环境），
   直接选中即写 `bashPath + msystem`；旁边一个 `刷新` 执行带版本探测的发现。
   候选来自 `/state` 的缓存，打开设置不需要等待扫描。
3. **兼容选择**（auto/strict）+ **一行**红字安全提示；完整解释放在 `title` 与 README。

折叠的 **高级与诊断** 里才是：手动路径 + 使用/恢复自动/测试、MSYS2 环境下拉、
平台 / `ctx.shell.sandboxMode` / 后台任务 / 最近替换。这样默认界面不展示诊断表格，
但排障信息仍在一处。

- Shell 选择按 `path + msystem` 匹配当前配置；Git 的 `bin\bash.exe` 已归一化到
  `usr\bin\bash.exe`，避免 launcher 重置 `MSYSTEM`。
- 所有控件在 `configForms` 不可写时禁用并显示原因；不阻塞设置页打开。
- 三个原生 `<select>` 的闭控件与每个 `<option>` 都显式使用
  `--dsw-alias-bg-layer-2` / `--dsw-alias-brand-text` / `--dsw-alias-border-l2`
  （fallback `Canvas` / `CanvasText`）。Windows 原生弹层不继承透明背景，否则
  深色主题会出现白底白字；浅色/深色真机截图见 `docs/SMOKE.md`。
- `/state` 在配置路径无效时返回 `problem`，row 在壳选择下方直接显示，不再只显示“noPath”。
- 路径 + `msystem` 通过一次 `configForms.mutate` 原子写入，避免中间态。
- 手动路径变化时，同一次写入把 `msystem` 复位为 `auto`：路径可能切换 Git/MSYS2
  家族，否则旧的 UCRT64 会把新 Git 路径判为无效（反之亦然）。生效 profile 为 Git
  时 MSYS2 环境下拉禁用。
- 真机 UI 已验证：Shell 下拉切 Git → `/state` 读回 `git|...|MINGW64`；切回 MSYS2
  UCRT64 读回一致；0.2.2 上再验一次 UI 写入；0.2.5 手动路径 MSYS2 → Git 13/13。
  截图见 `docs/images/settings-row-0.2.5.png`。
- 结果文本使用短标记 `[compat: bash runs outside the DSH file sandbox (session mode …)]`；
  工具描述明确它是**部署提示，不是命令 stderr**。

### 6.3 诊断

- host 文件日志：`os.tmpdir()/dsh-gitbash.log`，一行一条（启动、发现、替换、路由、执行失败）。
- 设置页状态显示最近一次替换原因；执行失败的错误文本包含路径与修复建议。
- `/api` 路由始终返回 200 + `{ ok, ... }`，错误在 body 里，避免设置行因网络错误白屏。

---

## 7. 兼容与升级

- 运行时**不做版本号分支**；全部用服务/方法/字段特性探测（0.2.x 内向前兼容）。
  版本把关放在工具链：`engines.dsh`（安装/装载时由 DSH 校验）与 `compatcheck`
  （开发/升级时对部署产物核对）。
- 必需：`tools.register/restrict`、`systemPrompt.section`、`subprocess.spawn`、`agent.ctx`。
- 可选（缺失降级）：`jobs`（无则前台超时即杀）、`workingDirectory`（无则 `session.header.cwd`）、`shellEnv`（无则无 DSH_*）、`approval`/`sandboxPolicy`（无则不 advertise 提权）、`connection`（无则设置行只读状态）、`configForms`（无则设置行只读）。
- 关键裸字符串（事件名 `agent/created`、`tool/result.meta`、`[exit code:`、`[stderr]`、`jobId` 等）在测试里断言，避免“裸字符串等于没测”。
- `compatcheck` 脚本（0.2.2 基线）：
  - 从本包 `engines.dsh` 读取 floor，读取部署的 `dsh/package.json` 并拒绝低于 floor 的运行时；
  - 对 `dsh-tool-bash`、`dsh-agent`、`dsh-system-prompt`、`dsh-tools`、
    `dsh-sandbox`、`dsh-client-ui-settings`、`dsh-client-ui-settings-general`
    的部署产物做字符串核对（含 0.2.2 的 promote 模板、8 语言提权文案、Client
    的 `configForms` / `settings.general.item`）；
  - DSH 升级后跑一次，漂移即报警。
- `package.json` 的 `dsh.bundle.platforms: ["win32"]` 让 DSH 0.2.2 在 profile
  装载前就拒绝/跳过非 Windows Host；`cordis.patch.yml` 的平台闸保留为第二道。

---

## 8. 测试

- **单元**（`node:test`，无 DSH）：
  - 发现：Git/MSYS2 flavor 识别、MSYS2 环境枚举（UCRT64/MINGW64/…）、WSL 排除、去重、版本解析。
  - 路径：POSIX↔Windows、`/tmp`、相对路径、非法绝对 POSIX、盘符相对 `workdir`（`C:foo`/`C:`）拒绝。
  - 环境：Git 的 `MSYSTEM=MINGW64`、MSYS2 的 `MSYSTEM=<env>` 与三段 PATH、`msystem`/flavor 不匹配拒绝、Cygwin 的 `MSYSTEM`/`MSYS2_PATH_TYPE` tombstone。
  - 渲染：stdout/stderr 合并、截断、退出码/信号/超时/停止/兼容标记、parseExitStatus。
  - 提权：参数配对、严格更宽、approval outcome 映射、8 语言 `displayReason`（en/zh/ja/es/fr/de/ru/pt）、read-only 下批准 `danger-full-access`。
  - 设置：默认值、volatile 读取、无效路径、相对 `bashPath` 拒绝、抛异常的 volatile getter 回退默认值。
  - 工具定义：参数/输出 schema 形状、presenter 返回值、promote 文本（无交接句）、前台 job settle 后移除、无 `value` 时的 promoted/background presenter 兜底。
  - 替换：缺 `subprocess`/`sandboxPolicy` 时保留 pwsh；能力探测返回缺失原因。
  - 路由：`ctx.get` 抛异常时不阻塞插件加载。
  - 打包：`dsh.bundle.platforms`、`engines.dsh`/`engines.node` 下限、patch 平台闸。
- **集成**（无 DSH 进程）：用真实 bash 跑 `executor`，**Git 与 MSYS2 各跑一遍**：
  - `echo`、`pwd`、`exit 3`、stderr、超时、真实 `SIGTERM` / `SIGKILL` 编码、工作区外写入（compat 预期）。
  - **MSYS2 profile**：`echo $MSYSTEM` 必须等于所选环境；`command -v gcc` 命中该环境（若装了 gcc）。
  - **Git profile**：`echo $MSYSTEM` 必须为 `MINGW64`。
  - 启动失败检测（模拟 stderr `*** fatal error - `）。
  - 后台 job 的 `output/read/kill` 由 fake registry 单测覆盖（`tests/tool.test.mjs`）。
- **真机冒烟**（新 DSH 会话）：按 AGENTS §1 的 ①~⑥ 逐条；记录命令与结果。
  2026-10-18 在 DSH 0.2.1-rc.2、2026-11-06 在 DSH 0.2.2-rc.1 上跑通：插件加载、
  `/api` state、`agent/created` 替换、模型工具目录只有 `bash`、真实 bash 调用、
  promote / 后台 / 子智能体与设置行；0.2.4 审计轮 31/31 场景 + 15/15 UI 检查，
  0.2.5 审计轮 13/13 手动路径 UI 流程。详见 [SMOKE.md](SMOKE.md)。
- 不使用 `lib/` 旧构建做验证（checkout 里可能 stale）；以 `src` + 部署运行时为准。

---

## 9. 打包与安装

- npm 包名：`@riverzh/dsh-gitbash`（DSH entry id 仍是 `dsh-gitbash`）；`0.1.0` 是内部实现基线，`0.2.0` 是首个公开发布版本，`0.2.1` 为审计修复版，`0.2.2` 修复 Windows 信号/`PWD` 与设置页浅深色，`0.2.3` 同步 DSH 0.2.2 契约，`0.2.4`/`0.2.5` 为两轮审计修复版；License 为 `GPL-3.0-only`。
- `package.json`：
  - `"type":"module"`，`main: "lib/index.js"`，`exports: { ".": ..., "./client": ... }`。
  - `"dsh": { "bundle": { "platforms": ["win32"], "patch": "./cordis.patch.yml" }, "client": { "platform": "web" } }`。
  - `"engines": { "node": ">=24.9.0", "dsh": ">=0.2.2-0" }`（含 prerelease；不设上界，靠 compatcheck 探测漂移）。
  - 依赖：`@deepseek-ai/schemastery`（`~3.19.0`，与 DSH 0.2.2 的 runtime 一致）；dev：esbuild/typescript/@types。
- `cordis.patch.yml`：
  ```yaml
  - insert:
      - id: dsh-gitbash
        name: '@riverzh/dsh-gitbash'
        disabled: !!js process.platform !== 'win32'
  ```
- 构建：host ESM（`packages: 'external'`）+ client classic CJS wrapper（`window.__ModuleLoader__.load`）+ sourcemap。
- 安装：`%DSH_CLI% plugin --profile desktop add link:D:/GitHub/dsh-gitbash-new`；`DSH_CLI` 指桌面自带 CLI（`%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd`），不是 npm 全局 0.1.7；重启 DSH；硬刷新浏览器。
- 卸载：`%DSH_CLI% plugin --profile desktop remove @riverzh/dsh-gitbash`；重启。
- 升级：改版本 + CHANGELOG；`compatcheck` 对当前 DSH 跑一遍；重装并重启。

---

## 10. 风险与未决

| 风险 | 处置 |
|---|---|
| Git for Windows / MSYS2 的环境差异（`MSYSTEM`、PATH、多环境共用 bash.exe） | 用 shell profile 区分；`bashPath + msystem` 双字段持久化；不匹配拒绝执行。 |
| Cygwin 行为差异 | 只做 best-effort，默认不选；UI 标注 experimental。 |
| 中文 Windows 的 stderr 编码/本地化 | 启动失败检测只认 MSYS 英文签名；其余输出原样展示。 |
| 设置表单的 `mode` 字段缺失（0.2.1 起） | 只用 `status/value/revision/writable`，不读 `mode`。 |
| 后台 job 在无 controller 的组合里不可用 | feature-detect；admission 失败退回前台 deadline kill。 |
| `minimal` preset 的 persistent shell 被隐藏后模型失去“持久状态” | 明示 one-shot 语义；不承诺持久 shell（README 写清）。 |
| 安全：compat 下 bash 完全访问 | 红字 + 结果标记 + read-only 拒绝 + strict 可选；不静默。 |
| DSH 升级导致 `agent/created`/`tools.restrict` 变化 | 裸字符串测试 + compatcheck；失败只跳过替换，会话仍可用 pwsh。 |

---

## 11. 验收（对应 AGENTS §1）

1. 新会话工具目录只有 `bash`、无 `pwsh`；`bash -c 'echo ok'` 真实执行。
2. workspace-write + compat auto：`echo > 工作区内` 成功；结果明确标注“完全访问”；文件工具仍受沙箱。
3. `workdir` / 后台 / promote / kill / 提权 / 终端卡片逐项对齐官方 tool-bash。
4. 设置页自动发现 Git + MSYS2 两套 profile、下拉、MSYS2 环境下拉、校验、持久化；打开瞬时。
5. 单元 + 集成 + 真机冒烟全绿。
6. README / CHANGELOG / AGENTS / 本文同步。


---

## 12. 真机验证

### 12.1 2026-10-18，DSH `0.2.1-rc.2`（历史基线）

| 项 | 结果 |
|---|---|
| 插件加载 / 发现 / 路由 | ✅ `apply` + 7 个 profile + 3 条 `/api` 路由 |
| per-agent 替换 | ✅ `replace: applied`，`tool:pwsh` 被清空 |
| 模型工具目录 | ✅ 只有 `bash`；`pwsh` 命中 0 |
| params/output schema | ✅ 标准 JSON Schema；曾因 DSL 形态真机报错，已修 |
| 真实命令 | ✅ `echo LIVE_BASH_OK` → stdout `LIVE_BASH_OK` |
| `meta.cwd` | ✅ `D:\GitHub\dsh-gitbash-new` |
| 权限 | 测试会话 `workspace-write` + `compat: auto`，结果带 `[compat: ...]` |
| MSYS2 | ✅ 模型回合、后台任务、子智能体全链路真机跑通（UCRT64） |
| Git 子智能体 / 后台 | ✅ child bash、`job/registered`/`job/settled`、`meta.cwd` 全部核对 |
| 设置 UI | ✅ 实际截图；Shell 下拉切 Git/MSYS2 写入并读回成功 |
| 后台/子智能体 UI | ✅ 标题栏 `1 个后台任务` / `1 个子智能体`，命令卡/子智能体卡正常（MSYS2 截图） |
| Git UI 卡片 | ✅ 与 MSYS2 同一 `bash` 契约；事件/`meta.cwd` 逐条核对，未单独截图 |

复跑步骤与原始事件见 [SMOKE.md](SMOKE.md)。测试 profile/端口均为独立实例，不影响桌面会话。

### 12.2 2026-11-06，DSH `0.2.2-rc.1`（当前基线）

测试 profile `gitbash-022`（web 模板 + `link:D:/GitHub/dsh-gitbash-new`，插件 `0.2.3`），
端口 `56123`；每个场景独立会话；真机为 DSH Desktop 自带 CLI `0.2.2-rc.1`。

| 项 | 结果 |
|---|---|
| 装载 / 发现 / 路由 | ✅ `apply` + 7 个 profile + 3 条 `/api` 路由；`/state` 返回 effective `git|...|MINGW64` |
| 模型工具目录 | ✅ 32 个工具中含 `bash`；`pwsh` 命中 0；`tool:bash` 提示词存在、无 PowerShell |
| 真实命令 | ✅ `echo LIVE022_OK; echo MSYSTEM=$MSYSTEM; pwd` → `LIVE022_OK` / `MINGW64` / `/d/...` |
| `meta.cwd` | ✅ `D:\GitHub\dsh-gitbash-new` |
| promote（0.2.2 新文本） | ✅ `timeoutMs:1500` + `sleep 5` → `PROMOTE_BEFORE` + compat 行 + `[still running after 1500ms; moved to background job …]`，**无**交接句 |
| 后台 + `job_output` | ✅ job `bash-…` → `BG022_OK`，`[status: completed, exit code: 0]` |
| 子智能体 | ✅ child `5d5dc315-…` 内 `bash` 可用；`SUB022_OK`；`send_message` 回父会话 |
| 设置行（真实 Chromium） | ✅ 标题、Git/MSYS2 选择、兼容、红字、高级诊断、`当前版本：0.2.2-rc.1` 全部渲染 |
| 设置写入 | ✅ UI 切到 MSYS2 UCRT64 → `/state` 读回 `bashPath=C:\msys64\usr\bin\bash.exe`、`msystem=UCRT64`；新会话 `MSYSTEM=UCRT64` |
| 兼容告警 | ✅ workspace-write 会话每结果带 `[compat: ...]`；strict 拒绝已在 0.2.4 审计轮实测（见 §12.3） |
| compatcheck | ✅ 运行时 `0.2.2-rc.1`（floor `0.2.2-0`），8 组 Host/Client 契约 token 全过 |

未覆盖：0.2.2 上重跑“受限令牌启动 MSYS2”（见 §2.1 源码级复核）、read-only 的实机点击、
浅色主题截图（0.2.1 已有，0.2.2 设置行渲染路径未变）。

### 12.3 2026-11-06，0.2.4 审计回归（DSH `0.2.2-rc.1`）

独立 profile `gitbash-audit`（web 模板 + `link:` 当前仓库，端口 `56124`）：

| 项 | 结果 |
|---|---|
| API/场景检查 | ✅ 31/31：state/discover（7/7 探测到版本）/validate；Git 直连、promote 新文本、后台 + `job_output`、`SIGTERM` 归一化、相对 `workdir`、子智能体（child 只有 bash、无 pwsh、执行成功） |
| 设置行 UI（真实 Chromium，干净加载） | ✅ 15/15：三组下拉、MSYS2 UCRT64 切换并读回、strict 写入/回退、高级诊断、无 console 错误、无失败请求 |
| strict 拒绝 | ✅ 新会话在 strict + workspace-write 下返回 `bash cannot run under the Windows file sandbox…`，未执行 `SHOULD_NOT_RUN` |
| 设置持久化 | ✅ profile `cordis.patch.yml` 读回 `bashPath: C:\msys64\usr\bin\bash.exe` / `msystem: UCRT64` / `compat: auto` |
| 绝对路径校验 | ✅ `/validate` 对相对路径返回 `bashPath must be an absolute path` |
| 单测 / compatcheck | ✅ 90/90、selftest 10/10、compatcheck 8 组全过 |

未覆盖：read-only 的实机点击与提权审批弹窗（单测覆盖）、受限令牌启动 MSYS2 的
0.2.2 重跑。

### 12.4 2026-11-06，0.2.5 第二轮审计（DSH `0.2.2-rc.1`）

独立 profile `gitbash-r2`（web 模板 + `link:`，端口 `56126`）：

| 项 | 结果 |
|---|---|
| 单测 / 自测 / 契约 | ✅ 95/95、selftest 10/10、compatcheck 8 组 |
| 手动路径 UI（真实 Chromium） | ✅ 13/13：Git 时 MSYS2 下拉禁用；输入 MSYS2 路径 → `msystem` 自动复位 `auto`、生效 MSYS2、下拉启用；再输入 Git 路径 → 复位 auto、生效 Git、下拉禁用；无 console/网络错误 |
| API 场景 | ✅ Git 直连（`R2_OK`/`MINGW64`）、promote 新文本、SIGTERM、后台 + `job_output` |
| 盘符相对 workdir | ✅ 模型传 `workdir:"C:foo"` → `workdir "C:foo" is drive-relative…`，未执行 |
| 发现探测 | ✅ 空环境探测 7/7 版本（Git 5.3.15；MSYS2 5.3.20） |
| 单测新增 | ✅ presenter 无 `value` 兜底（promoted/background）、盘符相对、Cygwin msystem 拒绝、抛异常 getter、抛异常 `ctx.get` |

未覆盖：read-only 实机点击、提权审批弹窗、0.2.2 受限令牌启动 MSYS2 重跑。
