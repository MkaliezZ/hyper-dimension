# 恢复弹窗输入诊断与当前候选验证

## 保留原失败

V265 托管 macOS Intel 的恢复弹窗检查中，像素用例通过，折纸用例在原生点击的4秒限制内超时。原日志、截图和校验过的隔离产物已保留。本机随后按原断言复现，两种画风均通过；这不能证明托管故障已经修复。

本轮只补充测试证据：输入事件与弹窗状态时间线、渲染长任务、失败时的命中目标，以及失败用例的 Playwright 轨迹。原4秒点击、存档副本、权威资源、回执数量、回岛后控件及原生弹窗生命周期断言保持原样。轨迹来自临时虚构账号，仅存入短期隔离检查产物，不进入公开素材。

本机完整用例通过；另用仅作用于隔离响应的反向对照，故意让原生弹窗继续阻挡输入。两种画风均按原4秒限制失败，并保留可解压轨迹。没有将预期失败写成产品通过。原托管超时仍待新证据判定。

## V265 精确候选已经完成的检查

从公开源码包重新解压并离线部署，Windows的15步独立部署检查完成；相同候选的两画风10日受保护账目检查完成。后者声明合成初始资源与日钟条件，只用于核对账目规则，不代表新玩家长期经营体验。

该精确候选随后在两份独立零起点隔离世界真实运行60分钟，实际调用 Flash/Hermes，未注入时间。性能、末段帧采样、寻路、功能接口及空浏览器重开检查通过；没有意外接口错误，正常自动调用冷却按原规则记录。原V262小时的格式错误与失败报告仍完整保留。

V266未修改游戏、模型、存档、经济、人物或画面运行代码；按清单逐字节核对了运行资源。1393条规则检查、15步部署和本轮小时证据均来自V265精确候选，不能冒称V266已重新完成另一轮独立部署，也不能视为Mac实机、新玩家、真实OPC课程或完整交付验收。结果见[摘要](verification/v266/recovery-input-diagnostics.json)。

## English summary

A hosted Intel Mac recovery click timed out. Unchanged local reproduction passed, so the hosted issue remains unresolved. This patch adds input/long-task/modal diagnostics and failure-only traces, preserving the original4000ms click and every acceptance assertion. An isolated blocking-modal negative control still fails and retains valid traces. Game/runtime/assets are byte-identical to the qualified V265 candidate, whose fresh15-step Windows deployment, protected10-day accounting cases and actual dual-theme60-minute run passed. These automated results are not human, physical-device or full delivery acceptance.
