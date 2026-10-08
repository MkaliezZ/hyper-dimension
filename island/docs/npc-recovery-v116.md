# V116 · Resident meal planning and model reply handling

## 本次修改

- 居民选择餐点时会参考其他居民已安排的用餐路线，避免多人同时为仅剩一份的食物出发。路线意向只影响规划；库存仍由服务端预留和结算。
- 到店后复核餐点余量：同场所有其他餐点则改用，否则退出并重新安排。已确认缺货的请求无需再额外等待一轮；未确认的请求仍走原有回执恢复。
- 模型回复允许完整 JSON 对象外的一层标准代码围栏及 BOM，拒绝截断、重复键、多个对象和附加说明。错误区分为格式、未完整结束、连接和 HTTP 问题，服务端记录实际已报告的用量。
- DeepSeek V4.1 Flash / `deepseek-flash`、300 / 600 / 950 秒自动间隔保持不变，不追加模型请求或重试。

## 验证与边界

726 项默认 Node 检查通过，其中一个检查运行 6 项 Python 模型契约检查；另有 31 项针对性回归。两套画风均在隔离存档中，以正常游戏时间验证两名饥饿居民面对一份面包：一名用餐，另一名采集蘑菇并完成用餐。两次实测均无缺货请求或页面错误，库存结算由实际服务端接受。

以上验证未调用真实模型、未改写用户存档。该修复不会自动修复任意错误 JSON，也不能证明旧记录中未保留原文的格式错误已经消除。完整零起点经营、最新版本一小时验收及全部游戏品质验收仍待完成。

## Changes

Residents account for other planned meals before traveling and recheck availability on arrival. Walking plans are advisory; the server still owns stock reservations and settlement. A confirmed unavailable meal triggers replanning, while uncertain requests retain the existing receipt recovery flow.

The model parser accepts a complete JSON object with an optional single standard code fence or BOM. Truncated, ambiguous and non-object replies remain errors. Typed error records distinguish incomplete replies, invalid formats, connection failures and HTTP failures, retaining reported usage. The pinned Flash model and automatic cadence are unchanged, with no additional provider calls.

## Evidence and limits

726 default Node checks passed, including a wrapper running six Python contract checks, plus 31 targeted regressions. Both visual themes completed a native scarce-food scenario at normal game speed: one resident ate the only bread, and another gathered mushrooms and then ate them. Actual server settlement succeeded with no missing-food requests or page errors. These isolated checks used no real provider calls or user saves; they are not a complete product or physical-Mac acceptance.

Run `npm run test:npc-recovery` for targeted checks. `npm run test:npc-meals:browser` requires the project's browser test dependencies and uses isolated data directories.
