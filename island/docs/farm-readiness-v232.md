# V232 · 居民农活等待确认的田地阶段

V230 冻结版的一小时隔离运行捕获了一次居民收获请求被服务端以 `farm_stage / 作物还未成熟` 拒绝。原始请求时的完整客户端快照未保留；本轮复现了同类情况：本地已把作物显示为成熟，最新确认的服务端农田仍在生长，居民按本地预测重复发起收获。

居民选田现在同时检查最新确认的农田阶段；农田控制器在发送请求前再核对一次阶段与作物。未确认时不启动动作、不提交作业，也不创建预留；确认成熟后继续原分工。正常非服务端模拟保持原逻辑。服务端成熟、材料、任务、时长与唯一交付校验保持。

## 验证

- 两套画风修改前各复现三次提前请求；同一夹具修改后不提前请求，确认成熟后各派发一次，不把派发计作物资产出。
- 46 项相关规则检查通过，覆盖农活、天气、分工、并发种子预留、真实收获交付、暂停和取消。完整规则集 1272 项通过。
- 两套画风的实际浏览器组件检查通过：未成熟时请求和暂存次数均为零；确认成熟后只有一次请求，错误作物仍被拦住。
- 双画风原生农田页面的正常成熟作物收获与唯一服务端回执回归通过。

这些检查使用隔离夹具；组件的确认快照与响应是受控的，不能称为本轮真人或长期农田验收。原 V230 一小时运行、其余 API 错误与失败记录继续保留，不能因为本次修复将旧运行改成通过。见[证据摘要](verification/v232/farm-readiness.json)。

## English summary

Resident plot selection and request dispatch now check the last acknowledged farm stage and crop. Local growth prediction cannot start an early harvest. Once maturity is acknowledged, the original assignment can proceed. Server validation and receipt accounting remain unchanged. Reproduced two-theme failures, related rules, actual browser component checks and normal native harvest regressions are recorded separately from broader long-run or human acceptance.
