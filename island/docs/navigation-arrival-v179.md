# V179 · 到达与后台结算 / Arrival during background settlement

## 中文

后台居民或游客结算尚未返回时，已批准的路线会继续移动，但旧逻辑把所有到达回调留在终点。角色站在门口仍要等其他人的作业回复，队列较长时就像无法进入建筑。V177 的 Mac Intel 农活检查在刷新后进入农田处超时；当时的诊断显示最后一个路点、剩余距离为零，稍后截图已进入农田。本地使用实际居民作业的延迟回复复现了同型等待，不把该复现等同于 Mac 实机验证。

V179 只标记没有物资副作用的到达行为：农田、矿洞、建筑／住所信息、会客馆和经营概览。角色真正走到入口后即可打开这些场景和信息。采集、制作、派对恢复和游客转移回调继续等待确认，真实冲突、恢复、换画风等暂停仍由原来的保护处理。

完成行走但仍在等作业回执的角色会平滑回到站立姿态，保留待确认路点和回调。这样既不会反复踏步，也不会提前生产物品、下船或发放奖励。

玩家寻路使用独立、上限 0.75 秒的可见帧位移预算，修复慢帧丢弃移动时间。农田、工资、奖励的有效计时仍使用原来的 0.15 秒上限；隐藏页面不累计时间，显隐切换重置帧基线。

NPC 已获批准的农田、矿洞及居民作业继续推进原动作计时，结束后只提交原租约的完成请求。田地和物资仍由服务端回执更新；本地或尚未批准的回调继续等待，工具演出在动作末尾停下。NPC 松土／播种清除旧的雨水标记，实际 NPC 浇水标为 `npc`。

本轮报告的 V178 macOS 14 失败另有测试时序问题：旧检查用浏览器当下的获胜画面判断要延迟哪份 checkpoint，较早请求尚未提交获胜输入时就可能抢先注入居民作业。检查改为读取真实服务端回放的获胜结果，再延迟该批回执及注入独立作业。未修改获胜条件或领取断言。Intel Mac 的低帧率导航断言仍保留；美术与原生玩法拆成独立 CI 任务，避免串行累积达到任务时限，全部原有步骤保留。

## English

Approved movement continued while resident or visitor receipts were pending, but all arrival callbacks waited at the endpoint. A player could reach a door and still wait for unrelated work. The V177 Mac Intel soil-care check timed out after reload at the farm entry; diagnostics showed a final zero-distance waypoint, with the later screenshot already inside. A local test with an actual delayed resident response reproduced this waiting mechanism. It does not constitute a physical Mac reproduction.

V179 explicitly marks arrivals with no material effects: farm and mine scenes, building/home information, owner gallery and business overview. These views can open after actual arrival. Gathering, crafting, party resume and passenger transfers still wait for confirmation. Existing conflict, recovery and theme-change pauses remain in place.

Characters awaiting a work receipt ease into an idle pose while retaining their pending waypoint and callback. They neither step in place nor complete work or grant rewards early.

Player navigation now uses a separate visible-frame distance budget capped at 0.75 seconds. Protected crop, wage and reward time retains its 0.15-second limit. Hidden pages accrue neither budget; visibility transitions reset the frame baseline.

Approved NPC farm, mine and resident animations progress during unrelated receipts and submit their original completion leases once. Only server receipts change soil or inventory. Local and unapproved callbacks remain deferred and settle into an idle wait. NPC tilling and sowing clear stale rain markers; completed NPC watering is labeled `npc`.

The reported V178 macOS 14 failure also exposed a test race: a rendered result could become visible while an earlier checkpoint still lacked the winning input. The delay barrier now identifies the actual server-replayed winning checkpoint before inserting unrelated work. Winning and receipt assertions remain intact. The Intel Mac navigation assertion is retained; catalog art and native gameplay run as separate CI jobs with all existing steps preserved.

## 本地证据 / Local evidence

- 移动与保存相关 20 项通过，覆盖位移预算、到达只执行一次、切场景不恢复旧路点、后续物资回调仍等待、终点站立姿态。
- 双画风实际 8 FPS 浏览器：居民 `begin` 的真实服务端响应延迟 2500 毫秒。修复前，650 毫秒时停在入口，约 2.6 秒才进入；修复候选在同一采样点已经进入，居民请求仍在等待。没有增加作物、注入胜利或改动用户存档。
- 导航修复候选上的双画风完整农活链通过：实际制作一袋肥料、播种浇水施肥、刷新后回到农田、180 秒有效成长、收获小麦 ×3 与种子 ×1，再刷新保持唯一结算。墙钟成熟时间为 183.451 / 185.731 秒，页面和素材错误为零。最终等待姿态整理另经单元和短流程复核；这不替代最新云端结果。

Twenty related movement/save checks passed. Native 8 FPS tests held actual resident responses for 2500 ms: before the fix the player remained at the door at the 650 ms sample, whereas the candidate opened the farm at that sample with the receipt still pending. The candidate also passed both complete real-time soil-care chains, with authoritative crafting, fertilizer consumption, mature crops, unique harvests and reloads. Later idle-pose polishing has separate unit and short-flow evidence. Latest cloud checks are tracked separately.

```sh
node --test tests/v179-navigation-arrival.test.mjs
node --test tests/v179-action-lifecycle.test.mjs
node tests/v179-navigation-arrival-browser.mjs
node tests/v179-npc-work-browser.mjs
node tests/v173-farm-navigation-browser.mjs
node tests/v170-reward-drain-browser.mjs
node tests/v159-soil-care-browser.mjs
```
