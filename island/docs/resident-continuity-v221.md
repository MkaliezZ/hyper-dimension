# V221 · 刷新后的居民生活连续性 / Resident continuity after reload

## 发现与修复

居民的休闲、社交及失败后重试截止值原本使用页面计时，而页面刷新后计时从零开始。旧存档可能因此把已经结束的短等待重新解释成数千秒等待；近期场所的重复访问权重也会失真。这影响自主生活选项，不等于所有居民完全停止行动。

现在新事件同时记录有效游戏时间截止值与兼容旧客户端的页面截止值。读取旧记录时，从事件保存的游戏日、当日有效秒数和页面时间还原剩余等待。无法可靠锚定的旧字段只保留当前页范围内合理的短等待，异常远期值不产生新的长等待。读取过程不删除经历或重置关系。

保留原规则：社交间隔 300 秒、个人休闲 65 秒、失败重试 30 秒；关系中的一天空间与三天恋爱边界不变。模型调用仍采用 300 / 600 / 950 秒间隔。离线关闭页面不推进有效游戏时间。

## 同步的目录显示

角色页与背包根据当前目录计算 58 种素材、308 个配方、366 种已知物品。未知旧字段保留，但不计入当前图鉴总数。发现物品与亲手采集成就仍为不同记录；初版 50 / 300 成就集合保持原定义。

## 验证边界

- 在已完成的 V217 一小时虚构测试存档副本上，以新页面时间 3 秒比较原 V219 选择逻辑与当前逻辑。两套旧逻辑均没有休闲选项；新逻辑分别恢复 18 / 22 个休闲选项与 8 / 9 个社交选项。这是条件分支的只读对比，不是让旧一小时测试成为 V221 的长时验收。
- 双画风各检查两种真实隔离 LAN 页面：已结束的旧等待释放后，居民自行赴约并完成四句本地规则和解对话，产生新等待；尚未结束的新等待在实际保存及刷新后保留。使用普通速率和道路移动。初始经历、关系与需求为明确夹具；模型接口关闭，对话不声称为模型生成或真人行为。
- 新增九项规则测试覆盖剩余时长、跨有效游戏日、旧客户端改写、异常记录、近期访问权重，以及实际服务器完成回执与磁盘重开幂等。测试时钟仅用于事务规则验证。
- 双画风角色页／背包及 390px 布局检查目录数量、筛选、旧字段保留与原成就集合。

旧客户端对照的两个已过期等待案例在 8 秒观察窗内未发起指定会面；新客户端按默认 30 秒会面、150 秒交谈完成预算检查。初次全量检查另有两个新测试目录旧名残留导致的 `ENOENT`，修正的是测试目录，原断言保留。原始失败及修复后报告分别保留于内部 QA。

完整自然长期故事分布、职业成长、丰富冲突后果、全部主动经营旅程、真人与实体多设备验收仍未完成；本次不缩减原十八项主需求。

## English

Resident pauses now follow effective island time across reloads. Legacy history reconstructs remaining pauses without deleting relationships or experiences, while new events retain a compatibility mirror. Existing pause durations, relationship boundaries, model cadence and offline-time rules remain unchanged.

Current catalog totals are derived from known definitions; legacy achievement universes and unknown saved fields remain intact. The evidence combines read-only old-fixture comparisons, rule/transaction tests and fictional native LAN reentry checks with local fallback dialogue. It does not establish current-version long-term play, human acceptance or physical multi-device validation.
