# V284 · 管家委托在正常退出时收尾

管家的手动委托在 HTTP 返回 202 后仍会继续执行。此前正常关闭服务会先关闭执行端，可能把已经接受的后台作业中断；岛主查询尚未完成时也可能在关闭后创建新的执行端。

现在关闭管家服务先停止接收新委托，等待本机执行端已经接受的手动作业和自动请求完成，并等待结果记录写入，再关闭该岛主的执行端。结果记录或执行端退出失败会向上传递，服务保留数据运行锁，不报告正常退出。跨设备原机桥接在服务器退出时仍按原规则保留未确认请求，重连后核对原编号回执；本次没有实现跨设备退出排空。强制结束进程或断电后的未确认作业也不会自动重放现实文件工作。

## 验证

- 原代码的像素、折纸后台作业和关闭期间岛主查询共三例均复现失败。
- 修复后五例通过：两种画风的后台结果、原编号重启回放、关闭时的查询竞态、HTTP 已返回 202 的作业，以及结果文件不能写入时的退出失败。
- 关联的账号隔离、原机桥接、A2A、自定义配方和原有管家测试通过；共 52 项，其中包含上述五例。
- 测试使用隔离临时目录和明确的虚构执行结果；原有文档执行器测试只读写自己的虚构文件。没有调用外部模型、读取用户文档或改变本机原存档。

复现命令：`node --test tests/v284-agent-shutdown.test.mjs`。这些检查证明正常退出顺序和持久结果保护，不替代真实课堂、真人、多设备或完整游戏验收。V281 安装包及正在进行的一小时运行继续保留 V281 来源；本次后端改动未包含在该冻结运行中。

## English

Accepted local manual jobs continue after their HTTP 202 response. Graceful shutdown now rejects new admissions, waits for local work and durable results, then closes each owner's runtime. Persistence or runtime-close errors propagate so the data lease is retained. Cross-device bridge shutdown still uses its existing unconfirmed-request/recovery contract; remote draining is not implemented here. Abrupt termination preserves identities without replaying real file operations. Five focused cases and47related checks pass using fictional isolated data; the frozen V281 hour does not cover this backend change.
