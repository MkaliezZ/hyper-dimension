# Hyper Dimension

[中文](README.md) · [English](README.en.md) · [部署指南](island/DEPLOYMENT.md) · [教培模块](README.education.md)

**一座会生活的岛，和一位能办事的管家。**

在像素与折纸双画风的小岛上采集、制作、经营，与 AI 居民交流；也能委托基于 Hermes 的 Agent 管家读取资料、整理计划、创建真实工作文件。两种画风共用同一存档和个人档案。当前为 **V138 开发快照**，完整产品验收仍在进行。

## 看一眼这座岛

[![Hyper Dimension · 当前版本 30 秒演示](island/docs/media/hyper-dimension-v138-bridge-poster.png)](https://mkaliezz.github.io/hyper-dimension/#bridge)

[30 秒宣传片](https://mkaliezz.github.io/hyper-dimension/#overview) · [45 秒完整演示](https://mkaliezz.github.io/hyper-dimension/#tour) · [45 秒会客馆内部导览](https://mkaliezz.github.io/hyper-dimension/#gallery) · [当前源码交付包](https://github.com/MkaliezZ/hyper-dimension/releases/tag/v138)

点击封面或视频标题即可打开在线播放页；MP4 下载在播放器内单独提供。新增 45 秒会客馆内部导览，展示介绍、八段人生／教育／就业经历、三个项目及配图、访客留言与岛主回复，以及双画风展厅。

本版视频为 2560 × 1440、60 fps 的实际页面录制，包含会客馆内部档案、项目图片与留言。工作资料、个人经历和图片均为虚构示例；管家文件任务实际调用 Hermes 工具执行。**小游戏目前是占位演示，玩法、美术与动画将继续优化。** [录制与验证说明](island/docs/showcase-v135.md)。

## 你能做什么

| 体验 | 当前内容 |
| --- | --- |
| 经营小岛 | 25 种生产建筑、50 种基础素材、300 个配方，采集、制作、游客消费与岛务开支。每经营日为 900 秒有效游戏时间。 |
| 与 AI 居民生活 | 15 位 AI 居民根据职业、性格和关系行动；支持自由交流、居民之间的对话与共同工作。模型固定 DeepSeek V4.1 Flash。 |
| 委托 Agent 管家 | 独立对话入口、12 种可选形象；可读取主动委托的本机资料、创建文档，并通过可追踪的任务协议招募临时 Agent 伙伴。 |
| 展示自己、接待访客 | 岛主会客馆展示介绍、人生／教育／就业经历、项目与图片；支持文件上传、私有草稿、主动发布、登录访客留言与岛主回复。 |
| 切换两种美术 | 同一小岛切换像素／折纸外观；连续高清分块地形、主题房间和 UI、海面水纹与近岸浪。 |
| 看四季变化 | 季节树木、花瓣、落叶和雪晶；每季 30 个视觉日，完整四季 120 日。昼夜视觉效果暂时关闭，统一服务器时钟接口保留。 |

### 实际运行画面

| 折纸海岛 | 像素海岛 |
| --- | --- |
| ![折纸海岛](island/docs/screenshots/v134-origami-island.png) | ![像素海岛](island/docs/screenshots/v134-pixel-island.png) |

| 折纸会客馆内部 | 像素会客馆内部 |
| --- | --- |
| ![折纸档案展厅 · 虚构示例](island/docs/screenshots/v135-origami-gallery.png) | ![像素档案展厅 · 虚构示例](island/docs/screenshots/v135-pixel-gallery.png) |

| 人生与教育经历 | 项目和图片 |
| --- | --- |
| ![经历展陈 · 虚构示例](island/docs/screenshots/v135-origami-experiences.png) | ![项目展陈 · 虚构示例](island/docs/screenshots/v135-origami-projects.png) |

| 管家之间的真实回信 · 折纸 | 管家之间的真实回信 · 像素 |
| --- | --- |
| ![折纸管家通信 · 虚构测试岛主](island/docs/screenshots/v137-origami-a2a.png) | ![像素管家通信 · 虚构测试岛主](island/docs/screenshots/v137-pixel-a2a.png) |

双方各自的 Hermes／DeepSeek Flash 管家，交换服务端确认的岛屿见闻。截图使用虚构测试身份，回信来自真实 Agent。

[在线播放最新 30 秒演示](https://mkaliezz.github.io/hyper-dimension/#bridge)：双风格当前岛屿、连接原机、真实虚构文档修改与回读、两位原机管家的通信记录。已有小岛／会客馆视频保留 V135 标记。[录制说明](island/docs/showcase-v138.md)。

## 管家随行，工作区也随行

在管家入口选择「连接原机」，核对配对标记后，自己的 Hermes 管家在原机处理文件；拜访另一座岛时仍可继续委托，也能与岛主的管家交换岛屿见闻。原机离线会明确显示，不会把文件工作转交到另一台电脑。[连接与恢复说明](island/docs/device-bridge-v138.md)。

## 交给任意开发 Agent 部署

交付形态是**源码、资源、固定依赖和机器可读部署协议**。Agent 需要有终端和文件权限。克隆仓库后进入 `island/`；若解压 Release 源码包，直接在解压目录操作。

先让 Agent 阅读 [AGENTS.md](island/AGENTS.md)、[deploy.json](island/deploy.json) 和 [DEPLOYMENT.md](island/DEPLOYMENT.md)。推荐 Node.js 24、Python 3.11；支持 Windows x64 与 macOS 14+ 的 Apple Silicon／Intel。

Windows PowerShell：

```powershell
cd island
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python
node tools/agent-deploy.mjs setup --python=python --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

macOS Terminal：

```sh
cd island
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python3.11
node tools/agent-deploy.mjs setup --python=python3.11 --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

默认入口为 `http://127.0.0.1:4175/play`，本机日志提供首次注册信息。单机入口使用 `run --mode=pixel`（4173）或 `run --mode=origami`（4174）。局域网监听需按部署指南显式配置。

`setup` 创建私有 `.env.local`。按需填写自己的 `DEEPSEEK_API_KEY`，模型使用 `deepseek-flash`，无 Pro 回退。未配置密钥可运行画面和本地规则，AI 对话与 Agent 工具执行需要正确配置后才能使用。

## 当前状态与验证范围

管家支持自定义展示姓名：管家 → 管家档案 → 展示姓名 → 保存档案；名称随服务端存档保留，切换画风与随行登岛继续使用。

V137 添加跨岛管家信息交流：双方开启接收后，各自的 Hermes 管家可以交换岛上见闻并接续讨论，刷新后保留署名与信件。首盏灯的新手引导同步当前材料配方。[交流说明](island/docs/a2a-information-v137.md)。

V136 补齐管家委托的持久化与异常恢复：保存后寄出，丢失回复或刷新时核对原结果，避免重复操作文件。双画风已使用真实 Hermes／Flash 文档工具验证。[恢复说明](island/docs/steward-recovery-v136.md)。当前影片录于 V135，画面与美术保持一致。

V135 调整会客馆的双风格展厅、档案排版、经历时间线、项目照片与留言页。双画风实际编辑、上传、发布、刷新恢复和访客留言流程通过。[会客馆说明](island/docs/gallery-ui-v135.md)。

V134 完成连续地形、30 日换季和昼夜视觉暂停，807 项领域／维护检查、相关原生浏览器场景及 Windows／两架构 macOS CI 通过。[地形验证](island/docs/continuous-terrain-v134.md) · [部署 CI](https://github.com/MkaliezZ/hyper-dimension/actions/workflows/island-deploy.yml)。CI 与开发 Windows 机器的限定场景检查，不等于实体 Mac 和完整真人游戏验收。

## 文档与仓库

- [部署与数据迁移](island/DEPLOYMENT.md) · [隐私边界](island/docs/PRIVACY.md) · [素材来源](island/docs/ASSETS.md)
- [会客馆发布与留言](island/docs/portfolio-v130.md) · [共享时令接口](island/docs/environment-v131.md) · [版本记录](island/docs/CHANGELOG.md)
- [教培模块](README.education.md)：海岛与原有教培业务的完整整合仍在进行。

```text
island/                 Game, Agent runtime, assets and tests
  AGENTS.md · deploy.json · DEPLOYMENT.md
  src/ · server/        Frontend and local services
  public/ · vendor/     Dual-style assets and pinned dependencies
  docs/                 Guides, screenshots and verification
src/hyper_dimension/    Existing education business module
web/ · migrations/      Education frontend and database baseline
README.education.md     Education setup and documentation
```

开发检查在海岛源码目录执行 `npm test`，部署校验执行 `node tools/agent-deploy.mjs verify`。更新前停止本项目写入进程，并创建、验证私有备份；运行时应在各目标平台重建。

公库不包含密钥、真实用户存档、聊天历史、现实工作文档或已安装运行时。模型与文件任务使用你配置的服务；详见[隐私说明](island/docs/PRIVACY.md)。

## 许可与致谢

原创代码与文档沿用仓库 [MIT License](LICENSE)；Hermes Agent、Playwright、Fusion Pixel Font 与各依赖保留自身许可证，见[第三方说明](island/THIRD_PARTY_NOTICES.md)。美术来源与许可另见[素材说明](island/docs/ASSETS.md)。
