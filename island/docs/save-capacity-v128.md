# V128 · 存档容量修复

## 原因与改动

早期存档状态上限为 2 MiB（2,097,152 字节）。持续生活产生的 NPC 作业回执和物资交易回执进入存档；旧容量可能阻止正常自动保存和新作业结算。这是应用接口限额，不是磁盘空间不足。超限时上次成功提交的文件保留，失败后的动作不能算作已保存。

- 单份游戏状态上限调整为 **16 MiB**；签名备份及导入文件上限调整为 **64 MiB**。前后端使用同一容量定义，HTTP 请求限额随之更新。
- 保留全部历史、防重复支付回执、任务证据、签名与权限校验；不清空小岛、不删交易记录。
- 达到新上限时返回明确的容量错误；浏览器保留暂存并提示导出和更新，不再误报服务未连接。
- 三个旧计划测试夹具改用当前灯笼材料单：木料、石英、蜡和纤维。任务依赖、在制物资和回执防伪断言保留。

## 验证范围

69 项相关规则通过：大存档保存、重开、签名导入、超限不覆盖、旧备份恢复、共享画风、物资和计划权限、原子文件写入。

原生 Edge 双画风、约 4.1 MiB 合成历史、300ms 人工网络延迟：每画风至少三次真实自动保存、移动持续、空浏览器恢复通过。该次短测最大帧间隔像素 18.2ms、折纸 24.3ms，未观察到超过 50ms 的主线程长任务；测量结束仍可有新的保存进行中。此范围不是一小时或全部设备性能验收。

另外对本机存档做私有隔离副本核对：跨过旧上限后保存并重开，所有原字段及 6511 条作业回执保留。副本和原始记录不进入公库或交付包。

## 仍需推进

本修复提高有界容量，**尚未实现历史回执独立归档**。历史增长和主存档传输量仍需从结构上优化；后续归档须保持防重复结算、活动证据和备份完整性。昼夜、四季、海浪、最新宣传视频及岛主会客馆仍是独立进行中的工作，未包含在这个紧急修复中。

## English

The old 2 MiB state limit could stop normal saves after NPC work and transaction receipts accumulated. This is an application payload limit, not a disk-space warning. The last successfully committed save remains intact; a rejected action is not saved.

The state limit is now **16 MiB**, with a **64 MiB** signed-backup/import limit shared between the server and file picker. All transaction evidence, replay protection, signatures and existing progress remain intact. Capacity failures have a distinct code and preserve pending browser data instead of reporting a network outage.

**69 related checks passed.** Both themes completed multiple real automatic saves of approximately 4.1 MiB synthetic history under 300ms added latency, while the actor continued moving, and recovered in fresh browser storage. Maximum measured frame gaps were 18.2/24.3ms, without observed >50ms main-thread tasks. These are short, isolated Windows checks, not full-product or physical Mac acceptance.

A private copy of the actual near-limit save also retained every original state field and 6511 task receipts after saving above the old limit. No private save data is published. Three older planning-test fixtures now use the current lantern ingredients while retaining their assertions.

Historical receipts are **not yet archived separately**; bounded capacity is an immediate fix, and long-term history/transfer growth remains open. The environment update, refreshed video and owner portfolio hall remain in development.
