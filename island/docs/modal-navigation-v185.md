# V185 · Native modal navigation / 弹窗导航验收

V184 run [38544256605](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38544256605), commit `d4c921e07ca11a70a5081117c93757d091a76552`, completed with eight successes and one failed macOS14 deployment job. **The Intel Mac native-gameplay job passed**, including the previously failing queued reward checks.

The remaining Mac ARM failure was `locator.click: Timeout 30000ms exceeded` on `#closeModal` during the pixel order navigation fixture. Its initiating order had a successful server receipt. The original failure report did not include recovery/inert diagnostics, and this fixture's report/screenshots were not in the workflow artifact list. The precise Mac-side cause remains unproven. A local ten-second real-response hold completed in both styles.

The fixture now waits for both personal and commerce controllers, completed startup and a usable main UI before issuing commands. Like the delayed-reward fixtures, it suspends autonomous production before runtime construction; it verifies the suspension actually happened. The intended test remains navigation during the held acknowledgement of the player's own successful order/supply/upgrade/maintenance/item action. Explicit concurrent resident/action tests remain enabled in their existing fixtures.

Diagnostics record pending-action kind, controller state, initiating-modal and main-UI inert flags, visible recovery panels and the current title before the native close and on failure. Workflow artifacts now retain this fixture's actual report and screenshots. No force click, DOM unlocking, fake receipt or assertion removal was introduced.

All twelve local native cases pass: six operations in pixel and origami, a real successful response held until native close and journal navigation, the new view preserved after release, exactly one server receipt, and exactly one receipt after refresh. The V185 cloud run must independently confirm Mac ARM; this local result does not establish full-platform or complete product acceptance.

## 当前范围

V184 Intel Mac原生玩法已成功。Mac ARM本轮失败来自订单弹窗的原生关闭超时，现有证据不足以断定平台侧根因；本机延迟10秒的同类检查通过。夹具已补启动条件、明确隔离自主生产和失败现场诊断，12个两画风场景通过；原原生点击、晚到回执不改页面、刷新单次结算断言保留，未强制点击或解锁DOM。

人物连续动作修复仍是V179/V180实现，V182补充36项规则和8模式双风格原生复查。完整四季底图未完成：整岛材质蒙版试制不符合美学要求，未部署。原生区域春秋冬场景正按原坐标重绘，完整覆盖、接缝和轮换验收继续。住所内部、经营与整体交付仍未完成。
