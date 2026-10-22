# 委派作业排队与回执观察 / Delegated work and receipt observation

## 委派任务

Windows 托管检查中，首项委派已经取得正常20秒工作租约，却持续等待普通后台作业，超过原120秒工作时限。现在已绑定任务的居民、矿洞和农田作业获得前台队列轮次；完成及取消只有匹配已知 NPC 租约的编号、代次和序号才获得这一轮次。队列仍与普通 FIFO 工作交替，不打断在途事务，也不能跨越已经排入的核对屏障。服务端权限、资源预留、作业时长、收益和模型调用频率保留。

63项相关规则、8项原生分工/暂停/接管/自定义配方场景通过。新增8项队列规则也在Node22通过。原首项120秒、后续共享240秒的工作预算不增加。

## 已接受回执的观察

Intel Mac 原动作重叠检查把“Playwright 完成缓冲整个响应体”当成“服务端已接受作业”，混入了额外传输等待。现在在同一个原15秒预算内读取实际持久租约，核对请求编号、NPC、代次、序号及操作编号，再保持原响应不交给界面。随后仍要求实际HTTP200、动画完成、物资等待服务端确认、仅一次结算及重开一致；原5秒动画检查和30秒完成检查保留。

Windows 与 Intel Mac、0/3000毫秒观测延迟、双画风共8项托管对照通过，最迟13.928秒观察到实际提交。不是以扩大超时、注入租约或跳过结果断言修复。

## 交付边界

V361 两画风四岛、四份原机管家进程、真实Flash/Hermes A2A、活动、响应丢失、唯一结算及重启回岛已经完整通过。本次修正不改A2A协议、原机桥接、后端或联机地图。按照最新要求，只收尾当前CI与源码包，不继续小游戏开发，也不另加长时间验收。实际跨设备、新玩家及OPC仍单独验收。[结构化记录](verification-v362.json)。

## English

Explicitly assigned NPC resident, mining and farm actions now receive a foreground queue turn. Confirmed finishes/cancellations must match the known NPC lease identity. Existing transactions and checkpoint barriers remain ordered, with alternating FIFO turns for automatic work. Server authorization, stock, rewards, work durations and model cadence are unchanged.

The receipt-overlap control now observes actual durable acceptance within the original15second setup budget rather than waiting for Playwright to buffer the entire withheld response. ActualHTTP200, finite animation, authoritative inventory, unique settlement and reload assertions remain. Eight hosted Windows/IntelMac cases pass with0/3000ms observer delay; the latest actual acceptance was observed at13.928seconds. No production or test deadline increases.

V361 separately completed both-style four-island real A2A, original-device process and restart flows. The current patch changes no A2A/backend/map implementation. This delivery follows the latest requested A2A/CI scope, without further minigame work or another long observation cycle. Physical devices, human players and OPC remain separately evidenced.
