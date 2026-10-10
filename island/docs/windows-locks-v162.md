# V162 · Windows 文件锁 / Windows lock acquisition

## 修复与范围

V161 Windows CI 在 identity.lock 独占创建时收到 EPERM；独立离线检查还发现运行账本并发拒绝码不符合 automatic_cooldown，保留原失败记录。身份档案与 API 调用账本现在复用文件系统层的 Windows 有界重试，处理 EPERM / EACCES / EBUSY。每次仍以 wx / 0600 申请独占文件，最多等待 680 ms 后保留原错误；不删除占用锁，也不跳过所有者检查。EEXIST 仍走原互斥等待，macOS / Linux 的错误语义保持。

32 项针对性检查通过，包含短暂占用、永久拒绝、实际争用文件、两存储实例的持久 300 秒自动调用限频、身份和 A2A 唯一回执。永久失败不能获得文件句柄；已存在的所有者内容保留。新增 8 项进入默认套件。

## 茶盏与农田

更正前次诊断中的阶段描述：Mac ARM 茶盏超时发生在领奖后等待服务端制作完成确认的阶段。检查加入保存状态、待确认作业、制作控制器与游戏状态输出；保留原断言和 30 秒界限。本机双风格实际茶盏制作、唯一领奖与刷新通过，不冒称平台问题已经解决。农田刷新锁定同样继续由 V161 诊断追踪，未强制点击或清除保护。

V162 为修复源码，完整默认和跨平台结果另行验证；本机仍运行经过独立冻结验证的 V160，公开部署包仍为 V158，V159/V160 草稿保留。V161 包原离线失败保留，不重跑同一源码掩盖失败。完整范围仍为 18R/28F/30T，4 完成、14 进行中。

## English

Identity and API-call-ledger exclusive opens now use bounded Windows retries for sharing/permission/busy errors, retaining wx ownership and the original error after 680 ms. Existing owners are never removed by this retry; EEXIST and POSIX semantics are preserved. Thirty-two focused tests passed, including actual file contention, the persistent 300-second automatic-call limit and A2A idempotence.

The Mac ARM pearl-cup failure occurred after claiming, while awaiting settlement confirmation. Diagnostics now capture that state without weakening the assertions. Both local native cup flows passed; farm and platform regressions remain under verification. Local V160 and public V158 remain current; full acceptance remains 4 complete and 14 in progress.
