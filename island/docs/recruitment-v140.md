# V140 · 一段完整的主子 Agent 协作

## 从接单到实际交付

1. 在派对看板发布星灯夜集，建立真实物资筹备计划。
2. 管家招聘手账选择计划与伙伴；主 Hermes 观察清单，委派真实子 Hermes，以工具确认分工。
3. 前置物资未齐也可以先接受最终制作，现场执行器等材料齐备后再开工。主 Agent 已委派最终目标时，子伙伴不能只接受采集却声称稍后自动制作。
4. 伙伴乘船，经栈桥与岛内道路到工位；常驻居民也可补齐共享缺口。仅实际动作交付计入贡献。
5. 岛主亲自送出约定物品、邀请关键居民；居民各自赴约。完成夜集后记录奖励和主子协作来源。
6. 按实际交付比例结算工资，归还未用预留；伙伴经码头乘船离岛，刷新保留活动和聘约记录。

## 修复与验证

旧作业取消前先解除本地分工和意图，避免取消请求的同步存档再次取消同一作业。旧动画或迟到的开始／完成失败回复不会清除新行动；室内退出路径保留。此前隔离检查中，同一作业出现上千次取消请求，修复后正常交接为单次。

最终直接相关检查53项、招聘协议检查10项通过；另有76项相关协作／收藏回归通过，两组有重叠，不相加为独立总数。双画风实际浏览器连续流程见[验证记录](recruitment-v140-verification.json)。

测试使用有生活物资的隔离演示岛，初始没有星灯、木材、石英或蜂蜡。实际调用 Hermes／DeepSeek Flash 招聘，随后正常时钟乘船、行走、生产、邀请、开场、领取、计酬、离岛与刷新。没有注入人物位置、时钟、分工回执或活动结果。自动 NPC 模型请求在该检查中关闭。

两条运行在同一台 Windows 电脑完成；这条活动链不代替全新零资源流程、Mac实机、跨物理设备、所有派对及真人完整验收。小游戏仍继续打磨，原始18R／28F／30T范围保留。

## Agent 重放

隔离环境中配置私有 DEEPSEEK_API_KEY、Hermes与解释器路径，设置 HD_QA_REAL_HERMES=1，再执行：

    node tests/v140-recruitment-journey-browser.mjs

Windows PowerShell使用 $env:HD_QA_REAL_HERMES='1'。该检查真实调用配置的提供商；默认领域测试不调用模型。原始报告留在私有QA输出，不进入公库。

## English

V140 fixes reentrant assignment cancellation and stale animation/RPC callbacks. Recruitment separates accepting a dependent final product from starting after materials arrive. A child must explicitly accept a delegated final target before that chain is registered; production, contribution and wages still require authoritative receipts.

Both native styles complete one real Hermes/deepseek-flash recruitment, normal-clock ferry/road/workshop production, personal invitations, night party, reward, contribution, wage, actual departure and reload. The progressed fixture and physical-device/human acceptance limits are explicit. Private configuration, user saves, real documents and raw provider transcripts are not published.
