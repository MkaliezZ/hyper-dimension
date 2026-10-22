# V359 · 任务中断与岛主实际交付 / Interruption and real owner delivery

## 修复

筹备步骤交给岛主后，亲手采集、开矿、钓鱼或收获的材料现在会凭服务端实际回执计入该步骤。接受动作时绑定原计划、步骤、负责人代次及请求编号；同物品的其他计划不会在动作完成时替换目标。刷新或服务重启后仍沿用原绑定，重复核对只记录一次。

暂停、取消与改派会使旧绑定失效。已经真正取得的材料保留在背包，旧动作不会向已变化的任务补记进度。完成或撤销后的过期采集入口也会释放旧绑定。农田整地、播种、浇水与未产出目标矿物的敲击不会虚增收获。

## 已核对的范围

- Node22和24各78项相关检查，包括两种画风的实际动作回执、重启重放、同物品多计划选择，以及暂停/恢复/改派/取消边界。该组单元夹具声明人工时钟、工具和成熟作物。
- 四组原生界面检查：两种画风分别真实交付2份后暂停、丢失已提交暂停响应、用原编号核对、服务与空浏览器重开、继续到6份且仅三条完成回执，并取消正在执行的依赖任务。另两组通过界面把真实居民作业交给岛主、取消原租约、实际采集并核对对应任务证据，最后取消计划保留已得物资并解除预留。
- 原始三步任务续做与恢复界面检查通过，两种画风的原4秒恢复点击限制保留。另从服务端零币零库存真实采集、制作、中途刷新、上架并完成游客购买；连续丢失两次成交响应仍核对同一交易。原道路及服务预算不变。

上述原生检查不注入时钟或后续产出；中断夹具明确设置满需求居民和固定管家建议，提供者禁用。它们是同一台Windows机器上的隔离自动化，不能替代实际多设备、新玩家或OPC试课。V357真实SDK、原机CLI与双画风四岛A2A证据保留；最终冻结版仍需重核完整流程。

主分支V358的Windows居民作业、经营内容与SQL检查已经恢复成功；Mac Intel原恢复点击超时尚在定位。两次保留原4秒断言的独立Mac诊断通过，第二次包括与原失败相同的前序恢复步骤，点击分别为像素913毫秒、折纸173毫秒；仍不足以证明原主流程已恢复或定位根因。没有放宽断言、盲目重跑或把未通过项列为完成。Node24完整默认检查2080项（2066＋14）通过，无失败、跳过或取消；后续托管状态另行记录，未新建大体积交付包。详见[结构化记录](verification-v359.json)。

## English

Raw materials actually gathered, mined, caught or harvested by the owner now advance the matching preparation step through an authoritative receipt. The accepted action binds the original project, step, assignment generation and request. Restarts preserve that binding; repeated acknowledgements cannot add another delivery or switch to a different same-item project. Pause, cancel and reassignment invalidate old task credit while retaining genuinely earned inventory. Preparatory farm actions and unsuccessful target production create no harvest credit.

Each Node version passes78 related controls. Both styles also complete native partial delivery, a genuinely lost committed pause response, recovery with the same request, service/empty-browser restart, the remaining quantity and cancellation without late output. Separate native cases take over an actual resident lease and verify real owner output against its task receipt. Original task-chain and strict4-second recovery controls pass, followed by zero-resource production, reload and a unique tourist sale despite two lost responses. Native clocks and subsequent resources are not injected; full NPC needs and deterministic proposals in the interruption fixture are declared, and providers are blocked.

The full Node24 default suite also passes 2080 cases with no failure, skip or cancellation. These are isolated same-host Windows controls. Human, physical-device, OPC and final frozen-package acceptance remain separate. The earlier real A2A qualification must be repeated against that frozen package. Hosted Windows resident/content and SQL checks pass onV358, while the original Mac Intel recovery timeout remains under investigation; two passing targeted diagnostics, including the original recovery predecessors (913ms pixel,173ms origami within the unchanged4seconds), do not establish a root cause or recovery of the original whole workflow.
