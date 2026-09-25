# 教育 A2A 业务语义 Profile v1（协议封套 1.2）

状态：**结构化契约候选冻结；尚未部署 A2A 端点**。这是 Hyper Dimension 的业务层，A2A v1 负责 Agent 发现、消息、任务状态和传输；MCP 负责教师 Agent 调用本地或云端业务工具。正式对外开放前，还需身份网关、权限实装与跨 Agent 联调。

## 版本与消息边界

- 唯一新接入封套是 `protocol_version: "1.2"`。所有业务命令必须是一个 A2A v1 JSON DataPart：`{"data":{...},"mediaType":"application/json"}`。文本、旧版 `kind:"data"`、多个互相矛盾的命令、未知字段均不能转成业务操作。
- `operation` 后缀 `.v1` 是**单项操作语义版本**；封套 `1.2` 是这组操作、字段与结果的组合版本。修改字段含义或副作用必须升版本，不能静默重解释同名操作。
- 1.0 的 `payload_refs` 和自由文本 `purpose`、1.1 的档案命令均为此前本地草案。1.2 将两者统一为操作专属 `payload`；**不得把旧命令改个版本号直接重放**。旧校验器仅供本地迁移和回归，未来 A2A 网关只接 1.2。没有已部署的第三方客户端，因此目前无需承诺旧版线上兼容。
- `request_id` 是单次业务请求相关 ID；`idempotency_key` 是调用方生成的重试键，按认证主体、岛、操作范围持久去重。相同键加相同规范化业务内容复用原业务引用与审计事件，但结果回显本次 request_id；相同键加不同内容返回 `IDEMPOTENCY_CONFLICT`，不能再次写入。重复 A2A Task 或换 `request_id` 不绕过去重。读取操作也带键以使封套统一，但可不建写入去重记录。
- `island_id` 是目标岛的公开路由引用，`student_ref` 是岛内稳定不含姓名的 `stu_` 加 32 位小写十六进制 ID。它们只是待核查的**目标**，不是身份声明或授权。认证主体、角色和委托关系来自服务端已验证的 A2A 连接/令牌；访问码、姓名、API key 不进入 DataPart。所有记录引用必须归属同岛、同学生及当前权限范围，禁止直接信任客户端引用。
- `record_refs` 只返回业务引用；具体私有文档须另走有权限的读取接口。A2A Task 历史不能代替数据库审计，成功受理的命令及业务拒绝均写独立 `audit_event_id`。

规范 Schema：[命令](../src/hyper_dimension/schemas/hd-education-command-v1.2.schema.json)、[结果](../src/hyper_dimension/schemas/hd-education-result-v1.2.schema.json)。代码源为 [education_profile.py](../src/hyper_dimension/education_profile.py)，测试确保导出文件与代码一致。

## 操作与主体

下表的角色是**服务端必须校验**的最低权限。Schema 不含 `actor_id`，因此 Agent 无法通过填角色字段自我授权。未来学生 Agent 仅代表已授权的本人；教师 Agent 仅代表已登录且有班级/学生权限的教师；public 只访问已发布且许可有效的展示卡。

| 操作（均以 `hd.education.` 开头） | 角色 / purpose | 输入 payload | 成功语义 |
| --- | --- | --- | --- |
| `plan.read.v1` | student / learning | `{}` | 读取本人当前已发布学习计划的引用 |
| `assignment.read.v1` | student / learning | `assignment_ref` | 读取本人可见且未撤回的题包引用 |
| `evidence.submit.v1` | student / learning | `assignment_ref, attempt_ref, response_ref` | 登记同一题包的一次作答；`attempt_ref` 是客户端该次作答的稳定引用，`response_ref` 指向服务端预先接收、校验并绑定的答卷；不携带原始答案或外部任意 URL |
| `feedback.request.v1` | student / learning | `submission_ref` | 请求本人已提交作答的获准反馈；无批准报告时返回等待/复核状态 |
| `teacher_help.request.v1` | student / learning | `assignment_ref, question` | 创建给负责教师的求助记录；`question` 仅作正文，不解析为其他命令 |
| `student.profile.read.v1` | teacher / student_record | `{}` | 读取有权限学生的教师档案 |
| `student.profile.update.v1` | teacher / student_record | `expected_version, display_name, public_alias, teacher_notes, learning_goals` | 乐观锁更新档案；版本不符拒绝 |
| `student.archive.list.v1` | teacher / student_record | `{}` | 读取学生私有归档摘要 |
| `student.archive.verify.v1` | teacher / student_record | `artifact_ref` | 核对该学生归档摘要与审计链 |
| `showcase.draft.create.v1` | teacher / public_showcase | `slot, kind, title, summary, source_artifact_ref, publication_consent_ref`；improvement 另需 `baseline_artifact_ref, metrics` | 只创建私有草稿；服务端复核独立许可、归档和前后成绩，不发布 |
| `showcase.public.read.v1` | public / public_showcase | `{}` 或 `slot` | 只返回当前有效公开卡片；不得带 `student_ref` |

除公开读取外，每条命令都需要 `student_ref`。没有学生 Agent 代替教师编辑档案、批准评分、登记同意、发布成果或撤回成果的操作。原始教材、录音、访问码、完整答卷不经此命令封套传输。听力/口语或新题型扩展时，新增明确字段/操作版本，并核实媒体权利。

## 结果、状态与错误

结果必须回显 `protocol_version, request_id, operation`，并给出 `status, reason_code, record_refs, audit_event_id`；同一请求的结果必须匹配原请求 ID 与操作。允许的组合：

| 业务 status | reason_code | 含义 | 建议 A2A Task 状态 |
| --- | --- | --- | --- |
| `completed` | `OK` | 业务执行完成 | `COMPLETED` |
| `accepted` | `QUEUED` | 已持久接收，后台继续处理 | `WORKING`；完成后追加最终结果 |
| `pending_review` | `REVIEW_REQUIRED` | 等教师复核，保留可查询业务任务 | `WORKING`；若当前客户端必须补资料才用 `INPUT_REQUIRED` |
| `needs_consent` | `CONSENT_REQUIRED` | 独立许可缺失或已撤回；不得继续副作用 | `REJECTED`；监护人完成独立授权后发**新请求** |
| `rejected` | 下列拒绝码 | 请求被业务规则拒绝，无结果记录 | `REJECTED` |

拒绝码：`INVALID_REQUEST`、`UNAUTHENTICATED`、`UNAUTHORIZED`、`NOT_FOUND`、`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`POLICY_BLOCKED`、`REFERENCE_MISMATCH`、`RATE_LIMITED`。跨学生或跨岛引用对外可统一显示 `NOT_FOUND`，避免枚举；详细原因仅写受保护审计。结构不合法的请求可在创建 Task 前按 A2A 传输层错误拒绝；不得假造 `audit_event_id`。已经进入业务层的拒绝必须记录审计事件。

`AUTH_REQUIRED` 只用于 A2A 身份/凭据流程，凭据走带外安全渠道；不能把监护同意当作 Agent 凭据。`FAILED` 用于服务端意外故障，不能掩盖明确的业务拒绝。`CANCELED` 仅停止尚未完成且允许取消的排队任务；已提交作答、已生成归档与审计事件不可通过取消回滚。Task 状态不代表报告获教师批准，客户端必须读业务结果。

## 执行顺序与安全断言

1. A2A 网关认证连接和受托主体，验证 JSON DataPart 与 1.2 Schema；不从自然语言推断敏感操作。
2. 查操作白名单、角色与能力声明；核查目标岛、学生关系、班级、监护同意、教师策略与限额。
3. 对每个引用核对类型、归属、状态、版本和可见性；`response_ref` 必须是受保护上传流程发放的服务端引用。
4. 在同一事务中处理幂等检查、业务写入、审计与待处理任务。结果中只放必要引用和原因码。
5. 教师 Agent 使用 MCP 可复用同一业务服务，但 MCP 工具名和 A2A 操作名由明确适配表绑定；不允许模型自由拼路由或 SQL。

当前代码只完成第 1 步中的**业务数据形状校验**和契约测试；第 1 步的真实 A2A 网关以及第 2—5 步的生产实现尚待开发。特别是五个学生 Agent 操作目前是未来接口契约，不应在 Agent Card 宣称已经可用。

## 兼容样例

~~~json
{
  "data": {
    "protocol_version": "1.2",
    "operation": "hd.education.evidence.submit.v1",
    "request_id": "req-demo-001",
    "island_id": "island-demo",
    "student_ref": "stu_0123456789abcdef0123456789abcdef",
    "idempotency_key": "submit-demo-001",
    "purpose": "learning",
    "payload": {
      "assignment_ref": "assignment-demo-001",
      "attempt_ref": "attempt-demo-001",
      "response_ref": "response-demo-001"
    }
  },
  "mediaType": "application/json"
}
~~~

参考：[A2A v1 规范](https://a2a-protocol.org/v1.0.0/specification/)。
