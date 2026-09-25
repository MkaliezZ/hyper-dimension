# 教师开岛与后端 MCP 默认接入 v0.1

状态：本地可执行配置契约和 stdio 原型；已实现独立 Agent 工作负载令牌与实时委托检查的 Streamable HTTP MCP 认证切片，并通过真实 MCP HTTP 请求测试。云端开岛、正式身份网关数据库及自动激活尚未实现。Hermes Agent 是候选运行时，教师 Agent 可替换。

## 职责边界

教师 Agent 保留对话、任务编排、教材证据理解、原创出题、写作量规评分、报告与教学建议起草等通用 Agent 能力。教师可选择 Agent 运行时及模型供应商；模型调用归属于该教师的 Agent 用量。Hyper Dimension MCP 与同一后端服务负责租户/教师/学生权限、教材版本及权利检索、题包结构校验、客观题确定性判分、教师策略、提交去重、审批门槛、档案归档、审计、进度对齐与受控公开；其中共享教材检索与完整工作台仍待实现。MCP 工具不是数据库直连，也不能以提示词代替后端校验。

当前可执行 MCP 工具的准确清单由 teacher_mcp.py 给出；模型不在 MCP 后端运行。原有 AssessmentService.create_assignment 和 DeepSeek 适配器仅留给旧本地合成数据回归；当前教师 MCP 不暴露该路径。本地学生 API 可采用 agent_native=True：提交先持久化为 submitted，由教师 Agent 经 MCP 读取待批改作答、提交评分和报告草稿，后端再按教师预授权策略批准或进入复核，并归档已批准报告。

## 开岛自动绑定目标流程

1. 创建岛屿、确认教师身份与租户关系，生成独立的 Agent 身份与限额；选择可托管且能调用 MCP 的运行时。Hermes 先作为候选，不能把它写死为唯一实现。
2. 在开岛事务中生成 hd.teacher-agent-binding.v1 必需绑定：岛屿 ID、教师 ID、HTTPS MCP 端点、所需工具清单及凭据环境变量名。当前 prepare_teacher_binding 能生成不含密钥的待激活清单；未实现生产岛屿事务。
3. 生产网关签发短时、限定岛屿/教师/工具的凭据，远程 MCP 每次请求验证身份、委托、同意、策略和配额。凭据保存在运行时密钥服务，不写 Git、岛屿配置或日志。
4. 开岛服务通过真实 MCP list_tools 探测必需工具，做授权/拒绝/跨岛测试，成功后才将绑定状态标为 active 并启动教师 Agent。失败则岛屿保持待激活，不能向教师宣称 Agent 已可用。
5. 教师更换 Agent 运行时或模型时保留同一业务 MCP 契约。撤销教师身份、监护许可、岛屿委托或 Agent 凭据后，网关立即拒绝后续调用；业务审计保留历史引用。

第 3—5 步仍是待开发门槛：当前 create_teacher_remote_mcp 只提供已签名短时 Agent 凭据、专用 audience/scope、岛屿/教师/Agent 委托匹配和每次 HTTP 请求关系检查的可执行入口；测试源为内存模拟，尚无正式凭据签发、持久委托关系和开岛事务。当前 Hermes 配置生成器因此输出 enabled: false，不会声称已经连到云端。正式激活必须由身份网关和连接探测完成，不能靠手动把布尔值改为 true 就视作已授权。Hermes 文档确认支持远程 HTTP MCP、环境变量引用、工具白名单；此处只采用其配置格式，未完成 Hermes 进程联调。

## MCP 能力按开发顺序

| 能力 | 教师 Agent 做什么 | 后端 MCP 与服务做什么 | 状态 |
| --- | --- | --- | --- |
| 学生档案和测评 | 理解档案、设计原创题与写作反馈 | 读取可信档案/策略；验证题包、客观题评分、审批、归档、错题审计 | 本地 stdio 已实现，模拟数据测试通过 |
| 共享教材 | 提出检索意图、理解证据与设计任务 | 按权利、版次、章节、页码返回来源引用；教师 API 确认班级版本 | 本地 SQLite 元数据、章节版本、权利门槛、班级绑定及四项 MCP 读取已实现；本地教师进程通过 HD_TEXTBOOK_CATALOG_DB 指向同一私有目录；真实教材权利、PostgreSQL/OCR/全文/向量检索未实现 |
| 动态进度对齐 | 解读证据、起草每人练习与四周计划 | 读取班级里程碑/个人能力证据，确定性计算建议与版本，教师确认后派发及归档 | 本地 SQLite 里程碑、报告维度证据、四类建议、计划草稿及教师确认 API 已实现；生产能力快照与页面未实现 |
| 工作台与小岛公开 | 整理资料和展示草稿 | 保存来源、许可、版本、发布决定、撤回及审计 | 私有展示草稿 MCP 已实现；生产工作台未实现 |
| 学生 Agent / A2A | 由学生自己的 Agent 表达请求 | A2A 网关验证业务命令，复用同一服务并保留任务与审计引用 | 语义契约和两项本机只读原型；生产接入未实现 |

当前本地 MCP 已包含 class_milestone_read、alignment_evidence_propose、student_capability_evidence_read、class_alignment_preview、student_plan_draft_submit。后端使用教师确认的里程碑和证据标签，在同能力节点、构念、评分维度及难度下，按教师确认的阈值与规则版本计算不可变建议；Agent 只能提议证据标签和起草计划。该规则是样板，不代表已校准的英语能力测量；生产版仍需能力快照、证据时效和质量核验。教师确认/覆盖共同目标和分组、正式发布成果仍走受保护的教师界面/API；Agent 不能自行把建议变成批准状态。

## 验收门槛

本地已覆盖：MCP 工具名与配置清单一致；Agent 出题和评分草稿经过服务端校验；重复题包请求不复制记录；改内容复用幂等键被拒；MCQ 答案键不进入批改上下文；报告经后端评分批准后归档；无平台模型仍可完成路径。四名模拟学生的前置支撑、核心练习、迁移挑战和待补证，以及同分但提示强度不同、不同构念不混比、教师确认与不可变运行已有本地测试。已用 SDK 的 Streamable HTTP initialize 与 tools/list 请求验收认证放行和委托撤销拒绝。真实远程服务部署、Hermes 实机、云端开岛自动激活、生产能力快照、真实跨岛安全和教学效度属于后续验收。

参考：[Hermes MCP 功能](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/mcp.md)、[Hermes MCP 配置](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/mcp-config-reference.md)、[MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)。
