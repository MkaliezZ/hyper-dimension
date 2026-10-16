# V242 · 旧档恢复、游客交易与多岛验证

## 旧档恢复

联机入口此前直接打开受保护存档，遗漏了独立入口已有的经济规则迁移。旧档仍由服务端确认 policy105，浏览器却已经使用 policy202，后续自动保存会被正确拒绝，表现为反复核对进度。

两个入口现在调用同一个迁移步骤：先保留旧档备份，再同步状态与服务端核算快照。已经开始的一天沿用原账单，下一天采用现行规则；尚未开始计时的新一天可以立即采用现行规则。不补发货币或物品，不重置进度，不跳过存档校验。

四项规则回归核对独立钱包、联机钱包、未完成居民任务及唯一结算，以及损坏档案拒绝。修复前前三项失败，修复后四项通过。另用此前实际失败的虚构旧联机档案，在空浏览器中完成正常进入、管家分工查看、自动保存及刷新；原库存、账目、预留、任务、招聘记录与居民作业票据在迁移响应中保留。该档案不是用户原存档。

双画风的可复现浏览器检查还覆盖零进度旧规则档案的正常保存、画风事务及刷新。零有效秒时迁移当天生效；首轮测试错误期待延后一天，失败保留，依据现有规则修正预期。已过有效时间的迁移继续由规则检查与历史档案核对延后生效。

## 游客商品闭环

双画风分别从服务端零币、零库存开始，实际采集、制作组件、刷新续做成品、主动上架、留用量设置、游客乘船上岛步行购买、扣库存和刷新后保存通过。一笔交易的收入／费用／净入账为 7／3／4 岛币。

购买者到达必须在有限游客轮换内发生；原 150 秒道路与服务预算从合适购买者到达时开始。没有提高物品售价、设施品质、需求、船班频率或经济增长。V233 独立安装候选曾在旧的总体等待预期处失败，该候选仍保持失败；本轮通过不追溯修改旧结果。

## 多岛与真实 AI

四个活动种类（茶会、服装、陶艺、厨房）× 三档难度 × 两套主岛画风，共 24 个完整服务端案例通过。每例四个独立账户均携带各自管家和两位同意随行的居民；活动输入通过 HTTP 提交，三个来宾实际挑战后结算。核对标准 A2A 路由、资金物资守恒、重放唯一性、取消退款、重启续接、评分订阅与返岛保存。时间、进展资源和本组管家回复明确使用夹具；原每例 180 秒墙钟及 3750 次模拟步数上限保留。

另做两次真实 DeepSeek Flash 跨岛居民交谈，每套画风一次。原岛归属、人物身份、对话行、实际运行账本、返岛后历史及服务重启持久化均核对。使用零资源账户和明确的交通观察时钟，模型响应期间不推进交通时间；不据此宣称真实时间调度或实体多设备通过。原始响应及凭据不公开。此前 22 轮真实 Hermes A2A 另有记录，本轮居民对话不计作新增 22 轮管家运行。

## 复现

```sh
npm test
npm run test:legacy-policy
npm run test:zero-market
npm run test:network-matrix
```

真实模型居民交谈需明确设置 `HD_QA_REAL_SOCIAL=1`，配置自己的私有 `DEEPSEEK_API_KEY`、部署指南所需运行时，并指定隔离的 `HD_QA_OUT`，再执行 `npm run test:real-travel-social`。它会产生真实模型费用；未设置明确标志时直接拒绝运行。运行目录和凭据不进入源码包。

上述自动检查不能替代正式 OPC 学员课程、5–8 位真实新玩家、实体多设备、全量零开局长期经济、最终源码包独立安装或当前版本一小时检查。新视频与最终交付包仍另行封存，整个目标保持进行中。见[证据摘要](verification/v242/priority-closeout.json)。

## English summary

LAN and standalone opens now share the acknowledged economy-policy migration, backing up the old document and retaining unfinished work, inventory and accounting. The exact fictional legacy save that previously failed can now open, autosave and reload normally. Native zero-start production-to-visitor sales, 24 HTTP-backed four-owner activity cases, and two actual Flash cross-island resident conversations passed within their declared scopes. Controlled transport clocks, fixture replies and real provider runs are recorded separately. Actual learners/new players, physical devices and final frozen delivery checks remain pending.
