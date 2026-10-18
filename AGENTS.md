# AGENTS.md — dsh-gitbash-new 代理工作规范

> **本文件是 AI 代理进入本仓库的唯一指令入口。** 动手前先读完全文。
> 当前仓库处于「已实现、可安装、真机验证通过」阶段：项目目标见 §1，契约与坑见 §6。
> 维护原则：**每条规则都要有可机械检验的判据**；写不出判据的，不要写进来。

---

## 0. 当前状态（2026-10-18 实测）

| 项 | 实测值 |
|---|---|
| 仓库路径 | `D:\GitHub\dsh-gitbash-new` |
| Git | 分支 `master`；`user.name=River Zhou`，`core.autocrlf=true` |
| 文件 | 插件源码 + 构建产物 `lib/` + 文档/测试/脚本（见 §3） |
| 源码 / 技术栈 | TypeScript（host ESM + client bundle）+ esbuild；`lib/` 已构建并入库 |
| 项目定位 | ✅ **已确定并实现**（见 §1；设计见 `docs/DESIGN.md`） |
| 版本 / 许可 | `0.2.2` / `GPL-3.0-only` |
| 验证 | `pnpm test` 75/75；`pnpm selftest` 10/10；`pnpm compatcheck` 通过；DSH 0.2.1-rc.2 真机：Git + MSYS2 的 direct/background/subagent、UI 卡片与设置切换均通过；Windows 信号与 `PWD` 回归、设置页浅色/深色下拉均通过（`docs/SMOKE.md`） |
| 平台 | Windows 10（19045）/ Git for Windows 2.56（bash 5.3.15）/ MSYS2 5.3.20（UCRT64） |
| 运行时 | Node v24.21.0；DSH 桌面运行时 `0.2.1-rc.2` |
| 已知硬约束 | Git Bash/MSYS2 无法在 DSH Windows ACL 沙箱内启动；兼容模式策略见 §1 与 README |

**构建/测试命令**：`pnpm install` → `pnpm build` → `pnpm check` → `pnpm test` → `pnpm selftest` → `pnpm compatcheck`。
`src/` 改动后必须重新 `pnpm build`；`lib/` 是 `dsh plugin add link:` 实际加载的产物。

**仓库名与项目目标一致。** `dsh-gitbash-new` 是「DSH 的 Git Bash 支持」的新仓库；相邻仓库（如 `D:\GitHub\dsh-tweaks`、`D:\GitHub\dsh-searxng`）只能作为调研参考，**不得整段复制**当作本仓库的设计。

### 0.1 `/init` 不是 DSH 内置命令（实测）

- DSH `0.2.1-rc.2` 注册的内置斜杠命令只有：`/compact`、`/feedback`、`/goal`、`/plan`、`/export`。`/init` 不在其中，会被当作**普通消息**送到模型。
- 在本工作区，所有者用 `/init` 表达：**初始化或维护本仓库的 AGENTS.md**。
- 因此接到 `/init` 时：
  1. 先核对仓库现状与本文档；
  2. 只改文档，**不创建业务代码**；
  3. 有歧义先问，不猜。

---

## 1. 项目是什么 —— ✅ 已由所有者确认（2026-10-18）

| 项 | 内容 |
|---|---|
| 一句话目标 | 在 Windows 上给 DSH 一个**完整可用的 bash 终端环境**：用 **Git for Windows 或 MSYS2**（可选）取代默认 pwsh，同时保留 DSH 官方终端工具的全部行为（cwd / 后台任务 / 超时转后台 / 沙箱与提权 / 终端卡片 / PTC）。 |
| 交付物 | 一个可安装的 DSH 双面插件：host 半区（Git/MSYS2 profile 发现与校验、bash 工具、沙箱兼容、设置路由）+ client 半区（设置页、自动发现、MSYS2 环境选择、状态与诊断）；配套测试、中英 README、CHANGELOG、设计/冒烟文档。 |
| 明确不做的事 | 不改 DSH 源码/安装文件；不自动选 WSL 的 bash；不引入自定义 preset；不接管 `ctx.shell`（pwsh 保留）；Linux/macOS 上不注册任何行为。 |
| 技术栈 | TypeScript（host ESM + client bundle）、esbuild、官方 `ctx` 服务契约（结构性窄化，不 import 官方包）；Node `^22.19.0 || >=24.0.0`。 |
| 最低 DSH | **0.2.1**（以 0.2.1-rc.2 的源码与桌面运行时为基线；用特性探测兼容 0.2.x）。 |
| 「怎么算做完」 | ① 新会话的模型工具目录里**只有 `bash`、没有 `pwsh`**，且 bash 命令能真实执行（真机已验证）；② **安全决策如实落地**：`workspace-write` 下 bash 以完全访问运行并在结果/设置页显式标注，`read-only` 拒绝，文件工具仍受官方沙箱（真机已验证 workspace-write；read-only/strict 由单元测试覆盖）；③ `workdir` / 后台任务 / 超时转后台 / 沙箱提权 / 终端卡片与官方 tool-bash 逐项对齐（单测 + 真机 tool call/meta.cwd）；④ 设置页能自动发现、校验、持久化 **Git 与 MSYS2** profile；⑤ 单元/集成测试与真机冒烟全绿；⑥ 安装/卸载/升级路径有文档。 |

> **验收口径**：上面的 ①~⑥ 每条都要有可复现的检验步骤；无法检验的条目不算完成。
> **安全决策（所有者 2026-10-18 拍板：体验优先）**：Git Bash/MSYS2 在 OS 层无法与 DSH 的 Windows ACL 沙箱共存；`compat: auto` 下 `workspace-write` 会话的 bash 以完全访问运行（结果带 `[compat: ...]`），`read-only` 拒绝，`compat: strict` 仅允许 `danger-full-access`。不得静默降级。

**设计约束（所有者原话）**：尽量复用 DSH 官方机制、方便跟进官方升级；参考 `dsh-tweaks` 但**完全重头设计**；用户体验优先：功能强、配置简单、安全可靠。

---

## 2. 铁律（不依赖技术栈，现在即生效）

1. **不猜项目**：§1 为空时，不得新增顶层目录、不得引入依赖、不得写业务代码；需要信息就直接问所有者。
2. **单一事实来源**：参数 / 常量 / 契约只在**一处**定义，其它位置只引用。
   出现第二份拷贝即为缺陷，不是风格问题。
3. **变更留痕**：每个有意义的变更**单独提交**，提交信息写清「改了什么 / 为什么 / 影响面 / 未完成」。
4. **提交前必须看 `git show --stat`**：逐行确认每个改动都在预期之内。
   ⛔ 禁止无脑 `git add -A` —— 它会把**你没有动过的删除**一起提交。
5. **删除必须有白名单**：删除前先取「当前已跟踪文件清单」当白名单；
   删完再跑一次 `git status`，**任何 `D` 条目都必须先解释、再提交**。
6. **如实报告结论**：严格区分「**未检验**」/「**不可判**」/「**不成立**」。
   ⛔ 证据不足时记「未检验」，**不得**记「通过」。
   ⛔ 不得把推测写成事实。
7. **文件编辑只用专用工具**（read / edit / write），shell 只负责跑命令。
   ⛔ 不用 shell 做字符串替换式编辑；提交信息含特殊字符或多行时一律用 `-F <文件>` 传入。
8. **入库边界**：源码与全部文档入库；数据 / 缓存 / 产物 / 密钥**不入库**。
   引入 `.gitignore` 时按本条执行。

---

## 3. 目录约定

当前（2026-10-18，已实现）：

```text
dsh-gitbash-new/
├── AGENTS.md              # 本文件：代理指令入口
├── README.md              # English manual: install / security / usage / troubleshooting
├── README.zh.md           # 中文手册：安装 / 安全 / 用法 / 设置 / 排障
├── CHANGELOG.md           # 版本留痕
├── LICENSE                # GPL-3.0-only
├── package.json           # npm 包名 @riverzh/dsh-gitbash；dsh.bundle / dsh.client / engines.dsh
├── pnpm-workspace.yaml    # pnpm 11 的 allowBuilds（esbuild）
├── tsconfig.json          # strict + allowImportingTsExtensions + react-jsx
├── build.mjs              # host ESM + client classic CJS wrapper + sourcemap
├── cordis.patch.yml       # bundle patch：仅 win32 挂载
├── src/
│   ├── index.ts           # host 入口：apply / Config / 路由 / 替换 / 纯逻辑导出
│   ├── shared/protocol.ts # host/client 共用 wire 常量与类型
│   ├── host/
│   │   ├── types.ts       # DSH 0.2.1 契约的结构性窄化（不 import 官方包）
│   │   ├── settings.ts    # schemastery Config（volatile）
│   │   ├── discover.ts    # Git/MSYS2/Cygwin profile 发现、WSL 排除、校验
│   │   ├── env.ts         # MSYSTEM/PATH 隔离、POSIX↔Windows、workdir
│   │   ├── escalation.ts  # 官方提权语义的本地窄化实现
│   │   ├── executor.ts    # ctx.subprocess 封装：deadline/collect/启动失败检测
│   │   ├── jobs.ts        # job sources / outcomes / cancel
│   │   ├── render.ts      # 结果文本、标记、截断、compat note
│   │   ├── bash-tool.ts   # 工具定义（JSON Schema 参数/输出、execute、presenter）
│   │   ├── replace.ts     # agent/created：restrict + register + prompt shadow
│   │   ├── routes.ts      # /api/dsh-gitbash/{state,discover,validate}
│   │   └── diag.ts        # %TEMP%\dsh-gitbash.log
│   └── client/
│       ├── index.ts       # settings.general.item 注册 + configForms 解析
│       ├── row.tsx        # 设置行 UI
│       ├── store.ts       # config form + /api 状态
│       ├── api.ts         # 同源 fetch
│       ├── locales.ts     # zh/en
│       └── types.ts       # 客户端契约窄化
├── tests/
│   ├── helpers/           # fake / real subprocess
│   └── *.test.mjs         # 75 个 node:test 用例（含真实 Git/MSYS2 集成）
├── scripts/
│   ├── selftest.mjs       # 纯逻辑自测
│   └── compatcheck.mjs    # 对 app.asar 里的官方产物做契约字符串核对
├── docs/
│   ├── README.md          # 文档索引
│   ├── DESIGN.md          # 设计定稿
│   ├── SMOKE.md           # 真机冒烟记录
│   └── images/            # 设置页 / 后台 / 子智能体截图
└── lib/                   # 构建产物（入库；`dsh plugin add link:` 直接加载）
    ├── index.js
    └── client.js
```

- 新增顶层目录或文件时，**必须同时更新本节**。
- `src/` 与 `lib/` 必须同步：改了 `src/` 就要 `pnpm build`，否则实际加载的仍是旧产物。
- `lib/` 入库是有意的：`link:` 安装与 git 安装都直接读取它；`prepack` 也会重建。

---

## 4. 文档纪律

- 根目录：`README.md`（英文手册）/ `README.zh.md`（中文手册）面向人类，`AGENTS.md` 面向代理（规则/契约/坑），`CHANGELOG.md` 记版本；分工不重复。
- 两份 README 必须**结构同步、事实同步**（命令/参数/限制/截图/链接）；只改一份视为未完成。
- `docs/README.md` 是 **docs 目录的唯一索引**；`docs/DESIGN.md` 是契约与设计的单一事实来源，`docs/SMOKE.md` 是真机证据。
- 文档与代码**同一次提交**，不分开。
- 契约变更必须同时改 `docs/DESIGN.md` 与 `AGENTS.md` §6（如涉及）。
- ⛔ **禁止「影子文档」**：`docs/` 下任何存在但未在 `docs/README.md` 登记的文档，视为不存在。

---

## 5. 交接清单

每个新会话开始：

- [ ] 读 §0、§1、§6；`docs/DESIGN.md` 的 §2/§4 是安全与契约的最终依据。
- [ ] `git log --oneline -5` 与 `git status` 核对仓库真实状态（不要相信文档里的旧状态）。
- [ ] `pnpm test` 是否仍全绿；若失败，先修回归，再动新功能。
- [ ] 若 §0 的环境事实与会话实际不符，先更正 §0，再动手。

每次提交前：

- [ ] `pnpm check`、`pnpm test`、`pnpm selftest`、`pnpm compatcheck` 全过（无 DSH 安装时 compatcheck 可 skip，但要说明）。
- [ ] `git status` / `git show --stat` 逐行核对；`lib/` 与 `src/` 同步。
- [ ] 文档（README.md / README.zh.md / CHANGELOG/DESIGN/AGENTS 按影响面）与代码同提交；两份 README 同步。
- [ ] 提交信息用 `-F`，写清「改了什么 / 为什么 / 影响面 / 未完成」。

---

## 6. 实现契约与坑（真机验证）

1. **替换挂载点**：`agent/created`（serial + awaited）。在 `agent.ctx` 里
   `tools.restrict({ deny: ['pwsh'] })` → `tools.register(bashTool)` →
   `systemPrompt.section({ name:'tool:pwsh', text:'' })` → `tool:bash` / `tool:bash:windows`。
   事件名写错不会报错、只是不触发。
2. **工具 schema**：`parameters` 与 `output.schema` 都是**标准 JSON Schema**
   （`required` 是对象节点上的数组）。不能用 `defineTool` 的叶子 `required: true` DSL——
   真机曾报 `Invalid schema for function 'bash'`。
3. **终端卡片**：Web UI 不消费 `presentCall/presentResult`；它从工具名 `bash`、参数、
   结果文本标记、`tool/result.meta.cwd` 反推。`presentationMeta` 必须返回 `{ cwd }`。
4. **结果标记**：`[exit code: N]` / `[killed by signal: X]` 必须是最后一行；
   `[stderr]` 段头；截断提示带 spill 路径；compat 提示在标记之前，用
   `[compat: bash runs outside the DSH file sandbox (session mode …)]`。
5. **沙箱硬约束**：MSYS2 在 WRITE_RESTRICTED / Low 令牌下起不来；不要试图用
   `ctx.sandbox.confine` 包 bash，也不要偷偷放宽令牌。当前策略见 §1。
6. **PATH 隔离**：Git 与 MSYS2 的 `usr\bin` 不能互混；`composePath` 会按
   foreignRoots + 同根 sibling env 过滤。`MSYSTEM` 必须与 profile 匹配。
7. **启动失败检测**：`bash.exe` 可能以 exit 0 结束且无输出（MSYS2 fatal）；
   检测 `*** fatal error -` / `couldn't create signal pipe` 并改判失败。
8. **升级**：DSH 升级后跑 `pnpm compatcheck`；裸字符串（事件名、标记、meta.cwd、
   `tool:bash`）在测试里断言，避免“裸字符串等于没测”。
9. **设置**：entry Config + `.volatile()`；namespace = entry id `dsh-gitbash`；
   `configForms.get(entryId)`；不要再读 0.2.1 已删除的 `snapshot.mode`。
10. **JS/TS**：host 是 Node ESM、client 是经典 CJS 工厂；client 只允许 require
    react / react/jsx-runtime 等页面种子模块；client 入口必须声明 `inject`。
11. **Git 的 `bin\bash.exe` 是 launcher**：会按安装自带的 UCRT64 重置 `MSYSTEM`/PATH，
    覆盖我们传入的 `MINGW64`。`profileFromPath` 必须归一化到 `usr\bin\bash.exe`；
    真机曾因此让 Git 会话显示 `MSYSTEM=UCRT64`。
12. **Windows 信号编码**：Git Bash/MSYS2 自杀信号在 Windows 退出码里是
    `signalNumber << 8`（`SIGTERM` → 3840），Node 的 `signal` 恒为 null。
    `normalizeWindowsExit` 必须把这种码归一化为信号名；正常 `exit N` 被截断到
    0..255，`0xC0000005` 等崩溃码低位非 0，不能误判。
13. **`PWD` 继承**：宿主可能导出 Windows `PWD`，bash 会信任它并让 `$PWD`/`pwd`
    变成 `D:/...`。`composeEnv` 必须用 `PWD: undefined` / `OLDPWD: undefined`
    tombstone 删除继承值；真机 MSYS2 会话曾出现 `PWD=D:/GitHub/...`。
14. **原生 select 主题**：Windows 原生弹层不继承透明背景；`select` 与每个
    `<option>` 必须同时用 `--dsw-alias-bg-layer-2` / `--dsw-alias-brand-text`
    上色（fallback `Canvas`/`CanvasText`），否则深色主题会白底白字。浅色/深色
    真机截图见 `docs/SMOKE.md`。
