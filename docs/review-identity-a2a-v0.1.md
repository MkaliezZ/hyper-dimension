# 身份授权与本地 A2A 原型复核记录（2026-09-26）

## 本轮可验证结果

- 本地教师登记省略监护字段时，由可替换的 GuardianAuthorizationProvider 返回模拟全授权决定；API 明确返回 unverified_demo_default，数据库保存 demo-assumed-guardian-full-v1，不冒充真实签署。可注入其他 Provider 的测试已覆盖。
- 默认决定涵盖英语评测和展示字段许可，但公开卡片仍需来源归档、教师建草稿并发布；撤回展示许可后只读 A2A 不再返回卡片。
- A2A 使用官方 SDK 的 Agent Card、JSON-RPC SendMessage 和 Task；卡片只声明两项已实装只读技能。所有 /a2a JSON-RPC 方法都先检查本地教师令牌；档案读取限制在绑定岛，业务成功与拒绝写入独立 SQLite 审计，并关联 request_id、task_id、context_id。
- 完整测试：70 passed，1 个第三方 TestClient 弃用警告。另曾用真实 127.0.0.1 TCP 端口验证 Card 200、无令牌 401、带令牌返回完成 Task；测试进程和模拟冒烟数据已清理。

## 尚不能宣称完成

- 生产教师/监护人身份核验、真实监护同意、跨岛 Agent 委托、OIDC/JWKS、PostgreSQL、持久 Task ACL、学生 Agent、青少年模式执行及公网 A2A 均未实现。
- 本地 Task Store 在内存中，重启丢失。仅业务层接纳的请求进入 a2a_read_events；协议层拒绝与内部异常尚未统一审计。成果卡片最多返回 20 条，仅提示 has_more，尚无分页。
- 学生登记和自动创建的演示展示许可目前分两次事务执行；若第二步异常，学生记录可能已创建。此切片仅用模拟数据。真实数据接入前需将授权决定、登记、展示许可及审计纳入一致事务或可靠恢复流程。
- 默认监护授权只适用于模拟资料。真实未成年人的资料、答卷和公开成果上线前，需由正式身份网关记录主动确认与可撤回的用途许可；不要求国家身份认证系统，但不能把系统默认标记当成家长实际同意。

复核依据：[本地原型验收](local-a2a-read-prototype.md)、[身份网关设计](identity-gateway-v0.1.md)、测试 test_local_a2a.py 和 test_local_assumed_consent.py。
