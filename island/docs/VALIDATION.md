# Validation / 验收说明 · V107

## 中文

这是公开开发快照。自动测试、可部署与完整产品签收分开记录。

| 检查 | 结果与边界 |
| --- | --- |
| 默认规则 | 659 / 659 通过；真实候选与独立解压版本分别运行。 |
| Windows 部署 | Node 24.19、Python 3.11.15，独立目录离线安装及原生依赖导入通过。 |
| 四种浏览器模式 | 像素 / 折纸 × 单机 / LAN：新岛零资源、真实采集、存档、空浏览器重开；无页面或资源加载错误。 |
| 管家配方任务 | 两画风通过真实 Hermes / deepseek-flash 下发一项配方任务；居民实际走路、采矿、进工坊制作，服务器仅确认一次灯笼产出；空浏览器恢复已完成任务。未注入库存、人物位置或加速时钟。 |
| 途中改派 | 四项回归分别模拟行走中收到木料 / 矿石，验证先改道再申请作业；改前失败、改后通过，保留服务端权限门槛。此项使用明确的合成物资交付夹具。 |
| 经济 | 2 画风 × 6 场景 × 30 游戏日；真实领域规则、自动居民 / 游客过程，玩家订单输入为合成。稳定期挂机全成本日均 −5.72 至 −4.20，主动订单 +4.44 至 +5.32；无经济公式改动。 |
| macOS | 14+ ARM / Intel 条件依赖闭包与 108 个 vendor 文件摘要核对；无实体 Mac 执行。 |
| 实机视频 | 30 秒、3840 × 2160、H.264 / AAC、原创 BGM。隔离岛、真实 DeepSeek 决策、53 秒完成的三星烹饪练习，以及真实 Hermes 读取虚构资料、生成并回读 DOCX。镜头剪辑省略等待，路径遮罩；小游戏明确标为占位演示。 |

V106 已完成双画风实际一小时，V107 没有重复完整一小时。这些历史结果不能替代 V107 的最新完整验收。原始内部日志、运行标识和本机路径不公开；公开摘要保留范围和限制。

待验包括：跨设备原属管家桥接；更多真实多岛、多用户与 A2A 协作；十场真实主子合作活动；25 馆人工体验与声音打磨；完整主动经营与招聘工资、五类活动组合；OPC 新用户课程；实体 Mac 与真人签收。原有 18 项主需求仍为 4 项本地闭环、14 项进行中。

## English

This is a development snapshot. Automated checks and deployability do not constitute full product acceptance.

- **659 default checks passed**, on both the candidate and an independently extracted package.
- **Windows offline setup** passed with Node 24.19 and Python 3.11.15, including native dependency imports.
- **Four browser modes** passed: both themes in standalone and LAN modes, starting empty, gathering, saving and reopening with fresh browser storage.
- **Two native Hermes / Flash recipe assignments** completed with actual travel, mining, indoor crafting, exactly-once protected delivery and fresh-browser recovery. No stock, position or clock injection.
- **Four en-route reassignment regressions** deliberately simulate an ingredient arriving during travel. These are synthetic race fixtures, not live provider reproductions.
- **Twelve 30-day economic simulations** use real domain rules and synthetic player order inputs. Stable full-cost daily net is slightly negative for passive play and positive with one daily handmade order. This is not complete live-AI / party / hiring economic acceptance.
- **macOS dependency and package checks passed**, but physical Mac execution has not been verified.
- **The 30-second 4K video** includes an original score, actual DeepSeek decisions, a three-star kitchen practice completion (53 seconds of real play), and native Hermes producing a verified DOCX from a fictional brief. Editing omits waiting; local paths are masked. The minigames are explicitly labeled placeholder demonstrations whose gameplay, art and animation remain in development.

The prior V106 one-hour runs apply to V106. V107 has not repeated a complete one-hour run. Human quality review, physical multi-device and Mac testing, broader cooperative events, cross-device steward bridging and OPC newcomer courses remain open.
