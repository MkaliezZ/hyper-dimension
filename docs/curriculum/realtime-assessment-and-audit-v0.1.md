# 实时命题、自动评测与审计契约 v0.1

状态：产品决策已明确；本文件是目标契约。本地已实现 SQLite 版 `AssessmentService` 与 DeepSeek Agent 适配器，用模拟数据验证题包、提交、评分、自动批准、报告和审计；**PostgreSQL、受保护 API、异步 worker 与真实学生生产流程仍未实现**。适用教师版英语读写；听力/口语需先建立媒体和评分质量门。对外“分数”和“能力层级”均是本项目教学诊断，不等同中考或剑桥成绩。

## 1. 已确定的产品前提

- 本地模拟数据可使用明确标记为未核验的默认监护授权，以跑通教师版 MVP；它不代表真实监护人已经同意。接入真实学生前，开户/入班流程须保存可核验的 guardian_consent 记录：监护关系、同意主体、范围、告知版本、时间、来源、有效/撤回状态。日常测评在有效授权范围内无需重复询问。服务端从记录判断是否允许处理，不靠客户端的 `consent_ref` 或“位于中国”推定同意；范围变化或撤回后立即按新状态执行。
- 教师在开班或启用某次测评时通过教师 Agent 确认 **assessment_policy 版本**；教师 Agent 发起授权请求，服务端核实教师身份后才写入策略：适用班级/单元、能力节点、评分维度与权重、可自动发布的题型、最低证据与质量条件、异常处理、报告可见范围和有效期。教师授权此策略后，常规作答由 Agent 自动评分、审核、出报告及归档；不逐次等待教师点批准。
- 有效的自动批准必须能够追溯 `teacher_id + policy_id/version + agent_id/model_version + decision_rule_version`。规则检查失败、证据不足或评分冲突时进入 `needs_review`，而不是让模型猜测批准。教师可覆核、修订或撤回已自动发布的结论。

上述同意实现须满足中国关于不满14周岁个人信息及自动化决策的要求；上线前核实具体产品告知和影响评估。依据：[个人信息保护法第24、31、55条](https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm)、[未成年人网络保护条例第32、34、36条](https://www.cac.gov.cn/2023-10/24/c_1699806932316206.htm)。自动化结果若对个人权益有重大影响，需提供说明与请求非纯自动决定的渠道；常规形成性测评与重大分班/升学决定的发布规则应分开。

## 2. 一次学生任务的运行链

1. **读取可信画像**：从服务端取年龄、实际年级、学制、教材版本与已教页/单元、教师班级目标、历史题目版本、近期作答、各能力节点证据及有效授权。学生/客户端可提出更正，但不直接覆盖可信画像。年龄与年级是选题条件，不能直接当“真实英语能力”。
2. **计算蓝图**：规则服务确定前置/当前/邻近挑战能力点、题量、难度范围、练过与未练情境、作答时间、题型配比与策略版本。首次无历史证据时给暂定起点，后续按实际作答更新 mastery_vector；未知能力标记 insufficient_evidence。
3. **实时调用教师 Agent + english-assessment Skill**：生成原创学生题、**同时生成独立的答案键、逐题证据、干扰项理由、写作分析量规**，形成不可变的 `item_bundle_id/version`。结构、答案唯一性、权重总和、版权、适龄、教材依据与教师预授权策略通过质量门后才发布。答案键只留服务端；学生只收到学生题。在线生成超时或质量门失败时，可在同一蓝图下使用已批准的缓存题包；不得返回未验证题目。
4. **提交并落库**：学生提交携带 `assignment_id + attempt_id + idempotency_key`。API 在一个数据库事务中保存原始作答、提交事件和待评分作业，然后提交事务；提交成功才返回 `audit_event_id`。重复请求返回第一次结果，不重新创建作答。
5. **评分**：客观题用答案键确定性判分；写作用量规按维度给分，Agent 引用学生原句和题目证据并报告不确定性。归一化维度分 `p_i∈[0,100]`，教师策略固定权重 `w_i≥0` 且 `Σw_i>0`，`score=Σ(w_i×p_i)/Σw_i`。保存每维原分、归一分、权重版本、模型版本和合成分。模型不得在批改时自行改权重。动态出题的不同卷型不能只凭原始总分直接横比能力；报告还要看共同能力节点、多次证据、难度与提示强度。
6. **自动批准与报告**：质量门检验题目已发布、授权有效、作答完整、评分可解释、置信阈值和策略范围。通过则由服务端以 `decision_mode=auto_under_teacher_policy` 写入批准决定；Agent 生成分项诊断、错题记录、针对性计划与报告新版本，归档全部引用，并按权限向本人/监护人展示。未通过则记录原因并进入 `needs_review`，报告不对外发布。
7. **进度对齐**：每次已批准的新证据更新个人能力快照；按教师确认的共同里程碑生成可解释的每周班级对齐建议。教师确认或覆盖后形成不同支撑程度的任务与四周个人计划；缺证者补测，不按不同卷型原始总分排队。[动态进度对齐契约](dynamic-progress-alignment-v0.1.md)是首期教师版范围，当前尚未实现。
8. **后续**：新情境复测相同能力点；教师可查看抽样质量、异常队列，发起人工复核或修改策略。重评分生成新版本，不覆盖旧答案、旧报告或旧审计事件。

## 3. “去重”具体防什么

| 场景 | 唯一身份 | 重试时返回什么 |
| --- | --- | --- |
| 学生点两次提交、断网重传 | `tenant_id + student_id + assignment_id + attempt_id`，及请求幂等键 | 同一 `response_id`、接收状态和提交事件 ID；**不**生成第二份答卷 |
| API 已落库但客户端未收到回执 | 相同请求幂等键 + 请求内容摘要 | 已提交的原结果；摘要不同则报幂等键冲突 |
| 评分 worker 重试或模型超时 | `attempt_id + scorer_version + grade_run_id` | `grade_run_id` 在任务入库时生成，worker 重试沿用同一 ID 并返回同一结果；显式重评使用新的 `regrade_id` |
| 报告通知重发 | `report_version + recipient + channel` | 已投递状态；不重复提醒 |
| 正常补测或重做 | **新的** `attempt_id` | 建新作答；即使文字答案相同也不去重 |

数据库用唯一约束保证这些不变量，不能仅靠 Agent“记住已经处理过”。

## 4. 审计事件怎样证明已写入

最小表：`assessment_sessions`、`item_bundles`、`attempts`、`grade_runs`、`approval_decisions`、`report_revisions`、`guardian_consents`、`teacher_policies`、`audit_events`、`outbox_events`。每表含租户/班级归属及必要版本。

`audit_events` 的字段至少为：`event_id` 主键、`tenant_id`、`student_ref`、`session_id`、`attempt_id`、`event_type`、`actor_type/id`、`teacher_policy_ref`、`agent_version`、`input_ref`、`output_ref`、`occurred_at`、`correlation_id`。事件正文与学生作答分表保存，审计只放受控引用和必要摘要。

处理提交时在**同一 PostgreSQL 事务**写 `attempts`、`audit_events` 和 `outbox_events`，取得数据库生成的 `event_id`，事务成功提交后才回响应。字段 `audit_event_id` 本身只是引用；只有持久表确实存在该 ID 且事务已提交，才代表已落库。异步 worker 从 outbox 取任务；评分、批准、报告每次状态变更也各自在一个事务中写业务记录、审计事件和 outbox 消息。这样服务重启或消息重投也可恢复。技术 tracing 与业务审计分开。

事件是已发生事实，例如 `attempt.submitted`、`grade.completed`、`approval.auto_approved`、`report.published`、`report.retracted`；不要把尚未执行的命令当成成功事件。示例：

```json
{
  "event_id": "evt_01JDEMO001",
  "event_type": "attempt.submitted",
  "tenant_id": "tenant_demo",
  "student_ref": "student_demo_01",
  "attempt_id": "attempt_demo_01",
  "actor_type": "student",
  "actor_id": "student_demo_01",
  "teacher_policy_ref": "policy_demo:v1",
  "input_ref": "answer_blob_demo_01",
  "occurred_at": "2026-09-26T08:00:00Z",
  "correlation_id": "corr_demo_01"
}
```

这个对象必须对应 `audit_events` 的真实记录；API 回应 `audit_event_id=evt_01JDEMO001` 供查询。作答正文留在受控作答表/对象存储；审计事件只保留引用、行为主体、版本和时间。

## 5. 实现顺序与验收

先定义 `teacher_policy`、`item_bundle`、`attempt`、`grade_result`、`report_revision` 的 JSON Schema/Pydantic 模型和数据库迁移，再实现受控内部 API 与 Skill 调用器。现有 `hd-education-request/result` 是未来网页/学生 Agent 的外部封套，不直接充当题目与评分表；教师 Agent 内部工具不必都暴露为 A2A 操作。外部封套可返回 status=completed 和 report_ref；auto_approved 是内部审批状态。

最小验收用模拟学生：同一画像能创建可追溯题包；题目与答案同步落库但学生只见题；两次相同提交只生成一份作答；自动评分可复算权重；满足教师授权策略则自动批准并发布报告；质量门失败则入异常队列；每一步能按 `audit_event_id` 查到已提交数据库事件；人工重评保留原版本。
