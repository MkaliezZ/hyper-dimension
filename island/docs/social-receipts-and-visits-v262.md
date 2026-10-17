# 对白回执与跨岛活动

## 已开始的对白持续演出

采集、制作或自动保存正在等待服务端回执时，已经开始的居民对白继续逐句显示。对白最多走到最后一句；关系变化、记忆、冷却时间和完整对话记录仍在普通模拟恢复后落定一次。等待回执不会提前制造社交成果，切换或重开世界也不会完成旧世界的对白。

可运行 `npm run test:social-pending-native` 检查：启动实际居民交谈，再暂扣一份已经成功的玩家采集回执。检查对白继续推进、回执等待期间没有提前写入完整交谈，随后通过普通取消、保存和刷新核对唯一记录。该检查使用明确声明的虚构历史、需求和晚间时钟初值；之后按正常时间运行，模型关闭时的本地对白不称为 AI 生成。

## 四岛与原机管家

像素主岛和折纸主岛分别完成四账号活动链：每位岛主携带自己的 Hermes 管家和两位同意随行的 AI 居民，原机管家通过独立 CLI 连接。每场包含两封信息往来、三组共九封筹备协作消息、真实入场预留、三位访客的原生小游戏挑战、评价和返岛。

服务端已接受但回复丢失的筹备、检查点及活动结算，均用原请求核对；重复核对没有再次扣款、转移物资或发奖。各场合计净消耗 8 岛币场地费，实际运行记录核对了管家所属岛主、父运行链和 DeepSeek Flash 模型。双方居民也留下了跨岛模型对话。

折纸活动沿用一次中断验证的原活动、原筹备和已接受成绩，完成剩余流程，原失败记录保留。像素活动使用新建虚构账号；此前旧活动的自然过期退款和旧账号设备会话上限拒绝分别保留，不通过改写旧账号或放宽限制继续测试。

这些是单台 Windows 上的隔离自动验证：四个账号、四个原机 CLI，每次渲染一个地图视图；初始资金、服装和活动材料是声明的测试初值，活动准备与游戏使用真实经过的时间。它们不等同于四台物理设备、零资源经济验收或真人反馈。OPC 实际学员与 5–8 位新玩家验收仍需真实参与者。

见[验证范围与证据](verification/v262/social-receipts-and-visits.json)。安装方式仍为 Agent 可部署的源码；当前版本的安装、长时间运行和宣传视频应分别核对其实际提交版本。

## English summary

Already-started dialogue keeps presenting while an unrelated durable receipt settles. Outcomes remain deferred until normal simulation resumes, and are committed once. Separate pixel-host and origami-host four-owner journeys used real owner-bound Hermes/Flash agents, consenting companions, funded activities, lost-reply recovery, settlement, ratings and return. These are declared-fixture automated checks on one Windows host, not physical-device or real-player acceptance.
