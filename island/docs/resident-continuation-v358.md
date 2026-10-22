# V358 · 居民作业续做与存档等待 / Resident continuation and save waits

## 功能

居民开工请求已被服务端接收、但连续两次响应丢失时，沿用原请求编号完成原有重试，再读取一次服务端档案。只有世界、纪元、序列、人物、作业编号、输入签名与实际租约全部吻合，才接续那一项作业。未接收、已取消、身份变化或读取失败时，保留原来的待核对状态，不生成奖励或替代命令。

管家对话在等待存档、模型或计划回执时，保留已经绘制的模糊小岛背景。真实时钟、居民动作、正常工作和存档继续更新。调整窗口会重绘，关闭对话立即恢复小岛绘制。地形连通校验改用复用方向表和整数队列，保留完整八邻域、对角防穿越规则及所有入口检查。

## 当前证据

- Node 22、24 各通过93项相关检查。双画风原始三步任务均完成：30秒登记、第一项120秒、后两项共240秒工作预算保持原值；途中刷新、空浏览器重开和三条唯一完成回执均核对。
- 原生浏览器各丢失两次实际居民开工响应，原有每次12秒请求时限不变。一次权威读取接续真实租约，正常工作时长和唯一回执保留。人物持有一把斧头、世界身份为明确的隔离夹具。
- 双画风分别验证待回复背景的模拟继续、尺寸变化重绘和关闭后恢复。该检查使用声明的满需求人物与固定回复，不能当真实模型决定。
- 原有居民生产到游客购买流程通过，使用其原本明确声明的50份材料夹具。另一次双画风验证从服务端零币零库存开始，真实采集、制作组件与商品、中途刷新、上架、游客上岸行走和实际购买；连续丢失两次成交响应后，权威记录恢复同一笔交易。没有注入库存、需求、设施质量或时钟；提供者禁用，原150秒道路/服务预算保持不变。
- V357的标准SDK与原机A2A双向接续、双画风四岛联合活动已另行通过。V358保留这些服务端源文件，但最终交付包仍须对同一冻结源码重新核对。

上述为同一台Windows机器上的隔离自动化。最新主分支托管结果、最终源码包、双画风各20分钟连续观察、实际Mac/多设备、新玩家与OPC试课仍分别记录。没有将任何一项替代为真人验收。原始测试文件、断言和期限未降低。详见[结构化记录](verification-v358.json)。

## English

After the two original resident-start transport attempts lose their acknowledgements, one canonical read may resume only the actual accepted lease matching the world, epoch, sequence, actor, operation and input signature. Missing, foreign, cancelled or contradictory records stay unresolved; no reward, replacement command or additional mutation is invented.

A waiting steward conversation retains its already painted blurred backdrop while simulation, NPC work and saves continue. Resize repaints and closing the conversation resumes island drawing. The complete connectivity search retains its original geometry and access checks while reusing offsets and an integer queue.

Related controls pass 93 cases on each of Node 22 and 24. Both styles complete the original three-task/reload/empty-browser flow within unchanged budgets, the native backdrop lifecycle control, and two genuinely lost resident-start responses followed by one canonical read and a unique receipt. The original funded-material production-to-sale fixture also passes. A separate zero-resource flow gathers, produces, reloads, lists and sells actual goods; two lost sale responses recover the same canonical transaction without clock or inventory injection. Providers are blocked in these controls. This is automated Windows evidence, not physical Mac/multi-device, human, OPC or final-package acceptance. The final frozen source still needs its own qualification.
