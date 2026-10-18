# 住所原生操作诊断

V269的完整检查中，macOS14在打开知夏住所的来历笔记时等待45秒超时。该步骤尚未开始画风切换。原日志、产物及下载散列已在私有验证目录保留；原产物没有这一失败时刻的截图和点击轨迹，暂不能判断是输入未送达、室内路径未推进还是恢复状态阻挡。

本分支只增加有界观察：实际浏览器点击、最多32份室内位置/路径样本、启动与恢复状态、阶段名称及失败截图。原生鼠标、路径、全部旧断言和时限保持不变，游戏运行字节与V269一致。本机知夏和管家住所的原生流程通过；明确停用隔离按钮处理的反向对照仍在原45秒上限失败，并正确留下真实点击、静止路径和截图。

另一次本机4倍CPU限速流程已完成来历笔记并保存，随后刷新时失败于贴图解码。这次失败单独保留，不计为整条流程通过，也不能当作macOS原失败的复现。

新增显式home-journal诊断范围，在三平台独立执行原知夏、管家检查。所有完整检查命令、权限、预算与并发规则保持；诊断分支不替代main检查。这是取证改动，macOS原失败尚未定位或宣称修复。

前一项对白诊断39085633119已在Windows/macOS14/macOSIntel三平台共6例通过，三个产物散列及ZIP完整性已核对；完整检查仍存在上述住所失败，不能将专项通过称为完整交付、真人或物理多设备验收。

## English

The V269 macOS14 failure occurs before the appearance switch, while opening the curator activity. Bounded native click/path/startup observations and a failure screenshot supplement the unchanged input, route, assertions and budgets. Both normal local home flows pass; a deliberately ignored isolated input still fails the original45-second gate and records the cause. A separate CPU-stressed reload artwork failure remains recorded as a failure. The new explicit three-platform diagnostic runs on a separate branch without replacing main checks. This is evidence collection, not a claimed root-cause repair. The earlier social diagnostic passed six native cases across three hosted platforms; full acceptance remains incomplete.
