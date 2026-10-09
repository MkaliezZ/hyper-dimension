# 原机管家连接 / Original-device steward bridge · V138

## 用户流程

在管家对话底部点击 **连接原机**，或在会客页面打开「管家 → 我的文档工作区 → 连接我的原机」。生成十分钟有效的配对码，复制命令到自己的源码部署目录，填写真实工作区路径。原机先运行 `node tools/agent-deploy.mjs setup`，并在私有 `.env.local` 或进程环境配置自己的 DeepSeek 密钥。两端核对六位标记，用户确认后生效。

```sh
node tools/steward-bridge.mjs --server=http://127.0.0.1:4175 --workspace="YOUR_WORKSPACE" --pair-code=HD-CODE --state-dir="data/device-clients/my-connection"
```

Windows 和 macOS 使用同一个 Node 入口；不依赖安装器。后续重连 **省略 `--pair-code`**，保留同一个 `--state-dir`、服务地址与工作区。解绑后再配对要使用新的状态目录，游戏生成的命令会分配独立目录。连接端持续运行，停止后在线状态在45秒内变为离线。非本机连接使用 HTTPS；现有受信局域网 HTTP 演示需明确添加 `--allow-insecure-lan`。这项显式选项仅用于受信局域网，不改变默认连接规则。

绑定后，手动文档委托、工作成果、临时 Agent 招募和管家通信由原机 Hermes 执行；岛上 AI 居民的日常决策继续使用岛屿服务。已绑定原机离线时，文档工作不会转到服务器偷偷执行。原机读取自己的密钥；配对不将模型密钥上传到岛屿服务。原机文件内容会按用户委托进入自己的 Hermes／Flash 调用，返回结果保留在本人私有手账；其他管家的信息交流仅使用确认的岛屿见闻。

## 回执与恢复

配对记录归属于账号。服务仅保存设备凭证摘要，原机私有状态目录保存连接凭证，不应提交或发给其他用户。每个委托先持久化再派发，原机工具执行前保存领取记录，执行结果先落盘再回报。回报丢失后重连只提交已存结果，不重做文件操作；执行途中断且成果无法确认时标记待核对，禁止自动重放。服务和原机同时重启后，已完整保存的结果可恢复到原请求手账。撤销设备不会让旧任务在另一个设备上重新执行。

## 本地证据与边界

九项桥接回归，加五项信息交流、七项活动通信回归，21/21通过。真实验收使用同一台 Windows 上的独立岛屿服务与两个 CLI 原机连接进程，分别在像素／折纸原生页面配对、确认、刷新和390像素窄屏关闭；两位管家实际读取、修改并回读虚构 Markdown，访客留在会客房间时仍可处理自己的文件。两位原机 Hermes／deepseek-flash 管家实际交换了岛屿见闻，账本与上一轮关联一致。原机和服务重启、丢失回执、防重复文件执行由真实 HTTP 与隔离文件夹具验证。

本项不代表物理跨设备、Mac 实机、公开网络代理配置、全部招募／联合活动、人类长时游玩或完整项目验收。通信协议仍是 Hyper Dimension 内部协议；不宣称已适配任意第三方 A2A 服务。原机退出、网络中断和设备解绑都有明确状态。

## English

Open **Connect original device** in the steward dialogue, or from the personal steward workspace in the lobby. Generate a ten-minute pairing code, run the source deployment setup on your own computer, configure your own private DeepSeek key, then run the command above with your workspace. Match the six-character verification marks and confirm in the game. Windows and macOS share the Node CLI. For reconnects, omit `--pair-code` and retain the same state directory, server and workspace. Re-pairing uses a new private state directory.

The original computer runs its own Hermes for manual document work, artifacts, recruitment and steward correspondence. Island resident decisions stay with the island service. Offline bound devices do not silently fall back to central document execution. The device reads its own key; pairing does not send that key to the island server. Credentials, journals, document outputs and game data belong in private `data`, never in a public release.

The broker persists delivery before tools start. The device saves its result before acknowledging. Reconnection submits a completed result without executing again; interrupted execution with uncertain file effects requires inspection. Owner checks, approval, revocation, lost acknowledgement and dual-process restart are covered by focused HTTP/filesystem tests. Arbitrary remote connections require HTTPS; trusted HTTP LAN demos explicitly use `--allow-insecure-lan`.

Native pairing, reload, narrow layout and fixed-close controls pass in both themes. Two separate original-device CLI processes use real Hermes/DeepSeek Flash to read, edit and read back fictional files, then exchange attributed canonical island information with linked run ledgers. This ran on one Windows computer. Physical multi-device/Mac, all recruitment and combined events, human testing and full acceptance are separate. This is the internal Hyper Dimension communication protocol, not universal third-party A2A compatibility.
