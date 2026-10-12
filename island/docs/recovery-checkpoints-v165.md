# V165 · 刷新核对与旧库存记录 / Reload checkpoints and existing discovery

## 问题与修复

V164 同源码完整 CI 38252053803 结束：4/6 通过，Windows 与 Intel Mac 的原生农田刷新在 controller-5（居民恢复）超过既有 45 秒等待。素材已激活，不能归因于贴图未加载。

隔离原生双画风剖析（浏览器 CPU 4 倍降速、屏蔽模型）发现，一次刷新恢复 11 项居民、矿洞和游客作业时，会在每项取消前再次保存：22 次保存/作业请求、22 次合并。未复现无限循环，未发现快照重试；本机恢复约 9 秒，不能替代云端结果。

居民、矿洞与游客恢复现在分别只先保存一次当前本地进度。每项取消仍走原有持久命令、版本校验、服务端回执与合并；核对期间出现的新修改仍被 enqueue 并由下一条命令 flush，超时与未确认状态保留原核对流程。正常开始、结束或主动取消作业仍先保存。没有加长原生测试等待时间。

旧服务端存档可能已拥有物资而缺少发现记录。打开经过完整校验的主存档时，仅按其已拥有的已知目录物品补齐标记，先保存 before-discovery-repair 备份，再写新版本及个人快照。忽略浏览器提供的库存、金币与发现标记，不赠送资源，不改变时间、身份、在途作业、预留物资或收益。再次打开不重复修复。真实冲突仍由版本保护处理。

## 证据与边界

6 项新增保护检查通过：双画风旧档备份与幂等、保留活动中的玩家/居民作业、拒绝伪造库存；居民/矿洞恢复保留本地位置与回执到达前的新简介，3 项取消产生 1 次初始保存，存在并发修改时为 2 次，每项回执唯一。测试使用隔离真实存档库，客户端 DOM 为轻量替身；原生浏览器与完整平台检查另计。

本机仍运行 V160，公开发布包仍是 V158；本轮源码不代表完整产品或真人/实机验收。完整 18R/28F/30T 范围保持 4 完成、14 进行中。

## English

V164 full CI ended with four of six jobs passing. Windows and Intel Mac farm reload exceeded the existing 45-second readiness check during resident recovery, after artwork activation. An isolated, 4× CPU-throttled native trace showed eleven orphan cancellations preceded by eleven saves and twenty-two merges, without a retry loop.

Resident, mining and visitor recovery now checkpoint once per recovery group. Every cancellation still uses the durable command journal, server version checks, its own receipt and merge. Concurrent local edits are still flushed before the following command. Existing validated server saves repair missing discovery flags from their own positive catalog inventory, with a pre-repair backup and a new acknowledged snapshot. No stock, money, clock, identity or active work is reset; browser-supplied balances are ignored.

Six focused tests passed. Full native/platform checks are recorded separately. Local V160 and public V158 remain current; full product acceptance remains open.

## 本机原生剖析结果

同一原生农田流程、4 倍 CPU 降速与模型屏蔽条件下，两主题通过实际肥料制作、施肥、生长、收获、刷新。原生场景初始物资夹具与自动 NPC 作业保留；像素/折纸分别观察到 188.587 / 189.672 秒生长。折纸前后都恢复 11 项作业，保存 11→3 次、合并 22→14 次，剖析窗口 9.437→6.739 秒。像素后一次遗留作业数量不同（11→9），不能把其耗时差直接视为同负载提升。完整平台结果另行记录。

Both native farm flows passed at 4× CPU throttle with blocked models and declared raw-input fixtures. Origami had eleven cancellations in both samples: saves fell from eleven to three, merges from twenty-two to fourteen, and the measured window from 9.437 to 6.739 seconds. Pixel had a different orphan count, so its duration is not a like-for-like improvement claim.

## 旧版迁移兼容复核

首次完整规则检查出现 4 项旧版迁移失败：连续升级写入改变了 previous.json 的原始备份。现将发现记录修复合入同一次 resource-migration，保留升级前的完整字节及 before-resource-authority 历史。修复后 35 项关联检查通过（含前述 6 项，不相加）；完整规则重新执行，原失败日志保留。已有资源保护的旧档仍使用单独的 before-discovery-repair 备份。

The first full rules run exposed four legacy-migration regressions: a second upgrade commit replaced the original previous.json backup. Discovery repair is now folded into resource migration when needed, preserving original bytes and the existing history checkpoint. All 35 affected checks passed, including the six new checks; the full suite is being rerun, and its first failure log is retained.
