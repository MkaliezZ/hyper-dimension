# 核对进度期间保留地图画面

## 现象与证据

V267 完整检查中，macOS Intel 折纸版在原4秒恢复点击限制内再次超时。该次日志、输入事件与追踪产物已保留，并校验下载散列和ZIP完整性。原生暂停窗口已经关闭，按钮启用且命中正确，但点击期间没有收到对应输入事件，同时记录到连续长任务，最长约1.25秒。此前单项检查的成功不能覆盖这次失败。

本机额外采样发现，存档阻塞期间世界逻辑虽已暂停，地图、建筑和角色仍反复重绘。6倍CPU限速下，主要绘制成本也在世界渲染；这是本机压力诊断，并非精确复现macOS执行机的性能。

## 修复与验证

存档冲突、进度核对等原有锁定状态下，保留已经画好的小岛背景。窗口尺寸或显示密度变化仍按新分辨率重画，锁定解除后每帧动画恢复。保存请求、权威回执、游戏时间、模型及调用频率未改；普通待确认请求也没有被新增为全局暂停。

- 新增原生观察检查：修复前两画风在8帧内均重绘8次并正确失败；修复后保留初始画面，窗口变化重画一次，恢复后8帧均继续绘制。存档资源与控件保持可用。
- 原V220原生弹窗检查文件逐字节保留，点击仍限4秒，恢复、备份、资源、重开、暂停恢复和弹窗生命周期全部通过。
- 同机6倍CPU限速单次样本，按钮调用从约1.36/2.22秒降至0.30/0.31秒；不作为跨机器性能承诺。
- 既有恢复控件、会客馆背景缓存双画风检查通过；1393条默认规则通过。

完整检查和显式输入诊断入口附加新的观察检查及产物，原步骤、输入时限与断言继续保留。原macOS14执行机关机中断另行记录，不能算作通过。新的托管复验尚待完成；本机自动化不代表真人、物理多设备或完整交付验收。

## English summary

The failed hosted trace shows an enabled, unobstructed recovery button with its native modal already closed, but no delivered click amid repeated long tasks. World simulation was paused while the full map kept repainting. Recovery now retains its painted backdrop, redraws after resizing and resumes normal animation when the original save lock clears. Saves, authority, clocks and model cadence remain unchanged. The original 4-second input test is byte-identical. A new native observation fails against old repeated painting and passes with resize and resumed animation. Ten local native cases and 1393 default rules pass; hosted verification remains pending.
