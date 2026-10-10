# V157 · 迟到经营回包与界面导航

## 实际问题

从零开始的 V156 隔离旅程完成零币零库存、真实采集/采矿、手作、两笔订单与 185 秒正常作物生长后，点击派对被经营手账遮罩拦住。没有进入真实 Agent 协作，不计为旅程通过。

[独立复现](verification/v157/reproduced-before-fix.json) 拦住服务器已经生成的真实订单回包；原生关闭经营页面并打开岛屿手账，再放行回包。旧代码会用经营页面覆盖新手账：成功回调未检查玩家是否已经离开。不是浏览器卡住或未确认存档。V156 发行保持草稿。

## 修复

订单、补给、设施升级/维护、背包订单及物品操作使用已有界面导航令牌。已提交操作继续应用服务端结果、保存回执并更新 HUD；只有原页面仍是当前页面时，回调才刷新该页面。玩家关闭或打开另一页面后，不再被迟到回包拉回去。保存恢复卡片的必要核对行为保留。

[原生回归](verification/v157/native-modal-command-navigation.json) 覆盖六种操作、两套画风，共 12 组。真实成功响应先由服务器生成，再在关闭原页面/打开手账后放行。等待对应控制器实际结束，确认当前手账不被替换、服务端只有一份回执，刷新仍只有一份。使用授予物资、个人交付额度、资金和设施状态的隔离夹具，无结果或时间注入、无模型或用户数据。第一次折纸升级定位被手账遮挡，改用已有原生拖动方法暴露建筑后重跑；不是玩法放宽。

## 边界

这证明迟到成功回调的导航修复，不代表全部五条从零协作旅程、全部模型、真人品质或实体 Mac 验收。V155 Mac ARM 结算恢复超时的原原因仍未确认，不能用这个经营回调修复冒充该原因。最近完成的一小时来自 V152；全部 25 馆原生制作闭环来自 V153；真实主子协作复核来自 V155 进阶夹具。28F / 18R / 30T 范围与 4 完成 / 14 进行中保持。

## English

A V156 zero-start fixture completed native acquisition, crafting, two earned orders and normal crop growth, then a late successful order callback reopened business UI over the journal and blocked the next click. An isolated real-response barrier reproduced the issue. The journey did not reach real Agent cooperation and is not counted as passed; V156 remains draft.

Business orders/supplies, facility upgrades/maintenance, inventory orders and item operations now use the existing navigation token. Server results, receipts and HUD updates still complete; the original modal is refreshed only while its navigation remains current. Closing it or opening another view is respected. Twelve native cases across both themes hold actual successful responses until after a native close/view change, verify the new journal persists, and confirm a unique receipt before/after refresh. Fixtures grant resources/credits/funds/condition; no clock/outcome injection, user data or models.

This validates the late-success navigation fix, not all zero-start/Agent/human/physical Mac requirements. The earlier Mac ARM checkpoint timeout cause remains unconfirmed and is separate. Full acceptance remains unfinished.
