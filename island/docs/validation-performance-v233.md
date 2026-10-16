# V233 · 组合账目核验提速与共创原图审核

## 保留核算规则，减少重复工作

十日组合流程的 CPU 采样发现，重复读取确认快照的深拷贝约占 14%，穿搭历史校验反复生成同一关卡定义约占 10%。本轮保留全部账目断言和原时间预算，改用每次响应后只读的确认快照；明确编辑时仍复制，实际写入、磁盘锁、唯一回执与新服务重读保持。

运行时只缓存由合法种子、难度、衣橱、排除人物和主题确定的穿搭关卡定义，最多 128 份；每次返回独立副本。不会缓存玩家提交的关卡或“已通过验证”的结论，修改关卡、换参数和非法输入仍被拒绝。

96 组修改前记录的关卡摘要保持一致，新增 6 项缓存完整性检查、15 项相关检查与完整 1278 项规则通过。同机局部诊断中，1500 次完整衣橱校验从约 1453 毫秒降到约 33 毫秒；这是核验函数的局部测试，不是游戏帧率或跨平台性能承诺。

## 同岛 30 日组合检查通过

两套画风均在原有每套 510 秒检查预算内完成 30 个游戏日：五类活动各六次、30 次有偿招聘、游客服务、升级维护及每日开销；每套核对约 6800 次正式响应，并从磁盘重新读取结果。未减断言、改时长上限或补发救济资金。

初始仍是明确的已进展夹具：140 岛币、大多数物品各 100 件，初始缺少的木料和灯笼走正式任务；预置商品不向游客销售。像素岛最终 100 岛币，折纸岛 98 岛币，包含实际升级和维护支出，所有日账均已支付、无欠付。这证明组合核算可以连续完成，不能代替零开局、全部订单与专精、真人制作耗时或长期娱乐性验收。

早先 30 日流程在第 17／22 日超时的失败记录保留。当前通过来自实际减少重复开销后的新检查，没有扩大预算。

## 审核时能看到正式制品

作品书架增加正式物品数量及双画风素材引用计数；正式物品审核页先显示作者、授权、每件物品的两套图片与加工用途。关卡目标、画风说明和版本摘要可展开查看。手机上两套图片也并列显示，像素采样与折纸采样分别按素材类型处理。

双画风修改前各复现一例缺图；修改后实际上传、原图解码、审核发布、正式制作、组件加工、赠礼和另一账户导入制作通过。另检查了桌面与 390 像素布局。测试 PNG 为声明过的图案夹具，不作为美术语义或真人课程验收。实际图片仍由服务器解码、校验与保存；界面计数不取代这些检查。教程资料和四份中英 README 同步功能说明。

## 仍需继续

V230 的实际双画风一小时运行已经结束：性能、尾段帧和空浏览器恢复通过，但折纸岛记录一次模型回复格式错误及一次提前收获冲突，因此整体未通过。农田确认缺口已在 V232 修复；原始失败不改写，模型坏回复还需在后续隔离检查中保留原文定位。

真实 OPC 课堂、5–8 位新玩家、实体多设备、剩余跨岛合作、最终新包与新视频继续按各自范围验收。见[证据摘要](verification/v233/priority-closeout.json)与[真人任务卡](acceptance-session-v231.md)。

## English summary

Bounded deterministic definitions and immutable acknowledged audit snapshots reduce repeated validation work while preserving server checks and budgets. Both progressed-island scenarios completed 30 canonical game days with all five activities, wages, visitor service, investment and upkeep. OPC review now displays actual dual-style product previews and catalog totals; native creation-to-import workflows passed. Fixtures, human classes, physical devices, zero-start economics and the failed V230 real-hour run remain explicitly separate.
