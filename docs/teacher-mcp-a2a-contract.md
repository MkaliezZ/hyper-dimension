# 教师 MCP、学生身份与 A2A 业务契约（本地切片）

## 职责与当前状态

业务服务是学生档案、题包、作答、审批、报告、归档、展示许可和审计的唯一执行者。网页、MCP 与未来 A2A 都调用它。

MCP 是教师 Agent 的受控工具入口。明确的工具名、参数类型和结构化结果会减少格式错误，但不能保证 Agent 总选对工具；服务端仍需核验身份、权限、状态和幂等。A2A 用于未来学生 Agent 与教师 Agent 之间的任务通信，其 JSON DataPart 承载版本化 Hyper Dimension 业务命令；A2A Task 历史不替代业务审计。英语测评 Skill 继续说明教材证据、出题和量规方法，不承担授权和数据库写入。

现有代码实现本地 stdio MCP 工具、严格业务命令 Schema、A2A DataPart 校验、本地受保护 HTTP 切片。尚无公开 A2A Agent Card 或端点，也没有生产身份网关。默认 hyper_dimension.api:app 仍只开放 /healthz。本地 HTTP 工厂仅以模拟数据验收，不接真实学生。

## 稳定学生引用与答题核验

教师首次登记时由服务端生成 stu_ 加 UUID4 十六进制的内部 student_id；协议 student_ref 使用这个租户内不含姓名的引用。私有档案目录按租户哈希和 student_id 建立，不按姓名命名，因此改名和同名不会混档。

学生每次进入教师版答题页时输入教师发放的随机访问码并签写姓名。访问码校验哈希后认证，姓名只核对是否拿错卡；二者都不是对外的稳定学生 ID。访问码可轮换，不放进 A2A DataPart、URL、公开卡片或日志。正式产品仍需补教师、学生、监护人账号和授权证明。

作答提交使用 bundle_ref、attempt_ref 和 idempotency_key。重复请求返回同一结果；改动内容后复用键会被拒绝。出题也使用幂等键。报告获准后，本地 API 保存完整私有快照：题目、答案、量规、作答、评分、批准策略与报告。数据库保留不可变版本、SHA-256 摘要和审计事件；学生文件夹是可核验导出，被篡改会校验失败。

## 教师 MCP 工具

| 工具 | 行为 |
| --- | --- |
| student_profile_read / student_profile_update | 读取档案；以 expected_version 更新私有字段和档案版本 |
| assessment_assignment_create | 按教师预授权策略和幂等键生成题包 |
| assessment_report_read | 读取本岛已批准报告 |
| student_archive_list / student_archive_verify | 列出归档摘要和核验文件 |
| student_error_history_read | 读取错题引用 |
| showcase_draft_create | 按公开许可和证据制作私有草稿，不发布 |
| showcase_public_read | 读取仍有许可的公开卡片 |

MCP 不提供登记公开许可、正式发布、撤回许可工具。Agent 可以备草稿，发布由教师受保护 API 执行。租户与教师来自本地可信进程绑定，工具参数不能自称其他身份；该进程配置不等于生产登录。

## 成果展示状态约束

草稿只能在已记录独立公开许可、归档证据存在且证据类型匹配时创建。进步分数须同时引用前后两份测评归档，公开数值与两份报告的实际分数逐项匹配；荣誉证据可为测评或注明教师和来源的观察记录。正式发布时再核对基础监护许可与独立公开许可，许可至少覆盖化名；展示数值还须覆盖 score。公开结果只返回化名、标题、摘要、允许的分数和小岛板块；不返回学生内部 ID、真实姓名、备注、作答和原件路径。撤回许可后公开读取立即消失。板块值为 learning、portfolio、honors，前端将按该字段摆放卡片。

当前本地原型只能记录模拟监护授权证据引用，不能核验签署人真实身份。真实学生上线前必须完成监护人身份、授权范围、撤回和教师权限流程。

## A2A 可复用命令

新的统一[教育 A2A 业务语义 Profile v1](a2a-education-profile-v1.md)规定封套 1.2 的十一项操作、每项严格 payload、角色矩阵、幂等与引用归属、结果原因码及 A2A Task 状态映射。机器可读[命令 Schema](../src/hyper_dimension/schemas/hd-education-command-v1.2.schema.json)与[结果 Schema](../src/hyper_dimension/schemas/hd-education-result-v1.2.schema.json)由同一代码定义导出，并有正反例一致性测试。

早期 1.0 评测请求和 1.1 档案命令是本地草案。新 A2A 接入只接 1.2，不按自然语言推断操作，也不把旧 payload_refs 自动改写为新 payload。学生 Agent 的五项学习操作目前只有契约，没有真实 A2A 服务；教师 MCP 仍使用同一业务服务，并在授权逻辑完善后绑定到对应操作语义。任何通过 Schema 的命令仍须由服务端认证主体、核查角色、同意、学生关系、记录归属、版本和幂等。

## 本地运行与后续开发

安装 python -m pip install -e ".[dev,mcp]"。将 HD_LOCAL_DB、HD_LOCAL_ARCHIVE 指向仓库外目录，并设置本地会话的 HD_TENANT_ID 和 HD_TEACHER_ID；运行 python scripts/run_teacher_mcp.py 启动 stdio 工具。调用出题时才需从当前进程提供 DEEPSEEK_API_KEY。配置、密钥和档案不得提交 Git。若要运行本地 HTTP 验收入口，再设 HD_TEACHER_TOKEN 为至少 24 字符的随机值，并运行 python scripts/run_local_education_api.py；它只监听 127.0.0.1，默认端口 8765。

后续依次实现生产教师/监护人身份网关、PostgreSQL 迁移、2D 教师编辑页与学生答题页，然后接真正的 A2A Agent Card、端点及跨 Agent 兼容测试。MCP 与 A2A 复用同一业务服务与版本语义。

参考：[MCP 官方 Python SDK](https://github.com/modelcontextprotocol/python-sdk)、[A2A v1 规范](https://a2a-protocol.org/v1.0.0/specification/)。
