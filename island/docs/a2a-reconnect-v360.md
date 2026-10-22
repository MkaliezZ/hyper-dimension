# V360 · 原机 A2A 重连与服务收尾 / Original-device A2A reconnect and shutdown

## 修复

在真实 SDK 与游戏界面完成三轮交流后，服务重启曾被旧浏览器连接的持续轮询卡住。现场确认监听已停止，同一连接仍不断请求会客厅；旧端口校验同时把排队中的地形图片误判为非法请求。旧失败与仅用于诊断的空闲连接干预均保留，没有当作通过结果。

服务现在在响应与处理函数都完成后平稳结束旧连接。已经接受的写入即使失去客户端，也必须收尾后才释放档案运行锁。停止监听期间沿用本次绑定端口核对同源请求，在途图片和回执读取可正常完成；域名、端口、来源与原机身份保护保留。没有强行销毁活动响应，没有重放现实文件任务。

## 已核对

旧关闭策略在两个独立检查中复现：持续轮询阻止关闭、客户端断开使关闭早于实际文件写入。修复后 Node22和24各26项关联检查通过，包含连接收尾、已接受写入、重复关闭、原机身份、标准A2A与双向接续。原250毫秒关闭边界和3秒检查期限保留。

原真实标准SDK → 游戏界面 → 标准SDK流程完整通过：两份原机CLI、两种画风、三轮真实Hermes／DeepSeek Flash往来，一次真实提交后响应丢失，原编号核对不新增模型轮次。游戏服务与原机连接端全部重启后，记录、父运行关联和各自虚构Markdown工作成果一致，物资和货币保持原值。测试文件、断言和期限未修改。

这是同一Windows机器上的隔离自动化，不代表实际多设备、Mac、新玩家或OPC。V359双画风四岛证据保留，最终冻结版仍须对完整四岛和交付包单独复核。旧Mac恢复按钮超时仍由对应主流程核对，本项修复不能证明其根因。未生成新的大体积源码包。详见[结构化记录](verification-v360.json)。

完整Node24默认检查2083项（2069＋14）通过，无失败、跳过或取消。

## English

A live SDK/native/SDK exchange exposed shutdown waiting indefinitely on an old browser connection that kept polling after the listener closed. Reading the listener's now-null address also rejected queued terrain requests. Both the original failed run and its diagnostic-only intervention are retained.

Shutdown now waits for complete responses and accepted request handlers, including disk writes whose clients disconnected, before releasing the data lease. Existing connections drain gracefully; the bound port remains available to the unchanged host/origin checks. No active response is forcibly destroyed, and real document work is never replayed.

The unchanged live flow passes with two actual original-device CLIs and three Hermes/Flash A2A turns, an intentionally lost committed native reply, exact standard history and no duplicate model turn. Service/CLI restart preserves the transcript, parent links, fictional file results, inventory and money. Related controls pass26cases on both Node versions, with the original250ms/3s limits retained. Full defaults, hosted results, final-package/four-island qualification, physical devices, human acceptance and OPC remain separately evidenced.

The full Node 24 default suite passes 2,083 tests (2,069 + 14), with no failure, skip or cancellation.
