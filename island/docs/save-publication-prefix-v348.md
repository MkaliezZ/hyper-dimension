# 已确认存档的发布顺序 / Accepted save publication

服务端已确认一项操作后，页面需要先提交本机恢复记录，再显示结果和释放操作入口。后台居民、游客及行走也会产生新的本机暂存。

V348 将“等待已有暂存”改为等待回复到达时已经排入队列的那一段。发布屏障同时建立；之后产生的暂存等待本次发布结束，使用新的服务端基线。这避免后续暂存不断延长已确认结果的等待。

- 已经排队的暂存先完成；发布过程继续合并期间发生的本地修改。
- 新服务端版本、本机恢复记录与原请求的删除保持原有提交顺序。
- 存储失败、冲突或未确认请求仍保留原始请求及其身份，不能推测完成或重复领取。
- 不改变游戏时钟、NPC 数量、模型频率、制作时长、经济规则或交互限制。

回归测试覆盖像素和折纸两种外观下的操作回复与自动保存：回复前已有暂存 A；A 提交期间又产生暂存 B，并暂缓 B 的下一次绘制机会。已确认结果必须先发布，同时保留 B 的本地修改、新基线及恢复记录。

## English

After the server accepts an operation, the client must commit its recovery journal before publishing the result. Resident, visitor and movement updates can enqueue additional snapshots during that work.

V348 waits for the cache prefix that existed when the reply arrived and installs the publication barrier immediately. Later snapshots wait for that publication and use its new server baseline. They cannot keep extending the prefix that an earlier accepted result must drain.

Earlier captures finish first. Edits during publication are still merged. Durable retirement, uncertain-request retention, exact request identity and existing conflict handling remain mandatory. Game clocks, actor counts, model cadence, crafting duration and economy rules are unchanged.

The regression covers both themes and both action and autosave replies. A later snapshot's paint is held while an earlier accepted result must publish, preserving the later edit and the new durable baseline. This deterministic boundary test does not establish the cause or recovery of every hosted browser failure; native and hosted outcomes are recorded separately.
