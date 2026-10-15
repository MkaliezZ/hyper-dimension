# Hyper Dimension

[中文](README.md) · [English](README.en.md)

**一座会生活的岛，和一位能办事的管家。**

采集、制作、经营、举办派对，与 AI 岛民自由交流；让 Hermes Agent 管家帮你整理资料、制定计划和创建真实工作文档。像素与折纸两种画风，共用同一小岛和存档。

## 看看小岛

[![Hyper Dimension · 小岛生活与 Agent 管家](island/docs/media/hyper-dimension-v169-living-agents-poster.png)](https://mkaliezz.github.io/hyper-dimension/#living)

[播放 30 秒演示](https://mkaliezz.github.io/hyper-dimension/#living) · [会客馆导览](https://mkaliezz.github.io/hyper-dimension/#gallery)

原创配乐，演示资料均为虚构示例，管家文档来自真实工具执行。**小游戏目前为占位演示，后续将继续优化。**

## 核心体验

| 玩法 | 内容 |
| --- | --- |
| 小岛经营 | 25 类功能建筑、19 种作物、58 种素材、308 个配方。采集、种植、制作，为居民和游客提供商品与活动。 |
| AI 居民 | 15 位居民拥有不同职业、性格与关系，可以自由对话、工作和共同生活。 |
| Agent 管家 | 自定义姓名与 12 套形象；通过 Hermes 处理现实工作，招募临时 Agent 伙伴分工协作。 |
| 四季与双画风 | 全岛分块地形、四季美术、海浪与天气；每季 30 个视觉日，天气影响种植和钓鱼。 |
| 展示与来访 | 会客馆展示经历、项目与图片，支持访客留言；联机会客厅支持随行 NPC、管家桥接与 A2A 交流。 |

| 像素 · 秋日 | 折纸 · 冬日 |
| --- | --- |
| ![像素秋日小岛](island/docs/media/season-v187-pixel-autumn.png) | ![折纸冬日小岛](island/docs/media/season-v187-origami-winter.png) |

## 快速开始

支持 **Windows x64、macOS 14+（Apple Silicon / Intel）**，也可在 Ubuntu 运行。准备 Node.js 24、Python 3.11。克隆仓库后进入 `island/`；源码包可直接在根目录执行。

```sh
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python
node tools/agent-deploy.mjs setup --python=python --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

macOS 将 `--python=python` 换为 `--python=python3`。启动后打开 `http://127.0.0.1:4175/play`。

API 密钥保存在私有 `.env.local`；无密钥可体验规则模式。更新前备份并保留 `data/` 和私有配置。也可以把源码交给任意具备终端权限的 Agent，按 [部署指南](island/DEPLOYMENT.md) 与 [AGENTS.md](island/AGENTS.md) 完成部署。

## 更多

[部署与配置](island/DEPLOYMENT.md) · [Agent / A2A](island/docs/a2a-standard-v158.md) · [版本下载](https://github.com/MkaliezZ/hyper-dimension/releases) · [教培模块](README.education.md)

代码采用 [MIT](LICENSE) 许可；第三方组件见 [声明](island/THIRD_PARTY_NOTICES.md)。
