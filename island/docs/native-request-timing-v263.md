# 原生操作的准备与回执计时

对白验证会在实际采集请求被服务端接受后暂扣其回复，检查居民对白继续演出。点击采集后，客户端需要先完成原存档及命令排队，再发出 HTTP 请求。原检查把这两段时间混在一个从点击开始的 10 秒窗口中；Windows 托管失败记录中，请求最终已经被接受，原失败报告和截图保留。

现在先等待真实请求发出，单独记录准备时间，再从实际发出时刻计算原来的 10 秒 HTTP 上限。原生准备保留有限的 30 秒操作窗口。对白的 2.6 秒观察、至少推进 1 秒、等待期间不提前写入结果、正常取消、唯一落盘和刷新检查均保留。失败时先释放人为暂扣的回复，避免截取诊断画面时额外制造客户端超时。

本机双画风记录的准备时间约为 4.8–5.0 秒，实际 HTTP 接受均为 32 毫秒。修订的是验证过程的计时与清理；游戏逻辑、资源、模型、动画及存档规则没有改动。继承 V262 的 1390 条规则与 15 步独立安装证据，托管平台结果仍需等本次检查完成。

见[证据范围](verification/v263/native-request-timing.json)。这些仍是虚构世界的自动验证，不替代实际新玩家、OPC 学员或物理多设备验收。

## English summary

The native check now measures save/command preparation separately from the unchanged ten-second HTTP acceptance budget, using the actual dispatch timestamp. Dialogue, outcome, cancellation and reload assertions are retained. Held replies are released before failure diagnostics. Game/runtime payloads are unchanged from V262; new hosted results remain pending.
