# V137 · 跨岛管家信息交流 / Cross-island steward correspondence

## 玩家如何使用 / Player flow

1. 岛主与访客进入同一会客房。每位岛主自动带自己的管家，可再邀请最多两位本岛居民随行。
2. 打开「随行管家 → 管家交流」，双方分别勾选「允许接收管家信息交流」。此设置与活动协作的接收设置独立。
3. 选择对方管家，写下话题，让本人管家寄信。对方岛主点击「让我的管家回信」，可补充问题；随后双方交替继续。
4. 回信署名包含管家和所属岛屿。刷新后仍可查看；断线后的核对复用原请求，不会因为页面轮询重复调用模型。

Join the same visitor room, then open **Personal steward → Steward exchange**. Both owners enable information reception separately from activity cooperation. Select the other steward and start a topic; the recipient asks their own steward to reply, optionally adding a question. Owners alternate subsequent turns. Messages retain their steward and home-island attribution across reloads; acknowledgement recovery reuses the original request.

## 真实运行范围 / Runtime scope

- `island.information` 使用双方账号各自隔离的 Hermes 运行时，模型为 `deepseek-flash`。每轮保留发送者、收件者、原岛身份以及上一轮运行记录的关联。
- 共享资料来自服务端确认的岛屿日数、建筑与品质、随行伙伴职业及兴趣。私人工作文件、现实项目、历史私聊、密钥不会自动加入交流资料。
- 信息交流本身不扣除资源或操作文档。派对的准备分工、入场物资和执行回执继续使用 `event.checkin`。
- 一段交流最多八封信、三十分钟内有效。结束会客、关闭接收或身份变化后不能接续原任务；中断的模型答复需手动核对。
- 随行 AI 居民的跨岛对话、关系变化与回岛记忆属于居民社交链路，不冒充 Hermes 工具调用。

Each turn is executed by the authenticated owner's isolated Hermes process with `deepseek-flash`; messages link the two owners' run records. Only canonical public game facts are supplied. Information exchange grants no resource or document-write authority. Event preparation remains a separate capability. Conversations are limited to eight letters and thirty minutes, and stop on departure, withdrawn reception or invalid identity. Visiting AI residents use the existing conversation/relationship/home-memory system.

**当前在同一个游戏服务器上运行。访客原设备的 Agent 及工作区桥接尚未完成；这不是任意第三方 A2A 服务自动互通的声明。**

**These are isolated owner runtimes on one game server. The visitor's original-device Agent/workspace bridge is pending. This does not claim automatic interoperability with arbitrary third-party A2A servers.**

## 验证 / Verification

- 账号身份、双方独立接收、轮次权限、重复请求、历史恢复、过期、撤回接收和旧执行端迟到答复均有必要的自动检查；原活动物资核对回归保留。
- 原生双风格浏览器验证使用两名隔离的新岛主、真实 Hermes/Flash 双向回信；测试数据为虚构岛名，无存量用户资料。具体结果记录在 `VALIDATION.md`。
- 本版同时修正第一盏灯的手账引导：实际配方为木材二份、石英一份、蜂蜡一份、纤维一份，逐项导航到真实采集地点；旧已完成手账不会回退。

Identity, consent, turn ownership, idempotency, persistence and interruption boundaries have focused checks, alongside legacy event preparation. Native browser checks use fictional new owners and real agents. First-lantern guidance now follows the actual wood/quartz/wax/fiber bill and excludes reserved stock; legacy completed pages remain completed.
