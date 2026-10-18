# V285 · 游客到店不再等待其他游客空闲

Intel Mac 的失败现场中，目标游客已经走到邮局门口，但其他游客的确认请求持续占用游客控制器，约 106 秒后才进入。服务因此未能在原有 150 秒道路与体验预算内结算。

游客控制器现在明确提供“可以排队提交”的状态。已到达的游客可继续进入房间、走到工位，并通过原保存队列提交自己的入场请求；仍需等待自己的回执。恢复中、未就绪或已经锁定的控制器不能提交，同一游客已有待确认请求时不会再次提交。库存、时长、报价与岛币继续由原服务端入场及完成回执决定。

## 实际验证

- 原代码在像素与折纸的门口等待定向检查中均失败；修正后包含原有候位、上下船、时长、恢复与重复请求保护的 35 项检查通过。
- 原生居民实际制作组件和成品、手动上架、游客沿路到店购买、刷新恢复的原测试通过。像素／折纸道路与服务用时分别为 29.4／29.5 秒。
- 声明将已接受响应延迟 1000 毫秒后，原流程两画风再次通过，用时 31.5／28.5 秒。四例均保留原 150 秒时限、原售价／成本／库存断言和原测试文件。
- 原生测试使用虚构小岛、声明的初始基础材料和正常游戏时钟，没有注入成品、已完成的任务、购买结果或游戏时间，也没有调用外部模型。源码哈希和完整工作差异在验证前后保持一致。

V284 的完整 1456 项规则检查与冻结 V281 的实际一小时属于各自版本。本轮尚未重跑完整规则集或新版本一小时。ARM Mac 的另一类整页卡住已定位到浏览器 GPU 等待路径，仍需单独修复；本次不把它改判通过。README 保持功能介绍。

## English

Visitors at a completed doorway can now enqueue their own canonical admission while another visitor waits. Their own pending request and unready/locked authority still block duplicates; payment and stock remain server-authoritative. All35related checks and four original native production-to-sale cases pass with the unchanged150second budget, including declared1000msaccepted-response latency. Fictional initial materials are explicit; no clock or result injection. The ARM Mac GPU stall and complete current-version acceptance remain open.
