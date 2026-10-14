# V182 · Native reward checkpoint and action verification

## Intel Mac failure

V181 run [38517325295](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38517325295), commit `f25c7f12173d930a051b72563578dab012cacd3e`, finished with eight successful jobs and one failed Intel Mac native gameplay job. The failed assertion was `last result checkpoint must be held before the native claim click` in `v168-reward-click-browser.mjs`. Other claim/cancel cases completed with no asset or page errors.

The interception previously inspected the visible result-panel phase when the checkpoint request arrived. The winning input can leave the browser before its next result-panel paint. In that ordering, the deliberate response hold never starts. The fixture now reads the accepted checkpoint response and derives `craftResult(ticket.game).passed`, checks its HTTP status and request identity, and holds that same winning response until the native click. This is the same authoritative trigger already used by the independent-receipt test. It does not inject a result, fabricate an outcome, remove the hold assertion or relax the one-receipt/one-product checks.

## Current validation

- Native delayed-result check: four cases pass, both themes, double-click claim and close/cancel. Each real legal puzzle solution produces a single settled receipt or a cancellation without cost/output.
- Independent resident receipt and lost-response recovery: six cases pass. Two deliberate failed requests belong to the explicit recovery scenarios, not incidental failures.
- Action geometry, facing, movement and action lifecycle: 36 tests pass. One process-inventory test first hit a sandbox permission denial; the same 36 assertions passed after rerunning with local process-inventory access.
- Native action fixture expanded to idle, walk, hoe, pickaxe, axe, sow, harvest and clothed watering. Both themes decode 448 original eight-direction frames and draw 480 dressed/tool review samples. Sixteen residents are rendered across all eight modes. Warm CPU/cadence measurements remain machine-specific; cold shader/loading stalls remain visible in the reports. This does not prove that a complete game session never stalls.
- No paid model calls or real user saves are used by these fixtures. Runtime action fixes remain those in V179/V180: shared connected joints, garment/tool anchors, finite waiting poses, one-time accepted-work completion and low-frame-rate navigation.

V182 changes validation code and documentation. Its own cloud rerun must be observed separately before reporting the Intel job or all platforms as passed. Whole-island seasons, night lighting, residence interiors and the remaining delivery review continue.

## 中文说明

Intel Mac 失败来自测试用界面渲染状态选择延迟拦截时机：请求可能先于结果面板绘制，导致没有拦截到最后一次胜利回执。现在读取服务端实际重放后的胜利结果，并核对状态码和操作编号，再暂停同一条回执。原双击、取消、材料和单次结算断言保留；不是将失败改成跳过。

本轮四个延迟领奖场景、六个独立回执/恢复场景、36项动作相关规则通过；实际原生绘制扩展到八种模式，覆盖双风格448个方向帧和480个穿衣工具组合。V179/V180人物动作修复已经在当前代码中，首次加载长帧仍须继续优化。实体Mac、真人和完整玩法验收尚不能由该检查推定。
