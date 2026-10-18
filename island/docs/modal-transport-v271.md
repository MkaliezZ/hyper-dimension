# Modal command transport / 弹窗操作回包

V269 的 macOS 14 完整检查在最后一项折纸风物品使用时出现 `route.fetch ECONNRESET`。已保留日志和带散列核验的原产物：前 11 项截图存在，最后一项没有报告。原始连接为什么断开、是否已提交，现有产物无法确定。

原生测试对这一条已签名、有 requestId 的操作最多原样重试一次连接重置；不重跑整条用例，不重试 HTTP 错误，不改变浏览器输入、原断言或时限。路由异常现在会让原用例明确失败，并在清理浏览器之前保存报告。产品运行时代码没有改变。

隔离反向对照在真实提交后丢弃回包：零次重试失败；一次丢包后相同请求取得原回执并通过弹窗切换、唯一回执、刷新保持检查；连续两次丢包仍失败。两次服务端处理指向相同 requestId、完全相同回执，仅一次生效。原 12 项用例全部通过。公开的 `tests/v271-modal-transport-browser.mjs` 可重复这三项对照；只操作自身虚构存档，不调用模型。

住所取证专项在三个托管平台共六项通过，产物散列和 ZIP 完整性已核对。这不能解释或消除原完整运行的住所超时。另两个 macOS ARM 作业分别停在自定义配方准备、居民跨班次任务，耗尽作业预算；继续保留为未解决，后续跳过步骤不计通过。

## English

The original final origami item-use check lost its route.fetch connection and crashed before writing a report. The artifact preserves the preceding eleven screenshots, but cannot establish the original reset timing or cause. One bounded retry resends the exact signed request; HTTP failures, native inputs, assertions and original time budgets are unchanged. Route failures are retained before browser cleanup. Game runtime bytes are unchanged.

A real commit followed by an explicitly lost reply fails without retry, succeeds with one replay and one canonical receipt, and still fails after two lost replies. The original twelve native cases and the three public transport controls pass locally. This repairs test transport and failure reporting; it does not claim that the original connection cause, separate home failure or two macOS ARM task hangs are fixed. Hosted tests are not human or physical multi-device acceptance.
