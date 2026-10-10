# V161 · 存档检查时序 / Save verification ordering

V160 游戏运行逻辑保留。新增的刷新夹具会在低速暂存提交时遇到刚开始的自动保存；原检查在完成加载后立即断言没有时间请求，未等待这次正常保存。Mac ARM/Intel 的 V160 检查因此失败。

夹具现在取消自身定时器，等待 SaveClient.idle 核对已经启动的请求，再读取状态。严格的版本、钱物、时间、同字段冲突和回执断言保留。每次 IndexedDB commit 处理增加 180 ms，以覆盖这个先后顺序。两主题共 8 项通过，包括未接受的 7 秒时间请求、再次刷新和真实冲突保留。

V160 Windows 农田完整流程仍有刷新恢复超时，故障诊断正在继续；原生农田检查增加恢复状态、作业种类和锁定页面的诊断输出，不跳过、不强制点击、不删除核对提示，也不只增加等待时间。两套本机正常和冻结包流程通过不等于解决该平台失败。

本机运行经 922 项独立离线验证的 V160，公开部署包仍为 V158；V159/V160 保留草稿。完整范围仍为 18R/28F/30T，4 完成、14 进行中。标准 A2A 发现卡保持 V160 运行逻辑版本 160.0.0；此更新改变验证夹具，不改变 Agent 协议。

## English

The reload fixture now drains already-started autosaves before asserting the journal is empty. All transaction and true-conflict assertions remain. Both styles pass eight native cases with 180 ms commit delays and an unaccepted seven-second clock request.

The V160 runtime remains the baseline. The Windows full-farm reload failure is still under diagnosis; native farm failures now report recovery and lock state. Normal local and frozen runs do not establish that platform repair. The public archive remains V158, with V159/V160 held drafts; full acceptance remains 4 complete and 14 in progress.
