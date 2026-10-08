# V115 · Windows 存档替换恢复 / Windows save replacement recovery

## 中文

在 Windows 上，杀毒扫描、索引或其他进程短暂持有存档文件句柄时，原子的文件替换可能返回 EPERM / EACCES / EBUSY。旧实现会立即返回保存失败；现在在已同步落盘的临时文件上进行有界异步重试，六次等待总计 680 毫秒，最多七次替换尝试。

重试期间不删除目标存档、不重新生成任务/奖励，也不阻塞 JavaScript 事件循环。若占用仍持续，保留原存档、清理本次临时文件并返回原错误，由上层保存恢复流程继续处理。磁盘空间不足等其他错误立即返回；macOS/Linux 的替换语义保持原样。此修复不宣称已经确认历史占用的具体外部进程。

### 验证

- 720 项默认回归通过，包含保存/恢复、制作与奖励的既有检查。
- 四个新增测试覆盖同一路径重试、永久权限失败上限、非 Windows/磁盘错误以及序列化失败后的旧文件保留和临时文件清理。
- 真实 Windows 句柄占用隔离存档 600 毫秒：原实现复现 rename EPERM；新实现约 750 毫秒内在同一次请求成功，只增加一次修订，无临时文件残留。
- 占用 1600 毫秒：新实现在约 752 毫秒返回原错误，旧存档逐字节保持；解除占用后重试成功一次。等待期间事件循环定时器继续运行。

以上使用隔离新建存档，不含用户数据或模型调用。持续占用仍会报告错误；这些证据不替代最新版本的一小时运行、真人产品验收或实体 Mac 检查。

### 更新

先备份数据，同时更新 `server/saveStore.mjs` 与新增的 `server/atomicJson.mjs`，重启目标游戏服务。不要只复制入口文件，也不需要重置岛屿。

```sh
npm test
npm run test:atomic-json
```

## English

Windows file handles held temporarily by another process may reject an atomic rename with EPERM, EACCES or EBUSY. The server now retries the same already-synced temporary file asynchronously: at most seven attempts with six waits totaling 680 ms.

It never removes the destination to bypass a lock. A persistent failure preserves the original save, cleans up this temporary file and reports the original error. Non-Windows behavior and unrelated failures such as disk exhaustion remain immediate. No game command or reward is replayed during these file-level retries.

All 720 default checks passed. Four new tests cover retry paths and limits, platform/error classification, serialization failure and cleanup. Actual isolated Windows handle checks recovered a 600 ms hold in one save request and verified bounded failure under a 1600 ms hold, preservation of the original file, event-loop responsiveness and successful later retry. These checks do not identify the external process behind historical failures or replace full long-duration, human or physical-Mac acceptance.

Back up data and deploy both server modules together before restarting. No island reset is required. Minigames remain demonstration placeholders under continued development; full product acceptance is still in progress.
