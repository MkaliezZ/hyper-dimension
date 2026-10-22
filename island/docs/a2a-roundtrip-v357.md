# V357 · 双向 A2A 与跨客户端接续 / Bidirectional A2A continuity

## 使用

双方在同一会客房开启信息交流后，可从标准 A2A 客户端或游戏内「管家交流」发起或接续同一段交流。访客仍使用自己的原机 Hermes；绑定原机离线时不会改用岛屿服务器代替它执行。

接续标准消息时，`recipientId` 指当前登录岛主的对方：访客回信填主岛，主岛回信填访客。`taskId`、原房间和双方身份保持绑定。游戏内实际输入的问题与标准请求共用历史；默认生成的提示不伪造成人的输入。重复请求保留原编号，跨界面查询和重启不会产生另一轮模型调用。

活动准备仍需来访岛主明确 `action=execute`，只返回服务端实际受保护的入场预留。管家普通回信不扣资源，不代表整个活动已经交付。

## 验证范围

修复前，三个新增专项复现了显式访客回信被误拒绝，以及游戏文字未进入标准历史的问题。修复后双向寻址、两种入口接续、幂等、第三方隔离、重启和活动唯一预留通过。原有同意、离岛、过期、原机归属、离线与工具观察约束保留。

真实链路使用官方 `@a2a-js/sdk`、两份独立原机 CLI 和 Hermes／DeepSeek Flash：访客标准客户端发信，主岛游戏界面回信并故意丢失一次提交后的响应，随后访客标准客户端接续。共三次真实 A2A 运行，分别归属本人原机；问题、答复和父运行关联一致。游戏服务与原机连接端全部重启后，同一任务、记录和文档成果保持，没有增加模型轮次。

两位岛主都携带本人管家与一位已同意随行的居民；管家在会客期间各自实际读取、编辑并回读独立工作区的虚构 Markdown。游戏币和库存保持原值，没有注入游戏进度、物资、需求或时钟。随行资料进入的是明确限定的公开岛屿上下文，A2A 工具只负责观察与回复。

这些进程和浏览器运行在同一台 Windows 机器。此结果不等于物理多设备、Mac 实机、随行居民社交事件、任意第三方 Agent 自动互通、真人或完整 Goal 验收。小游戏、长期体验及最终交付包仍按原顺序推进。初次测试误按原始 JSON 读取官方 SDK 的类型化 Part，失败保留；后续以 SDK 自己的 `Message.toJSON` 转换核对同一语义，没有放宽断言。

## English

After both owners enable correspondence in the same room, standard A2A clients and in-game letters continue the same task. On continuation, `recipientId` identifies the other owner relative to the authenticated caller. Native topics and owner-entered follow-up questions now appear in the shared standard history; generated default prompts and missing historical inputs are not invented.

The official SDK, two actual original-device CLI processes and Hermes/DeepSeek Flash completed a three-turn SDK → native UI → SDK exchange. A native post-commit response was deliberately lost and replayed without another model call. Task history, parent run links and private fictional document results survived service and CLI restart. Both owners retained their own workspace and steward; currency and inventory stayed unchanged. Explicit guest-owner execution remains mandatory for a protected event entry reservation.

This is automated evidence from one Windows host, not physical multi-device/Mac, resident social encounters, universal third-party compatibility, human acceptance or full delivery. The source and test details accompany the chronological entry in [VALIDATION.md](VALIDATION.md).
