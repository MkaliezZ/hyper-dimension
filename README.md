# Hyper Dimension

[中文](README.md) · [English](README.en.md) · [部署指南](island/DEPLOYMENT.md) · [教培模块](README.education.md)

**一座会生活的岛，和一位能办事的管家。**

采集、制作、经营、举办派对，与 AI 岛民自由交流；也能委托基于 Hermes 的 Agent 管家读取资料、整理计划和创建真实工作文档。像素与折纸共用同一小岛和存档。

## 先看看小岛

[![Hyper Dimension · 双画风小岛与 Agent 管家](island/docs/media/hyper-dimension-v169-living-agents-poster.png)](https://mkaliezz.github.io/hyper-dimension/#living)

[在线播放 30 秒演示](https://mkaliezz.github.io/hyper-dimension/#living) · [会客馆内部导览](https://mkaliezz.github.io/hyper-dimension/#gallery) · [源码与版本](https://github.com/MkaliezZ/hyper-dimension/releases)

1440p / 60 fps，原创 BGM。新地形片段来自 V169，居民、真实文档、主子 Agent 和小游戏片段保留各自录制版本与验证来源。个人资料和任务文件均为虚构示例。**小游戏目前为占位演示，玩法、美术与动画将继续优化。**

## 当前更新 · V172

修复保存期间进入小岛可能显示 `lan_busy` 错误 JSON 的问题。登录与页面入口读取已提交档案；明确忙碌时自动恢复。自动保存仅检查最近有效的周期备份，保留完整的恢复校验。双画风浏览器恢复与出行互斥测试通过。[修复与验证](island/docs/save-entry-v172.md)。

### V171 · 会客移动与建筑校准

联机会客移动支持连续改点，使用预计算通路及已确认路点插值，普通移动不再重建会客页面。25座生产建筑与16座住所按地块中心校准底座，修正贴图跨网格裁切、两侧装饰造成的偏移及不等比缩放。[修复与实测](island/docs/lobby-ground-v171.md)。

[已发布的V170部署包](https://github.com/MkaliezZ/hyper-dimension/releases/tag/v170) 已完成六项Windows／Mac ARM／Intel Mac检查与独立离线重建。V171 的平台 CI 尚有移动测试与农田导航失败，正在处理；本机修复测试与跨平台验收分别记录。

### V170 · 制作并发确认

制作领奖和关闭取消现在会等待已提交的居民事务确认，避免请求因短暂并发而丢失。丢失回包时保留原作业；明确核对后，再完成原关闭请求。双画风真实关卡的领取、取消和丢包恢复共六个原生场景通过，单次扣料与回执保护保持。[修复与验证](island/docs/reward-drain-v170.md)。

新地形与错落住所保留 V169；当前视频的地形与界面录制来源为 V169，三段 Agent／派对实录标记 V166。

### V169 · 山海地形与错落住所

- **更自然的海岛**：山岭、丘陵、瀑布、溪谷梯田、洞口与不规则海湾，连续底图以 30 块原生高清区域加载。
- **错落的生活区**：25 种生产建筑沿道路和地形分布，15 位 AI 岛民及管家各有不同的住所；会客馆在同一主岛，码头保留独立进出通路。
- **同一身份与进度**：两套画风共享建筑、住所和存档。旧地图存档先备份再迁移，保留钱物、制作记录和角色档案；恢复或导入旧备份也会适配新地图。
- **连续移动**：按距离处理连续路点，保持不同刷新率下的速度和朝向；建筑入口和奇观陈列空间已随新地形校准。

[地形实现与验证范围](island/docs/geography-v169.md) · [整体验证记录](island/docs/VALIDATION.md)

## 在岛上做什么

| 体验 | 内容 |
| --- | --- |
| 从零经营 | 25 种生产建筑、50 种基础素材、300 个配方；采集、制作、游客消费与岛务开支。一个经营日为 900 秒有效游戏时间。 |
| 与居民生活 | 15 位 AI NPC 根据职业、性格和关系行动，支持自由对话、居民交谈与合作。模型为 DeepSeek V4.1 Flash。 |
| 委托管家 | 自定义姓名、12 种形象；Hermes 读取委托资料、创建文档、追踪任务，并招募临时 Agent 伙伴协作。 |
| 展示与接待 | 岛主会客馆展示介绍、教育／就业／人生经历、项目与图片；支持上传、草稿、发布、访客留言和回复。 |
| 带管家来访 | 联机会客厅、随行 NPC、原机管家桥接及标准 A2A 通信，共用有来源的协作记录。跨设备使用需要配对与目标设备在线。 |
| 双画风 | 像素／折纸的地图、建筑、人物、房间、物品和 UI；高清分块、海面水纹与近岸浪。 |

季节周期接口为每季 30 个视觉日。扩容后的全地图四季美术、可利用的天气、昼夜灯光与居民作息正在继续开发；住所本次先提供外观、身份档案及交流入口。

## 实际运行画面

| 像素海岛 | 折纸海岛 |
| --- | --- |
| ![V171 像素海岛](island/docs/screenshots/v171-pixel-island.png) | ![V171 折纸海岛](island/docs/screenshots/v171-origami-island.png) |

## 交给开发 Agent 部署

交付形态为**源码、素材、固定依赖与机器可读部署协议**。支持 Windows x64、macOS 14+ 的 Apple Silicon / Intel；Ubuntu 也可运行。克隆仓库后进入 `island/`，Release 源码包直接以游戏目录为根。

让具备终端和文件权限的 Agent 阅读 [AGENTS.md](island/AGENTS.md)、[deploy.json](island/deploy.json) 和 [DEPLOYMENT.md](island/DEPLOYMENT.md)，执行：

```sh
node tools/agent-deploy.mjs plan
node tools/agent-deploy.mjs doctor --python=python
node tools/agent-deploy.mjs setup --python=python --offline
node tools/agent-deploy.mjs verify
node tools/agent-deploy.mjs run --mode=lan
```

macOS 通常使用 `--python=python3`；推荐 Node.js 24 与 Python 3.11。`--offline` 使用包内固定依赖，Windows/macOS CPython 3.11 可用。

- `lan`：会客厅与小岛，默认 `http://127.0.0.1:4175/play`。
- `pixel` / `origami`：独立启动方式；画风仍是同一存档的外观选择。
- API 密钥只写入目标机私有 `.env.local` 或环境变量；无密钥可运行规则模式。
- 更新时保留 `data/`、私有配置和原机工作目录，按部署指南备份后迁移。

## 开发与接口

- [游戏源码与部署](island/AGENTS.md) · [标准 A2A 1.0](island/docs/a2a-standard-v158.md) · [原机工作区桥接](island/docs/device-bridge-v138.md)
- [物资与配方](island/docs/production-contracts-v114.md) · [经营趋势](island/docs/economy-v143.md) · [居民生活](island/docs/resident-life-v112.md)
- [验证范围](island/docs/VALIDATION.md) · [GitHub Actions](https://github.com/MkaliezZ/hyper-dimension/actions) · [版本发布](https://github.com/MkaliezZ/hyper-dimension/releases)

## 许可

代码遵循 [MIT](LICENSE)，第三方组件见 [声明](island/THIRD_PARTY_NOTICES.md)。新增海岛美术为本项目生成素材；公开媒体只使用隔离演示岛与虚构资料。
