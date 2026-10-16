# V222 · 招聘错误与同申请恢复 / Recruitment error recovery

## 修复

招聘操作失败后，原界面会在下一次状态查询成功时清空错误文案，留下“请求等待确认”。现在操作错误与状态读取错误分别保存：普通查询成功只清除读取错误；对应世界中出现同编号的实际进行中聘约后，才确认该申请已被接收。新的手动操作或切换小岛会清理相应界面状态。

继续确认沿用原申请编号，报酬预留、取消与服务端结算规则不变。没有新增自动重复招聘或模型调用。

## 验证

- 双画风各模拟明确的 409 拒绝与结果未确定的 503，共四个真实隔离 LAN 页面案例。正式对照使用有效世界身份和实际成功的后台状态读取，旧界面四例均未保留错误；修复后四例通过。
- 同申请重试请求体一致，只保留一笔 8 币预留；取消后实际释放，余额不重复增加或扣除。临时状态读取错误在下一次成功查询后消失。
- 一个案例模拟后续聘约状态，核对不同世界／不同编号不能确认原申请，同世界同编号才能清除对应提示。这是展示层响应夹具，不声称真实招募。
- 37 项既有招聘规则检查通过。早期夹具与异步等待问题另存于内部记录，未计为正式对照证据。

V221 冻结源码上的像素零开局流程，首次在等待招聘阶段超时；最初的底层错误没有被保留下来，原因尚未确认。保留存档并使用同一申请续作后，真实 Hermes／`deepseek-flash` 主子运行完成两份交付、首场夜集、28 币活动奖励、一次 8 币工资结算及离岛重载，源码 2,457 个载荷保持不变。该结果属于自动原生操作与一次恢复续作，完整主动经营、其他活动、真人及多设备验收继续。

## English

Successful background reads no longer erase a failed recruitment operation. Read errors clear after a successful read; a live contract with the same request and world confirms acceptance. Manual continuation retains its request identity and existing financial rules.

Four fictional native LAN rejection cases and 37 existing rule tests passed. A separate immutable V221 pixel zero-start journey completed real Hermes/Flash parent-child work after continuing the original timed-out request. The initial failure remains recorded and its original lower-level cause is unknown. Neither controlled status fixtures nor automated gameplay are human or physical-device acceptance.
