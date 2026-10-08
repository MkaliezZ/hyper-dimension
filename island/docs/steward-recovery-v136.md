# V136 · 管家委托恢复 / Steward request recovery

## 中文

管家手动委托先将对话及委托编号保存到小岛服务，再发出请求。保存失败时显示“委托没有寄出”，不会先调用模型或执行文件工具。重试同一委托沿用原编号、项目资料授权和已选择的工作会话。

单机端在执行工具前写入私有委托回执，以原岛身份和请求编号关联结果。丢失 HTTP 回复或重开后，同一编号读取原结果。进程在工具写入后停止、回执损坏或最终结果保存失败时，保留“尚待核对”状态，不自动重复文档操作。

联机端复用岛主自己的持久化管家手账，提供同样的只读恢复接口。浏览器重开后核对已有委托，不重新发送到模型。回执受登录身份、岛主请求头和原岛身份约束；其他岛主读不到这条委托。切换像素／折纸画风继续使用同一原岛身份。

接口：`GET /api/hermes/requests/:requestId?theme=原岛存档画风`。结果包括 `running`、`completed`、`unconfirmed`；不存在返回 `request: null`。这个读取接口不会发起新的模型调用或文件操作。已完成的岛内分工仍通过原有权威事务按编号登记。

### 本轮证据

- 八项回执领域检查：重复请求、重新打开记录、两个实际进程争抢、写入后停止、异常、损坏、最终回执写入失败。验证文件写入次数和磁盘内容。
- 双画风原生浏览器与实际认证服务：保存失败不寄出、显式重试、丢失回复后空浏览器恢复、执行中刷新、写入后异常，以及跨岛主和未登录读取拒绝。执行端为明确的测试夹具，实际写入隔离文件，不调用外部模型。
- 双画风单机原生浏览器使用真实 Hermes 与 deepseek-flash：读取数字文件、实际加一并保存回读；故意丢失回复、空浏览器恢复、再次提交同一 HTTP 编号后，文件仍为 1，每种画风仅一次手动模型委托。没有注入游戏库存、位置或时钟。
- 新检查纳入默认回归；默认套件和相同公开提交的 Windows／macOS CI 结果另记录在验收说明和发布记录。

### 数据与使用

私有回执保存在小岛服务的数据目录，可能包含答复、文档路径和成果引用，随用户数据备份；不进入源码包或公开日志。只有显式的新委托会开始新的工作。未确认的文档操作应先在“文档成果与工作项目”核对实际文件。

本轮只证明上述异常恢复场景，不能代替全部单机流程、长期游玩、小游戏品质或完整产品验收。当前展示影片录于 V135，游戏美术与布局在此轮没有改变。

## English

Manual steward requests now wait for a durable island-save checkpoint before calling the model. A failed checkpoint leaves the letter unsent. Retries keep the original request ID, project-disclosure choice and selected native work session.

Standalone execution claims a private receipt before tools run. Lost HTTP responses and reopened services return the original result. An interrupted process, corrupt receipt or failed final persistence remains unconfirmed and never silently repeats document operations. LAN recovery reads the authenticated owner’s existing journal with the same home-world boundaries. Both appearances share that identity.

The read-only endpoint returns running, completed, unconfirmed or a null request. It does not call a model or execute file tools. Existing authoritative island-planning transactions still prevent duplicate task registration.

Evidence includes eight persistence/race checks, both themed native LAN flows with a file-writing fixture, and both themed standalone flows with real Hermes/deepseek-flash document tools. Each real run increments an isolated numeric file once; a lost acknowledgement, an empty browser and an identical HTTP replay preserve the result without another manual model call. No user data, inventory, character position or clock injection is used.

Receipts are private user data, may include document paths and artifact references, and belong in user backups rather than source releases. This focused evidence does not establish complete game, long-term, physical-device or human acceptance. Showcase footage remains labeled V135.
