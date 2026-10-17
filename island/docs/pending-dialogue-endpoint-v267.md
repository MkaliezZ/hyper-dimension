# 待确认回执期间的对白终点检查

## 发现与复现

V266 的 Windows 检查在“等待另一项回执时对白至少推进一秒”失败。原始产物保留：请求准备12.277秒、实际HTTP接收38毫秒，但报告没有保留那个时刻的对白时钟，不能倒推出原时钟数值。

对白实际有四句，每句3.7秒；等待回执时最多播到14.8秒，再等待普通更新确认结果。隔离复现只让一条真实Worker请求在发出前等9秒，保持真实时间、请求正文和权威结果。原测试在两画风均误判：对白约从14.11/14.19继续播至14.8秒，已到自然终点，剩余不足一秒。没有提前生成交谈结果。

## 修正检查的时间边界

每例仍要求整个原生采集待确认过程至少播放一秒。真实请求被接收后的2.6秒观察窗内，剩余时间不少于一秒时，仍须至少推进一秒；不足一秒时必须播放完剩余部分，不能越过末句。实际完成的本地对白还必须确实是夹具声明的四句。

准备上限30秒、真实HTTP接收上限10秒、观察窗2.6秒、禁止提前写入结果、正常取消采集、保存唯一交谈及刷新恢复等检查保持原样。没有修改对白播放速度、游戏时钟、模型或存档逻辑。

正常双画风和延迟准备双画风均通过完整流程。反向对照仅在隔离HTTP响应里停用待确认对白推进函数，两画风均被真实接收后的进度断言检出。它们仍是失败，未计为产品通过。

## 检查任务的外围时间

原Windows任务运行约36.5分钟才进入最后一项生产商品销售检查；真实游客轮转仍允许8人×90秒，即12分钟，再加150秒道路与服务上限，可能超过旧45分钟任务总预算。这里只将小游戏/居民工作的任务总时间调整为60分钟，原运行步骤、各步骤及游戏内限时均保留。

增加只运行原V220恢复输入检查的显式诊断入口，与完整检查使用不同并发组，方便保留三平台的原4秒点击证据。完整push检查仍保留全部18个平台任务；单项诊断不能代替完整验收。

## 范围

游戏运行资源与已通过部署/自然一小时的V265候选逐字节一致。既有1393条规则与长测证据仍明确归属该候选。本轮只调整原生检查和外围任务配置，新的托管结果尚待确认，原MacIntel恢复点击超时仍单独追踪。未更新README中的CI流水，也未宣称真人、物理多设备或完整交付验收。

## English summary

A late sample can leave less than one second before the dialogue's natural endpoint. A real9-second pre-dispatch delay reproduces the old false failure without changing time or results. The corrected test retains unconditional one-second progress over the native pending action and requires another second during the accepted hold whenever that much playback remains. Both ordinary and late native flows pass; frozen-presentation controls still fail. Existing cancellation, durable-outcome, HTTP and timing gates remain. Larger job envelopes accommodate setup and the unchanged finite visitor rotation; a separate explicit diagnostic scope runs the original strict recovery-input test. Runtime is unchanged and hosted verification remains pending.
