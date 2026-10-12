# V164 · 首次 NPC 产出与刷新 / First NPC gains and reload

## 可复现的问题与修复

V163 Mac ARM 折纸农田刷新失败的现场显示：农田未锁定，保存与居民矿洞恢复出现 personal_state_conflict。隔离服务端复现首次 NPC 开矿：得到石材 1、矿石 2，但 discovered 为空；浏览器 hydrateTown 将两者补为已发现，个人账本快照不同，下一次保护保存被拒绝。修复后同一复现库存、发现标记和账本一致，刷新后的保存通过。

NPC 采矿、农田收获、温室补种、基础采集的产出现在通过共享物资事务入库，记录发现与一次物资事件。保留原数量、工具与时间门槛、个人产出归属、命令去重和余额保护；重复服务器命令不新增物资或事件。温室补种提示按实际补种结果显示。

53 项针对性检查通过，包括新增双主题四种 NPC 产出后的保护保存、独立磁盘重开与重复完成请求，以及全部基础素材入库和非法产出拒绝。该服务端测试使用已声明的初始场景与测试时钟，不代表真人或实时全流程。

## 仍待核对

V163 同源码 CI 最终结论保留；Windows 原生农田通过，Mac ARM 折纸出现上述冲突，Intel Mac 在启动恢复未结束处失败。仅 boot=true 不能证明具体耗时来自图片；V164 增加只读 QA 启动阶段，以区分主题素材解码与逐控制器恢复。没有关闭校验、强制点击或扩大超时。

CI 支持显式手动 soil-diagnostics，运行同一农田原生检查并保留隔离报告/截图；默认 push 与 full dispatch 继续运行全部六项平台任务。诊断通过不能作为完整部署验收。当前本机 V160、公开 V158、旧草稿与失败包保留；完整 18R/28F/30T 仍为 4 完成、14 进行中。

A2A 卡片字段保持现值，源码修复通过 Git 提交与 release-manifest 的 publicRevision 标识；协议兼容性没有以版本字段变更推断。

## English

A real protected-store reproduction isolated the failure: an NPC's first mining gain added one stone and two ore without discovery flags. Client hydration added those flags, violating the acknowledged personal snapshot. NPC mining, farm harvest, greenhouse seed bonuses and raw gathering now commit gain, discovery and journal events together, preserving original quantities and exactly-once server receipts. The reproduction now saves successfully; 53 focused checks passed.

Intel Mac's unfinished boot is still under diagnosis. Read-only QA phases distinguish artwork activation from individual controller recovery. Explicitly dispatched soil diagnostics retain all original farm assertions; default push/full workflows retain all six platform gates. Local V160 and public V158 stay current; no whole-product, human or physical-device acceptance is claimed.


## 本机完整检查追加

925 + 14 = 939 项默认检查全部通过；53 项关联检查与其有重叠，不相加。实际双画风制作肥料、施肥、183.543 / 183.447 秒生长、收获与刷新通过，模型屏蔽、初始素材夹具保持明确。完整平台检查另行执行。

All 939 default checks passed locally. The 53 focused checks overlap with that suite. Both native soil-care flows passed with 183.543 / 183.447 seconds of observed growth, retaining declared raw-input fixtures and blocked models. Full platform checks remain separate.
