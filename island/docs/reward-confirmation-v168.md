# V168 · 制作领奖确认 / Queued crafting rewards

V167 的完整平台检查最终为 5/6。Windows 原生素材任务在折纸温室制作后等待领奖结算 30 秒超时；像素完整农田流程、两种 Mac 原生任务与三种平台部署检查通过。失败日志保留，不能把这次问题描述为管家立绘或素材缺失。

结果页出现后，最后一次制作 checkpoint 可能仍在返回。旧界面有时显示可点击的领奖键，但界面与控制器都可能直接忽略这个点击。原生隔离比较在两种画风复现该过程。现在，普通室内制作的领奖会等待同一保存请求及其事件缓冲清理，再核对原作业编号和状态，最后结算。重复点击只保留一次请求。取消会使排队的领奖失效；冲突或未确认的失败仍需原恢复流程。

本次仅为支持该控制器的室内制作启用排队领奖。重开与难度选择仍在确认期间禁用，不提前扣料、不提前给成品；原保存保护、回执去重与 15/30/45 秒检查时限保留。

## 验证

33 项相关规则检查通过。[实际原生记录](verification/v168/native-reward.json) 包含双画风的四个领奖/取消场景：真实推箱输入通关，暂留已经成功的最后一个保存响应，在响应返回前原生双击领奖，随后只释放同一响应，未再点击。领取得到一个堆肥袋、一个已完成回执和对应材料扣除；关闭结果页的取消场景不扣料、不发成品。另两套重开检查保留编号、重开禁用、唯一取消和零扣料断言。第一次取消检查错误地点击顶层结算框外的房屋关闭键，第二次将关闭框误认为删除节点；已改用实际结算框的关闭键和可见性断言，失败记录保留在隔离 QA 中。

本机现有 V166 的 26 张管家立绘重新截图检查，双风格显示完整且服务返回与实际裁切源文件一致。这是已有 V153 裁切修复的再次核对，本次未更改原 PNG 或人物身份。[原裁切说明](steward-portraits-v153.md)。

夹具只预置制作原料、种子、建筑与资金；未注入成品、关卡结果或奖励。模型请求屏蔽。该检查不代替零起点、真人或实体 Mac 验收。V168 完整 CI 与不可变源码包另验。公开部署包仍为 V158，新片仍明确来自 V166。

## English

V167 ended with five of six platform jobs passing. Windows native art timed out after origami greenhouse crafting while awaiting the reward; portraits and asset checks had passed. The old UI and controller could ignore an enabled claim click during the last checkpoint. A crafting claim now joins that same request and its buffer cleanup, verifies the original ticket and then settles once. Duplicate clicks are deduplicated; closing the result cancels a queued claim without spending materials or issuing a product. Conflicts and failed confirmations retain recovery.

All 33 focused rules, four native claim/cancel cases and both protected-restart cases passed. Native tests hold an accepted checkpoint response, use real puzzle inputs and clicks, and then release the same response without another claim click. They use declared raw-resource fixtures and no models. Restart/difficulty gates and existing timeouts remain. The current local V166 chooser's 26 portraits were also rechecked; the existing V153 crop repair remains intact. Full V168 CI, archive checks and physical-device/human acceptance stay separate. The public package is V158; the new film was recorded from V166.
