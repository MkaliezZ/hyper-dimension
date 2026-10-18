# Native fixture synchronization / 原生测试准备同步

V286 changes isolated test fixtures and verification metadata. Application, server, artwork, timing, prices and production rules are byte-identical to V285.

## Granted-action overlap / 已授权动作的并发条件

The player-action fixture previously issued its unrelated real resident request after several external browser-observer round trips. A declared three-second observer delay reproduced a failure: gathering had already finished before the foreign request began. This did not establish the intended overlap.

The fixture now queues the same real resident command in the turn that mounts an actual accepted gather animation. The original function receives the same arguments; no animation progress, inventory, clock or server receipt is injected. The response must still be a real HTTP 200, held below its existing timeout. The original 15-second setup, five-second pose observation, 30-second confirmation and exactly-one-finish/reload assertions remain. Both styles passed normally and with the declared three-second observer delay: four automated Windows cases. Hosted Mac confirmation remains pending.

## Owned temporary roots / 隔离临时目录

macOS can expose its temporary directory through `/var`, which is a link to `/private/var`. The five shutdown checks now canonicalize their owned temporary root with `realpath` before creating fixtures. Production data-path link rejection is unchanged. An owned Windows junction reproduced four failures in the original fixture; all five checks then passed both with the ordinary temporary directory and through that linked root, ten checks in total.

这两项修正均保留原业务断言与时限。它们不代表 Mac 图形卡死已解决，也不替代实体 Mac、真人或完整产品验收。ARM 原生 Metal 的围栏等待、Intel 低帧率下的连续工作预算及其余交付项仍单独跟踪。README 保持功能与部署内容。
