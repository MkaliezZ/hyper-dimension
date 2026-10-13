# V170 · 制作领奖与关闭等待 / Draining acknowledged actions

V169 的完整 CI 38329875515 为5/6，Intel Mac 折纸温室完成关卡后等待领奖超时。V168 同一源码的后续执行38291326662也在Mac ARM像素温室出现同类等待，早先6/6成功记录仍保留。

## 原因与修复

最后一个制作 checkpoint 成功后，合法的居民事务可能立刻占用保存队列。旧领奖将这个短暂的 pending 标记直接当成未确认失败，返回false，导致用户已点击的领奖请求丢失。关闭时也可能错过原取消请求：制作响应返回时仍有居民事务，取消被留下而没有后续触发。

原生隔离场景使用真实温室推箱输入通关，暂留已成功的制作响应，排入一条真实居民休息事务并暂留其已成功响应。两套画风均复现旧版丢失领奖和关闭取消。未注入成品、结果或伪造成功响应；只预置原料、种子、资金与建筑，其他自动居民工作在此夹具中暂停。

现在领奖在同一制作确认完成后，等待保存队列已有事务与缓存写入结束，再核对原票据。关闭取消通过唯一等待任务接续，避免重复取消或提前清理制作缓冲。结果未知时保持原恢复流程；居民回包丢失后，不自动扣料、发成品或取消。用户按原编号明确核对该事务后，继续原关闭请求。

## 验证

[原生记录](verification/v170/native-reward-drain.json)包含双画风六种并发场景：正常排队领奖、排队关闭、真实居民响应丢失后显式恢复。成功领奖只有一个完成回执和一袋肥料；关闭只有一个取消回执、零扣料与零产物。未知状态持续超过一次5秒检查周期，未发生后台取消；按同编号恢复后才取消原制作。

另四种不插入居民事务的原领奖／取消场景通过，22项制作与回包规则通过。原30秒场景时限、配方成本、回执去重、冲突及失败保护保持。CI新增六个原生场景，整体任务预算从35分钟调为45分钟；不增加单场景等待时限。

跨平台、独立源码包与本机同步分别验证。地形与美术保持V169，当前影片仍准确标记V169录制画面及三段V166实录。住宅内部、全图四季、天气、昼夜和作息继续开发，原目标未完成。

## English

A legitimate resident transaction can follow the final acknowledged crafting checkpoint. The old reward rejected its temporary pending marker and lost the click; closing could similarly leave cancellation without a continuation. Rewards and one cancellation waiter now drain existing successful actions before validating the original ticket. Unknown responses retain recovery. Explicit replay of the same resident request permits the original close to finish, without spending inputs or granting a product.

All six native concurrency/lost-response cases, four original reward/cancel cases and 22 focused rules passed. Costs, receipts, conflict protections and individual test timeouts remain unchanged. Full platform, immutable-package and local-deployment evidence are separate. Artwork and film capture retain their V169 provenance.
