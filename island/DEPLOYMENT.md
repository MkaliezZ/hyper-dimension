# Hyper Dimension · Agent 部署指南

本包交付源码与资源，入口为 **AGENTS.md**、**deploy.json** 和 **release-manifest.json**。任何有终端与文件权限的开发 Agent 均可按同一协议部署。运行环境在目标机重建，无需双击安装器。

This is an Agent-deployable source and asset package. Read **AGENTS.md**, **deploy.json** and **release-manifest.json**, then rebuild the runtime on the target computer. It works with any development Agent that has terminal and filesystem access.

## 1. 获取源码 / Get the source

克隆官方仓库后进入 `island/`，或解压独立源码 ZIP 并进入其根目录。若下载的是 `.part001` 等分卷，先按[分卷说明](docs/source-parts.md)校验合并。源码版本与文件摘要以本目录的 `release-manifest.json` 为准。

Enter `island/` after cloning, or the root of the standalone source ZIP. For `.part001` downloads, [verify and assemble the parts](docs/source-parts.md) first. Check this directory's release manifest for its source payload and checksums.

新部署请使用普通项目目录，例如 Windows `C:\HyperDimension` 或 macOS `~/HyperDimension`。为管家选择独立的普通文档工作区；`.codex`、`.agents`、`.ssh`、`.aws`、`.git` 等配置目录受到文件保护。已有安装保留原数据与私有设置。

For a new deployment, use a regular project directory such as `C:\HyperDimension` on Windows or `~/HyperDimension` on macOS. Choose a separate regular folder for steward documents. Configuration directories such as `.codex`, `.agents`, `.ssh`, `.aws` and `.git` have file protection. Preserve existing installation data and private settings.

## 2. 准备目标机 / Prepare the computer

| 平台 / Platform | 解释器 / Interpreter | 安装方式 / Setup |
| --- | --- | --- |
| Windows x64 | Node.js 24，64 位 CPython 3.11 | 可使用 `--offline` |
| macOS 14+ Apple Silicon / Intel | Node.js 24，CPython 3.11，匹配本机架构 | 可使用 `--offline` |
| Ubuntu / 其他受支持 Linux | Node.js 24，CPython 3.11 | 去掉 `--offline`，安装锁定版本依赖 |

Node 最低版本为 22.13，推荐 24.19；Python 支持 3.11–3.13，首选 3.11。其他 Python 版本需联网安装本机依赖。`doctor` 会核对实际解释器与离线 wheel 的兼容性；不兼容时保留现有环境并返回错误。

Node 22.13+ and Python 3.11–3.13 are supported; prefer Node 24.19 and CPython 3.11. Offline wheels require the listed platform, architecture and Python version. `doctor` checks the actual interpreter before installation. Preserve existing environments when a check fails.

## 3. 部署和启动 / Deploy and run

Windows PowerShell，在源码根目录运行：

```powershell
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python --offline
node tools/agent-deploy.mjs setup --python=python --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

macOS 使用 `--python=python3`；Linux 同时去掉 `--offline`。`setup` 在 `.runtime/` 内重建环境并使用锁定的依赖，不能把 Windows 虚拟环境直接复制到 macOS。

Use `--python=python3` on macOS; on Linux also omit `--offline`. Setup rebuilds the target runtime inside `.runtime/` from pinned dependencies. Virtual environments must be rebuilt for the target platform.

默认地址为 `http://127.0.0.1:4175/play`。首次注册的邀请信息在本机服务日志中。若需其他设备在局域网访问，明确指定监听地址和端口：

The default URL is `http://127.0.0.1:4175/play`. Local service logs contain the registration invitation. To accept other computers on the LAN, explicitly choose the listen address and port:

```sh
node tools/agent-deploy.mjs run --mode=lan --host=0.0.0.0 --port=4175
```

其他设备使用这台电脑的局域网地址。独立外观默认入口也可用 `--mode=pixel`（4173）或 `--mode=origami`（4174）。像素与折纸共用同一小岛身份，切换外观经过存档事务；保留另一份旧主题档，不自动合并。

Other computers use the host's LAN address. Standalone appearance defaults are `--mode=pixel` (4173) and `--mode=origami` (4174). Both appearances share the island identity; keep old theme saves and preserve the appearance transaction.

`run` 是持续运行的前台进程，Agent 应使用自己的后台会话工具管理。Windows 后台窗口需隐藏。保留进程身份，只停止本项目对应的会话；关闭浏览器后服务继续运行。

Keep `run` alive through the Agent's process/session manager; hide background windows on Windows. Preserve process identity and stop only the matching project session. Closing a browser does not stop the server.

## 4. AI 与原机管家 / AI and the original-device steward

密钥保存在私有 `.env.local` 或服务进程环境中，不放进命令参数、Git、报告或公开包。模型固定为 `deepseek-flash`，无 Pro 回退；自动冷却为 300 / 600 / 950 秒。无密钥可使用规则模式，验收报告应说明 AI 配置状态。

Keep the key in private `.env.local` or process environment, never command arguments or public files. The model is `deepseek-flash` with the existing 300 / 600 / 950-second automatic cadence. Rules mode works without a key; report the actual model configuration.

需要管家处理岛主原机文件时，按[原机桥接指南](docs/device-bridge-v138.md)在原机运行 `node tools/steward-bridge.mjs --help`，从管家入口配对，核对标记并设置工作区。原机自行读取密钥；保留私有桥接状态以支持重连。跨岛 A2A 说明见[协议文档](docs/a2a-standard-v158.md)。

For original-device file work, follow the [bridge guide](docs/device-bridge-v138.md): pair from the steward UI, verify the pairing mark and choose the workspace. The original computer reads its own key. Preserve bridge state for reconnects. See the [A2A protocol](docs/a2a-standard-v158.md) for cross-island communication.

## 5. 保存与更新 / Saves and updates

无存档时从第一天零币、零库存开始。存档由本机服务持久化；更新时保留完整 `data/`、私有 `.env.local`、签名配置、Hermes 会话与外部文档成果，不自动重放现实工作。

New islands start on day one with zero coins and inventory. The local service persists saves. Preserve the complete `data/`, private configuration, signing state, Hermes sessions and external document results. Do not automatically replay real file work during an update.

先停止本项目写入服务，再创建并核验私有备份。以下目录应由 Agent 根据实际位置选择：

Stop the matching project's writers before creating and verifying a private backup. Choose backup paths for the actual installation:

```sh
node tools/data-backup.mjs create --out=../Hyper-Dimension-Backup
node tools/data-backup.mjs verify --backup=../Hyper-Dimension-Backup
```

在新源码目录重新执行部署检查与安装；按用户选择恢复进度。外部成果目录可在备份命令中通过 `--documents-root=允许目录` 明确指定。保留原档，遇到冲突报告真实错误，不清空数据换取启动成功。

Rebuild and verify the new source runtime, then restore the selected progress. Approved external result directories can be included with `--documents-root=PATH`. Retain originals and report conflicts without clearing data.

## 6. 交接证据 / Handoff evidence

Agent 应交付：目标 OS/架构、Node/Python/Hermes 版本、安装模式、命令退出码、运行版本、访问 URL，以及实际测试范围。实际验证登录、双画风共档、零资源采集、存档与新浏览器恢复；配置 AI 后另验居民回复和管家工作。平台自动检查、自然运行记录、实体设备及真人体验分别记录。

Report the target OS/architecture, runtime versions, setup mode, command exit codes, source version, URL and actual checks. Exercise login, shared saves across both appearances, collection, persistence and fresh-browser recovery. Verify residents and steward work after configuring AI. Keep automated checks, natural runs, physical-device results and human experience separate.

历史说明保留于[部署记录](docs/deployment-notes-through-v272.md)，当前验收证据见[验证索引](docs/VALIDATION.md)。
