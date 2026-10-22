# 后台存档回执超时 / Save worker acknowledgement deadlines

后台网络请求的 RPC 回执超时，过去会被误报为“浏览器暂存写入超时，未提交新作业”。请求其实可能已经被服务端接受，错误分类会跳过已有的同编号重试及真实回执核对。现在将这个网络等待边界标记为 save_request_timeout；浏览器存储操作仍保留自己的失败处理。15 秒 RPC、12 秒请求以及允许一次同编号重试的边界保持原值。玩家作业、取消和普通保存没有获得新增的自动提交权限。

新增控制直接丢弃实际 Worker 回执：HTTP 已成功，两个 15 秒等待确实到期后，只读取一次服务端真实租约；没有注入完成、时钟或收益。两画风均确认同一编号、唯一结算及可继续点击。单元回归先复现 6 项失败，修正后连同现有保存控制 97 项通过。2089 项默认检查通过；新增 6 项边界检查在 Node22/24 均通过。12 项相关原生场景通过，覆盖部分交付暂停恢复、接管、连续分工和自定义配方。

另外两处验收夹具修正：动作重叠检查先提交自己的准备进度，再开始原 15 秒操作时限；自动核对期间等待按钮重新可用，避免对已经关闭的禁用按钮继续等待。原完成条件、产物、时限和资源断言保留。

本次回归不证明旧 GitHub 四项失败具有同一个根因。新托管运行、最终交付包、20 分钟运行及真实玩家/设备/OPC 分别核对，见 [结构化记录](verification-v361.json)。

## English

An expired network RPC acknowledgement was incorrectly classified as a browser-storage failure even when the server could already have accepted the request. It now carries save_request_timeout so the existing bounded, identical-request retry and authoritative receipt lookup can apply. The 15-second RPC and 12-second fetch deadlines remain unchanged. Player actions, cancellation and autosaves gain no automatic submission permission.

The native control loses actual Worker acknowledgements after successful HTTP commits, waits both real deadlines, reads the one accepted lease and proves unique settlement and usable input in each style. Six controls fail before the correction; 97 related checks, all 2,089 default checks and 12 native cases pass afterwards; the six new deadline checks also pass on Node22. Fixture preparation now checkpoints its own edits before the unchanged action budget, and recovery waits for an enabled button instead of clicking an automatic, disabled reconciliation control.

These results do not establish a common cause for the four historical hosted failures. Hosted runs, the final archive, twenty-minute observation, physical devices, human players and OPC retain their separate evidence boundaries.
