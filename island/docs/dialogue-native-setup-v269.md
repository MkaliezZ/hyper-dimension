# NPC对白检查的原生输入准备

## 失败与复现

V268的MacIntel检查在读取采集回执后找不到正在说话的会话。报告保留了采集请求发出前16.503秒、实际HTTP接收110毫秒，而对白共有四句、正常播放14.8秒。原报告未记录真正送达原生点击时的会话时钟，不能倒推出那个时刻。

隔离复现保留真实游戏时间，在原生点击前声明等待18秒：两画风对白都正常完成并写入记录，随后原检查仍断言“正在说话”并失败。原失败、截图和产物散列保留。这是检查前提的时序问题；没有把已经结束的对话伪装成等待中的对话。

## 调整与边界

先用原生鼠标打开采集菜单、确认木材按钮可用并聚焦，再观察自主对白开始。通过真实键盘Enter激活准备好的按钮，记录浏览器isTrusted事件：真正输入送达时必须仍在说话、尚未生成交谈结果。原生菜单与按钮处理函数继续实际运行；没有调用DOM click、强制点击、插入对白或更改游戏时钟。

请求准备30秒、从实际发出计时的HTTP10秒、接收后观察2.6秒等上限保留。整个原生等待仍至少推进一秒；接收后按剩余句长继续播放，禁止越过自然终点或提前产生结果。正常取消、唯一落档、刷新恢复及全部旧断言保留。

正常双画风、4倍CPU限速双画风、真实Worker发送前延迟9秒双画风共6例通过；反向对照仅在隔离HTTP响应中停用待确认对白推进，两画风均被原进度断言检出。4条核心规则再次通过。游戏运行资源与V268逐字节一致，1393条默认规则明确继承该版本的已验证结果，没有重复宣称本轮重跑。

新增显式social-pending诊断范围，仅运行三平台的这项原生检查；完整push保留原18个平台任务和所有原步骤、预算及权限。V268中Mac14执行机关机导致的另一处中断保留为未完成，不能计为通过。新托管检查尚待完成；这不是真人、物理多设备或完整交付验收。

## English summary

A real18-second pre-input wait reproduces the old assertion after the dialogue legitimately completes. The original hosted report lacks the actual click-time snapshot, so its exact timestamp is not inferred. Native menus are now prepared first; trusted native Enter must activate the same gather button while the dialogue is actually speaking with no outcome. Original HTTP, observation, progress, endpoint, cancellation, unique-save and reload gates remain. Six local native cases pass, frozen controls still fail, and runtime remains byte-identical to V268. A separate explicit three-platform diagnostic supplements the unchanged full suite; hosted results remain pending.
