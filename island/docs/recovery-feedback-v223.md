# V223 · 核对进度反馈 / Recovery feedback

从“小岛存档”弹窗点击读取服务端进度，之前没有接入统一核对界面。这个弹窗又会隐藏恢复面板，导致请求等待时看不到核对步骤和重新进入链接，失败提示也只通过短暂消息出现。

现在这条入口与恢复卡片使用相同的读取流程。开始核对时显示统一恢复面板，展示当前保存／回执读取步骤；失败原因持续显示，并恢复可用的重试按钮。在暂存副本持久化之后，保留“重新进入并继续核对”的普通链接。原页面在回执确认前继续暂停，原有请求编号、备份和资源验证保持原规则。

## 验证范围

- 两个虚构 LAN 账户从真实存档弹窗发起核对：像素风扣住实际服务端读取响应，折纸风返回一次明确的 503。
- 修复前，两种画风均因恢复面板被存档弹窗隐藏而失败；修复后，分别通过可见链接重新进入、通过可见错误提示重试，正常返回可操作的小岛。
- 检查当前暂存副本、服务端小岛身份、岛币、库存和回执数量；390px 布局无横向溢出。
- 原有双画风模态弹窗、等待重入、自动导航被取消后的普通返回链接检查保持通过。

本次没有读取原用户浏览器或用户存档。Codex 内部浏览器的已保存权限阻止了对原页面的访问，所以原页面刷新后的结果仍需单独确认。这里的隔离浏览器验证不等同于原页面或真人验收。

## English

The save dialog previously started reconciliation outside the shared recovery UI while also hiding that UI. Waiting steps and the safe re-entry link were therefore invisible, and a failed read only produced a temporary message. All recovery reads now use the shared panel, show the current step, retain errors and restore retry controls. Safe re-entry stays available after a durable backup, while the obsolete simulation remains sealed.

Two fictional LAN accounts reproduce the hidden-panel failure before the fix and pass afterward: an actual held read in pixel and a single 503 in origami. Canonical resources, identity, receipts, backup retention, narrow layout and the existing modal/navigation cases are checked. The original user tab was inaccessible under its saved browser permission and remains unconfirmed after refresh. No private browser/save was read.
