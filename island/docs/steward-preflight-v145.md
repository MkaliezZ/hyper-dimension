# V145 · 管家发送前等待作业结算 / Steward preflight ordering

居民作业正在写入时，管家发送前的保存曾直接报“作业结算待核对”。实际委托未发送，但短暂的正常结算让用户必须再试。

发送前现在先等待现有存档动作队列，再保存，最后寄出同一次委托。网络失败或尚未确认的旧作业继续阻止寄出，原编号和恢复机制保留，不重放现实文件工作。

验证在真实零资源LAN存档和双画风原生UI上，故意延迟一笔已被服务端接受的居民作业回执。修改前对话进入错误；修改后对话等待，延迟期间没有管家调用，回执恢复后只发送一次。命令执行端使用明确标注的本地测试替身；这份顺序验证没有调用外部模型或真实文档。[脱敏结果](verification/v145/preflight.json)。

Native dual-theme verification delays an actual accepted server resident-action receipt. Before the fix, the letter is rejected; after it, submission waits, makes zero calls before the receipt and exactly one call afterwards. The isolated command runtime is a labelled fixture, not real Hermes or document acceptance. Real Hermes evidence is tracked separately. Network or unconfirmed-action failures remain blocked rather than replaying work.
