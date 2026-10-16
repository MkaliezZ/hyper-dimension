# V202 · 经营慢增长与旧账单衔接

## 调整依据

重新运行当前版本的双画风经营矩阵后，V201 普通挂机日均完整运营净额低于原目标；每日完成一项手作订单也仍亏损。旧 V143 模拟结果保留为历史，不能继续当作当前版本的余额预测。

本次将每个开放设施的管理费从 1.68 调整为 1.2 岛币：25 处普通设施的每日基础岛务由 84 变为 72。水电、公共补给、航务、优质体验养护仍分别列账；高品质设施还有相应养护费。游客报价、服务成本、订单、派对、材料和招聘工资未改，离线不计费，也不发离线奖励。

## 当前矩阵结果

下表为第 6–60 个游戏日的平均**完整运营净额**，已计入精简运营减免，减免不当作盈利。每个游戏日900秒有效时间，单日会波动。

| 场景 | 像素：岛币／日 | 折纸：岛币／日 |
| --- | ---: | ---: |
| 普通经营 · 挂机 | -0.40 | -1.93 |
| 普通经营 · 每日一项手作订单 | +9.67 | +8.85 |
| 成熟经营 · 挂机 | +6.24 | +4.29 |
| 成熟经营 · 每日一项手作订单 | +15.60 | +15.11 |
| 零币零库存开局 · 挂机 | -2.25 | -0.42 |
| 零币零库存开局 · 每日一项手作订单 | +9.05 | +9.16 |

成熟挂机保持小幅正平均，每日一项手作订单进一步改善收入；所有12组都通过原有收益上限、完整成本比率、现金守恒和后期增长回归。另将“成熟挂机完整成本后的均值须为正”写入矩阵，避免将亏损误记为成熟经营达标。

模拟以0.2秒步长加速运行真实居民、游客、寻路、作物与日结领域逻辑，模型接口屏蔽。采集和递归制作由脚本输入；成熟场景直接设置最高升级和品质，未包含此前投资和回本过程。这里尚未证明完整五类活动、工资、招聘、升级、真人制作时间的组合长线经济，也不是一小时实时稳定性或真人娱乐性签收。

## 旧存档

已开始的旧游戏日保留原V105账单，下一游戏日才切换V202；旧日结、钱包、库存、活动和任务回执保持原记录。存档开启动作使用共享策略版本，避免重复迁移带来的无意义版本变化。

实际由V201存档服务写出的两画风旧档，在候选服务与原生浏览器中完成当天84币结算、次日72币展示、历史比对、刷新恢复与390像素窄屏检查。测试预置两个已结算日及第3天880秒，之后用正常页面时间跨日；它不是从零完整玩过三天。

## 部署与复现

离线安装新增解释器预检，详见[部署指南](../DEPLOYMENT.md#离线及已验证范围)。不兼容的Python版本、位数或平台在写运行环境与存档目录前返回具体原因。Windows/macOS离线需64位CPython3.11；Python3.12/3.13与Ubuntu使用联网安装。

```sh
node --test tests/v105-budget-policy.test.mjs tests/v105-routing-migration.test.mjs
python tests/v202-offline-prerequisites.test.py
node tests/v26-economy-simulation.mjs
```

矩阵默认30天；重现本报告请设置环境变量 `HD_ECON_DAYS=60` 和独立 `HD_ECON_QA_DIR`。数据：[当前完整结果](verification/v202/economy-900s.json)、[V201对照及失败项](verification/v202/economy-v201-baseline.json)、[范围摘要](verification/v202/verification.json)。

当前不可变V201包的25类生产建筑已分别在两画风完成原生操作、唯一制作结算、刷新恢复及窄屏结果页检查，共50个流程。像素集市三消的一次合法失败保留，经原生重新开始确认材料未消耗，再正常通关；没有降低游戏规则或强制获胜。提供材料、读取解法的自动操作不能替代手感、难度、声音美术和新人体验验收。

## English

V202 lowers facility management from 1.68 to 1.2 coins per open venue, bringing the normal 25-venue daily bill from 84 to 72. Mature islands show a modest passive surplus in the dual-style 60-day domain simulation; one daily manual commission improves income. Existing in-progress days keep their original bill and switch the following day. Historical ledgers and receipts are retained.

All 12 scenarios pass the existing cash-conservation, cost-ratio and bounded-growth checks, plus a positive mature-passive average. Player inputs and maximum-upgrade initial states are synthetic; this is not a combined all-event/recruitment/investment/human or real-time hour acceptance. Native old-save migration/reload/mobile checks pass in both styles. The current immutable V201 source additionally has 50 native building-game production flows, with one legitimate loss and zero-cost retry retained. Offline preflight rejects incompatible interpreters before writes; Windows/macOS offline uses 64-bit CPython 3.11, while Ubuntu and Python 3.12/3.13 use online installation.
