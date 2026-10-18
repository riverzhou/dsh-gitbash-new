# dsh-gitbash

在 Windows 上把 DeepSeek Harness（DSH）的模型终端工具从官方的 `pwsh` 换成 **bash**，并**同时支持、可选**：

- **Git for Windows**（默认优先）
- **MSYS2**（UCRT64 / MINGW64 / CLANG64 / CLANGARM64 / MINGW32 / MSYS）

它保留官方 `tool-bash` 的行为：`workdir`、后台任务、超时转后台、`job_kill`、沙箱提权、终端卡片、PTC、`meta.cwd`。仅对**新会话**生效。

> 最低 DSH：**0.2.1**。非 Windows 不注册任何行为。

---

## ⚠️ 安全边界（先读）

Git Bash / MSYS2 的运行时（MSYS2）**无法在 DSH 官方的 Windows ACL 沙箱里启动**：受限令牌会让 MSYS2 的命名共享内存 / signal 管道 / `BaseNamedObjects` 创建失败。这是 OS 层冲突，不是本插件的 bug（详见 [docs/DESIGN.md](docs/DESIGN.md) §2）。

因此本插件的行为是**显式**的：

| 会话权限 | 默认（`compat: auto`） | `compat: strict` |
|---|---|---|
| `danger-full-access` | bash 正常执行 | bash 正常执行 |
| `workspace-write` | bash **以完全访问执行**，结果带 `[compat: ...]` 提示 | 拒绝执行，提示切换/提权 |
| `read-only` | **拒绝执行** | 拒绝执行 |

- **文件工具仍由官方沙箱保护**；只有 bash 进程不受 OS 沙箱约束。
- 插件不会静默降级：设置页常驻红字警告，工具描述与 system prompt 都写明，结果里带 `[compat: ...]`。
- 不想承担这个代价：把 `compat` 设为 `strict`，只在 `danger-full-access` 会话使用 bash。

---

## 安装

### 从本地目录（开发）

先完全退出 DSH Desktop，再使用 **Desktop 自带 CLI**（`0.2.1`；不是 npm 全局的 `0.1.7`）：

```bat
set "DSH_CLI=%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd"
%DSH_CLI% --version
:: 应为 0.2.1-rc.2 或更高；0.1.7 的全局 dsh 不能安装本插件

%DSH_CLI% plugin --profile desktop add link:D:/GitHub/dsh-gitbash-new
```

重新打开 DSH，浏览器硬刷新（Ctrl+Shift+R）。

> **与 dsh-tweaks 的 `git-bash-terminal-tool` 二选一**：
> 两者都会隐藏 `pwsh` 并注册 `bash`。如果 desktop profile 里已经装了 dsh-tweaks 的那个插件，
> 先移除或禁用它，再启用本插件：
>
> ```bat
> %DSH_CLI% plugin --profile desktop remove dsh-tweaks-git-bash-terminal-tool
> ```
>
> 同时安装时，先加载的一方完成替换，后加载的一方会因 `pwsh` 已不可限制而跳过（日志里可见 `skipped ... pwsh is not restrictable`）。

### 从 GitHub（发布后）

```bat
%DSH_CLI% plugin --profile desktop add github:converk/dsh-gitbash-new
```

### 依赖

- Windows 10/11 x64（arm64 的 MSYS2 也可用）
- DSH `>= 0.2.1`
- Git for Windows 和/或 MSYS2
- Node.js `>= 22`（构建/开发需要）

---

## 配置

打开 **设置 → 通用 → 终端工具（Git Bash / MSYS2）**：

1. **bash 路径**：留空 = 自动发现；也可以手填。
2. **自动发现**：扫描注册表、常见安装目录、`where git/bash`、`PATH`，列出所有 Git / MSYS2 / Cygwin profile（含版本）。
3. **MSYS2 环境**：选 `UCRT64` / `MINGW64` / ...（Git 忽略这一项，固定 `MSYSTEM=MINGW64`）。
4. **受限权限下的行为**：
   - `兼容模式（推荐）`：`workspace-write` 下以完全访问跑 bash；
   - `严格模式`：只允许 `danger-full-access`。
5. **测试**：校验路径并执行 `bash --version`。

配置存在 profile 的 `cordis.patch.yml` 里（entry id `dsh-gitbash`），**新会话生效**。

### 自动发现规则

- 排除 WSL：`C:\Windows\System32\bash.exe`、`Sysnative`、`WindowsApps`、`\\wsl$`。
- Git for Windows：`%ProgramFiles%\Git`、`%LocalAppData%\Programs\Git`、注册表 `InstallPath`、`where git` 反推。
- MSYS2：`C:\msys64`、`D:\msys64`、`%LocalAppData%\msys64`；每个存在的环境目录一个 profile。
- 文件名必须是 `bash` / `bash.exe`，且真实存在。

### 环境隔离

- Git profile：`MSYSTEM=MINGW64`，PATH 前置 `<root>\bin`、`<root>\usr\bin`、`<root>\ucrt64\bin`（存在时）。
- MSYS2 profile：`MSYSTEM=<选择>`、`MSYS2_PATH_TYPE=inherit`，PATH 前置 `<env>\bin`、`<root>\usr\bin`、`<root>\usr\local\bin`。
- **不会**把另一套系统的 PATH 混进来（如 MSYS2 会话不继承 Git 的 `usr\bin`；反之亦然）。
- `dshEnv`（`DSH_*`）最后合并；`HOME` / `TMP` / `LANG` 不覆盖。

---

## 功能

- **隐藏 pwsh**：每个会话创建时 `tools.restrict({ deny: ['pwsh'] })`，并压掉 `tool:pwsh` 提示词。
- **注册 bash**：参数/输出/渲染与官方 `tool-bash` 同形；`meta.cwd` 写真实执行目录。
- **cwd 跟随**：`working_directory` 工具的 `cd` 会影响 bash 的默认目录；`workdir` 相对当前目录解析。
- **后台任务**：`run_in_background`；前台超时自动转后台（promote）；`job_output` / `job_kill`。
- **沙箱提权**：`sandbox_permissions` + `justification` 走官方审批；批准后仅本次调用生效。
- **终端卡片**：前台命令显示命令、cwd、输出、退出码 pill；后台/转后台用通用卡片。
- **PTC**：工具目录进入 `run_code` SDK，子调用归属根调用。
- **诊断**：`%TEMP%\dsh-gitbash.log` 一行一条；设置页显示最近一次替换结果。

### 已知限制

- `minimal` preset 的 persistent shell 不保留：本插件是 one-shot `bash -c`。
- Cygwin 只做 best-effort（experimental），默认不选。
- 不自动选 WSL。
- Windows 沙箱与 MSYS2 的冲突见上；bash 不可能既跑起来又被该沙箱约束。

---

## 排障

| 现象 | 处理 |
|---|---|
| 设置页显示“尚未找到 bash” | 安装 Git for Windows；或手填 `...\Git\bin\bash.exe`；点“自动发现” |
| 会话里仍只有 pwsh | 确认 DSH ≥0.2.1、插件已在 profile bundles 中、**重启 DSH**；看 `%TEMP%\dsh-gitbash.log` 的 `replace:` 行 |
| MSYS2 报环境不存在 | 选一个已安装的环境（`ucrt64\bin` 等存在）；重新“自动发现” |
| `workspace-write` 下报 strict | 把 compat 改为 auto，或切到 danger-full-access |
| read-only 下 bash 拒绝 | 这是设计：切到 workspace-write / danger-full-access |
| 路径含空格 | 直接填完整路径，不要加引号；设置页会存原样 |

---

## 开发

```bash
pnpm install
pnpm build        # lib/index.js + lib/client.js
pnpm check        # tsc --noEmit
pnpm test         # node:test 单元 + 真实 Git/MSYS2 集成
pnpm selftest     # 纯逻辑自测（不需要 DSH）
pnpm compatcheck  # 对已安装的 DSH 产物做契约字符串核对
```

测试会真实启动本机的 Git for Windows / MSYS2（如果存在），验证 `MSYSTEM`、PATH 隔离、退出码、超时、子进程。

### 发布/升级

1. 改 `package.json` 版本 + `CHANGELOG.md`。
2. `pnpm build`、`pnpm check`、`pnpm test`。
3. DSH 升级后跑 `pnpm compatcheck`；漂移会打印缺失的契约字符串。
4. `dsh plugin --profile desktop add <pkg>@<version>`。

---

## 卸载

```bat
%DSH_CLI% plugin --profile desktop remove dsh-gitbash
```

重启 DSH。设置页条目随插件一起消失；已写入 profile patch 的配置可以保留或手动删除。

---

## License

MIT
