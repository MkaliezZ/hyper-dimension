# 本地 A2A 只读原型：实装范围与验收

状态：**仅本机、仅模拟数据、两项只读操作**。代码为 [local_a2a.py](../src/hyper_dimension/local_a2a.py)，使用官方 A2A Python SDK 1.1.5 的 v1 JSON-RPC 路由、Agent Card 和 Task。启动器为 [run_local_a2a.py](../scripts/run_local_a2a.py)。默认公共 API 不自动加载这个适配器。教师版本地 API 的学生登记通过[可替换的监护授权接口](../src/hyper_dimension/guardian_authorization.py)使用未核验的模拟全授权默认值，仅用于模拟资料。

## 已跑通

| 能力 | 真实行为 |
| --- | --- |
| Agent Card | `/.well-known/agent-card.json` 声明 JSON-RPC v1、Bearer 和仅两项已实现技能：`student.profile.read.v1`、`showcase.public.read.v1` |
| 传输 | `POST /a2a` 接受官方格式的 `SendMessage` 与 `A2A-Version: 1.0`；业务 DataPart 必须符合 Hyper Dimension 1.2 |
| 身份 | 整个 `/a2a` JSON-RPC 入口要求本地教师 Bearer，因此 SendMessage 与 GetTask 都会先认证；密钥不写 DataPart 或审计 |
| 档案读取 | 对绑定岛内存在的模拟学生调用 `StudentRecords.profile`，返回版本化档案快照与 profile 引用；跨岛或缺失返回 NOT_FOUND |
| 成果读取 | 调用现有 `StudentRecords.public_showcase`，只返回仍已发布且许可有效的卡片；最多返回最新 20 张，并以 `has_more` 标出截断；尚无分页接口 |
| 业务审计 | 被业务层接纳的成功/拒绝请求写 `a2a_read_events`，存 request_id、task_id、context_id 并返回真实 `audit_event_id`；结构不合法的请求在业务前拒绝；当前内部异常和协议层拒绝尚未全部写入统一审计 |
| 禁止误操作 | 其他九项 Profile 操作即使 Schema 有定义，也会被服务端拒绝为 `POLICY_BLOCKED`；没有 Agent 直接发布或评分入口 |

一次成功的 Task 的 Artifact 有两个 JSON DataPart：第一项是[通用业务结果 1.2](../src/hyper_dimension/schemas/hd-education-result-v1.2.schema.json)，第二项是[只读内容 1.2](../src/hyper_dimension/schemas/hd-education-a2a-read-content-v1.2.schema.json)。业务拒绝只有第一项并进入 `TASK_STATE_REJECTED`。Task 历史不是审计表。

## 本地启动

在本仓库安装 `python -m pip install -e ".[dev,mcp,a2a]"`。准备**已有的模拟**数据库和档案目录；在当前进程设置 `HD_LOCAL_DB`、`HD_LOCAL_ARCHIVE`、`HD_TENANT_ID`、`HD_TEACHER_ID`、至少 24 字符的随机 `HD_TEACHER_TOKEN`，可选 `HD_LOCAL_A2A_PORT`（默认 8770），运行 `python scripts/run_local_a2a.py`。绑定地址固定为 `127.0.0.1`。只读进程不加载模型或 DeepSeek key。凭据和学生资料不得提交 Git。

请求需要 `Authorization: Bearer ...`、`A2A-Version: 1.0`，业务命令放在唯一 JSON DataPart 中，示例见[教育 A2A 语义 Profile](a2a-education-profile-v1.md)。Agent Card 的 URL 取实际本地端口。自动测试见 [test_local_a2a.py](../tests/test_local_a2a.py)。此外，曾以真实本机 TCP 端口做独立冒烟验证：Agent Card 200、无令牌请求 401、带令牌请求返回 `TASK_STATE_COMPLETED` 和两段数据；测试服务已停止，模拟数据已清理。

## 未实现的部分

本地静态教师令牌只识别一个绑定教师/岛，不能核验真实教师身份、任教班级、多租户委托或监护关系。SDK Task Store 是内存型，重启后 Task 不保留；虽然本地交互审计在 SQLite 中，仍没有生产 Task ACL、PostgreSQL、OIDC/JWKS、Agent 委托、学生 Agent、跨岛互通、未成年人模式和公网部署。不要把这个进程绑定到公网地址。后续按[身份网关设计](identity-gateway-v0.1.md)替换令牌和任务存储，并进行跨主体 GetTask/ListTasks/订阅与撤回测试。
