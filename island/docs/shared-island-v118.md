## V118 · 同一小岛的两种画风与居民自由交流

- 像素与折纸共用同一个小岛身份和进度。首次进入沿用当前部署／账户画风对应的旧岛；若只有另一画风有存档则沿用它。另一份旧档完整保留，不自动拼合收益。部署时可选择一个默认画风，无需为两个画风部署两套游戏。
- 画风切换由服务端事务确认，切换前创建备份，陈列品按建筑关联重新校准并记住原位置，保留同一物品、农田、居民记忆、合同和资源。当前手动制作或派对需结束后再切换；后台日常作业可收尾，入口会给出明确状态。
- 15 位普通 AI 居民均可从居民手账进入“聊聊天”，保留每人的最近 80 轮对话，最近 12 轮和服务端性格、工作、邻里经历进入模型上下文。私密聊天保存在各岛数据目录下的 resident-chats，不依赖浏览器；完整 data 备份包含它。聊天不直接改变资源或代表任务已执行。
- 自由对话使用 DeepSeek V4.1 Flash／deepseek-flash，仅主动发送时调用；自动规划／居民间对话／管家巡查仍是 300／600／950 秒。错误可见，失败不会伪装成模型回复，重复请求不重复调用。
- 素材等待安排在界面初始化完成后，避免启动期间自动保存触发未初始化 UI 而误报断连。
- 管家和玩家形象选择改为即时服务端操作，解决衣橱持有过期状态时选项丢失；保存成功后刷新、切换画风均保留。
- 两位居民真实完成工作、有共同兴趣但做事风格不同后，才可能讨论分歧；高信任者可以互相欣赏，已有矛盾先给一天空间。补充三天话题冷却与低张力和解。

验证：748 项完整回归通过（头像最后修正另有 20 项定向回归）；隔离联机页面覆盖 15 位居民、两套 UI、连续聊天、刷新恢复、双向画风切换、延迟选管家形象，以及刷新期间无离线／冲突提示。页面模型供应端为确定性本地夹具，服务端、Python 适配器与持久化真实运行；另有 3 次真实 Flash 对话验证人物差异与前文记忆。不能据此声称完成真实多人、实体 Mac、全产品或长期关系验收。

仍未完成：高细节分块底图重绘、锄头新图接入及全体素材／动作审查、全部小游戏成品化，以及主验收台账中的其他未完成条目。小游戏仍为持续优化的演示玩法。

## English

Pixel and origami are now appearances of one persistent island. The initial deployment/account preference selects the existing home save; if only the other style has a save, it is retained. Alternate legacy files are preserved rather than merging earned resources. A server transaction checkpoints every appearance change and relocates displays without changing ownership, crops, contracts or inventory.

All 15 AI residents have a free-text conversation panel. Each resident retains 80 recent turns on the server, with the latest 12 completed turns and authoritative personality/work/neighbor context sent to DeepSeek Flash. Manual chat does not increase the 300/600/950-second automatic cadence or execute resource/document actions. Replies and failure states are explicit. Butler/player avatar selections are immediately committed and survive refresh and appearance changes.

Personality-grounded work disagreements now require completed work, a previous meeting and shared interests. Trust can produce appreciation instead; persisted boundaries and topic cooldowns prevent repeated disputes. Verification separates native UI with a local provider fixture from three real Flash requests, and does not claim complete product, physical Mac or human acceptance. High-detail tiled map artwork and other full-scope acceptance items remain pending.
