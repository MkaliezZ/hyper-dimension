# V114 · 制作材料契约与居民活动分流 / Accepted crafting costs and resident dispatch

## 中文

玩家和居民开工时，服务端现在保存该批次的配方、产物、建筑、等级和材料数量。继续制作、通关结算与取消归还均使用这份已确认的材料单；调整后续配方不会追溯改动在制品的用料。工具预留与实际消耗材料分开处理，重复领取仍返回同一张结果回执。

此前版本的玩家制作记录没有独立材料单，本版从保留的 V32 配方定义恢复；居民记录使用开工时已经保存的材料数量。冻结历史定义文件 `src/legacyRecipeDefinitions-v32.js` 必须保留，未来改配方时不能同步改写它。新记录由服务端生成，客户端不能提交自选材料价格或通过自动存档改写预留。

修正普通居民社交暂时不可执行时的分流：若同伴正在忙碌或双方处于冷却期，重新选择一个实际可执行的生活/工作目的，不再把“交谈”当作单人制作活动。管家和临时 Agent 的日常安排也不会被误送入只支持 15 名普通居民的关系会议。Hermes 委托与既有 Agent 通信入口继续使用各自运行时；这次修复不宣称补齐所有 Agent 自发社交玩法。

默认回归 716/716 通过；现有 4 个岛屿存档完成只读兼容校验。

### 验证范围

- 300 个配方材料单校验；新旧玩家/居民记录跨配方调整、重开服务、取消归还、保留工具、重复领取和篡改拒绝。
- 两画风浏览器使用隔离存档：99 份材料、一份已按树皮 3 / 纤维 2 开工的航海日志，而当前配方为 1 / 1。原生按钮继续、刷新、点击连连看通关、服务端结算，均展示并按旧批次材料单扣除一次。
- 同一实机检查中，低社交需求的管家实际行走并完成日常活动；没有 `resident_invalid` 或页面错误。
- 针对普通居民冷却/忙碌同伴的运行器测试，保留原有正常社交与饥饿/体力优先级。
- 检查不调用模型，不修改真实用户存档。它不替代长时行为、自然情感变化、真人或 Mac 实机验收。小游戏仍是持续优化中的占位演示。

## English

The server now records a batch's accepted recipe identity, product, venue, tier and material quantities. Resume, completion and cancellation use that record even if a later release changes recipe costs. Reusable tools stay separate from ingredients. Duplicate claims remain idempotent.

Older player batches recover costs from the frozen V32 definitions; resident batches already contain their original costs. Keep `src/legacyRecipeDefinitions-v32.js` immutable when changing future recipes. Contracts are constructed by the server, and client-supplied prices or autosave changes cannot rewrite them.

Unavailable resident conversations are re-planned into executable work or personal activities instead of falling through to a single-actor work endpoint. Butler and temporary Agent routines no longer enter the ordinary-resident relationship dispatcher. Hermes work and existing Agent communication retain their separate runtimes; this patch does not claim complete autonomous Agent social gameplay.

All 716 default checks passed, and four existing island saves passed read-only state/action validation. Targeted checks cover all 300 definitions, legacy and new batches, changes during production, reopen, cancellation, tool retention, duplicate claims and tamper rejection. Both themes passed native browser resume/reload, real link-game completion and one authoritative deduction using an isolated previously accepted 3/2 batch against the current 1/1 definition. Both also completed a real butler leisure action without invalid-action or page errors. Fixtures are explicitly seeded; models and real user data are excluded. This is not full long-duration, natural-social, human or physical-Mac acceptance.

## Commands

```sh
npm test
npm run test:recipe-contracts
npm run test:recipe-contracts:browser
```

Before deployment, back up data and update the frontend and backend together. Do not migrate or reset existing islands solely to adopt this patch.
