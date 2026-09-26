# Hyper Dimension 身份网关与 Agent 委托设计 v0.1

状态：**架构设计，尚未实现生产身份网关**。首期教师版的 SQLite、学生访问码和本地 Bearer 令牌只用于模拟数据。本文规定将来处理真实学生、公开 A2A 和多岛互通之前的身份与授权验收条件。

## 1. 目标与边界

四类主体：教师、学生、监护人、Agent。Agent 另分岛主/教师 Agent、未来学生 Agent 和外部访客 Agent；ESP32-S3 是设备主体，不能冒充任何人。身份网关要回答四个不同问题：

1. **是谁**：身份提供方签发且网关核验的登录主体或 Agent 工作负载。
2. **代表谁**：Agent 的委托人、委托范围、目标岛和到期时间；不由 A2A DataPart 自称。
3. **能做什么**：操作角色、岛/班/学生关系、监护同意、教师预授权策略、展示许可、记录状态和额度的实时交集。
4. **做了什么**：访问决定、具体业务变更、A2A Task 与审计事件的可追溯关联。

同一人可跨岛任教；学生可换班而 `student_id` 不变；姓名只用于人工核对，不能作主键或认证。客户端传来的 `island_id`、`student_ref`、`consent_ref` 都是待核查目标引用，不是可信身份声明。

## 2. 组件与职责

| 组件 | 首选方案 | 职责 |
| --- | --- | --- |
| 人类登录与 Agent 工作负载凭据 | [Keycloak](https://www.keycloak.org/docs/latest/server_admin/) 单 Realm + OIDC/OAuth2；也可替换为符合相同接口的 IdP | 教师和监护人登录、MFA、会话、OIDC discovery/JWKS；Agent 使用独立 client/service identity。不要为每座岛建 Realm |
| Hyper Dimension 身份网关 | FastAPI + PostgreSQL | 校验访问令牌、映射内部主体、维护岛/班/学生/监护关系、签发短期受限委托或接收 IdP token exchange、做服务端授权决定 |
| 关系与同意数据 | PostgreSQL 事务表 | 教师任教、监护关系、Agent 委托、学生档案、评测许可、成果公开许可及撤回；这些关系不能只放进长寿命 JWT |
| A2A 入口 | 官方 [A2A Python SDK](https://github.com/a2aproject/a2a-python) + 网关 | Agent Card、JSON-RPC/Task；每个 Send/Get/List/Cancel/Subscribe/通知配置请求都认证并按 Task 归属授权 |
| 教师 Agent 工具 | MCP 适配器 | 从已验证的服务端上下文取教师/岛/权限；工具参数只含业务目标，绝不让 Agent 自填 actor_id |
| 复杂关系扩展 | [OpenFGA](https://openfga.dev/docs/interacting/relationship-queries)（按规模触发） | 若跨岛/多教师授权复杂度超出可维护 SQL，再同步关系元组用于 Check；监护同意、发布状态和审计仍以事务数据库为准 |

**网关是安全边界**：页面、MCP、A2A 和设备都经过同一授权决策服务。反向代理做 TLS、流量限制和初步令牌校验；业务服务再次验证身份与每一条引用，不将代理头部或模型文本视为授权。

## 3. 登录与委托流程

### 教师

教师通过 Authorization Code + PKCE 登录网页；正式教师角色要经运营/机构审核，不能仅靠邮箱注册获得。教学管理写入教师—岛—班关系，按班关联学生。敏感审批/成果发布需要新鲜登录或二次确认；MCP 只获得当前教师已授予的工具能力。教师换班、停用或离职立即收回关系，后续请求读取最新关系版本。

### 监护人

生产阶段由监护人主动确认与学生的关系和具体用途；无需依赖国家身份认证系统，可使用平台账户、联系方式验证及必要的人工核对。关系证据由受保护服务保存：来源、审核人/机构、核验方式、有效期、撤回状态与证据摘要。教师转述或系统默认只能记录为“未核验假设”，不能写成已收到监护人主动确认。同意按用途分别记录：学习评测/模型处理、音视频采集、成绩或荣誉公开；记录具体信息范围、接收方、文本版本和时间。公开展示另需独立、可撤回许可。平台计划覆盖 6—15 岁，因此产品策略对全部学生要求监护授权；其中不满十四周岁的个人信息按中国《个人信息保护法》具有更严格要求，必须有监护人同意和专门处理规则。[法律原文](https://www.npc.gov.cn/WZWSREL25wYy9jMi9jMzA4MzQvMjAyMTA4L3QyMDIxMDgyMF8zMTMwODguaHRtbD9yZWY9aW1i)

### 首期 MVP 的默认授权口径

本地**模拟数据**模式下，教师登记学生可以不填写监护信息：系统自动赋予 `demo-assumed-guardian-full-v1`，覆盖学习评测和成果展示的演示流程，并在 API 响应中标记 `consent_assurance=unverified_demo_default`。这是测试夹具，不是监护人身份或法律同意的证明；教师仍要主动选择证据、创建草稿并发布。用户填入监护引用时，当前本地 API 也只能标记 `unverified_supplied_reference`，不能据此声称已核验。

当前可替换入口是 guardian_authorization.GuardianAuthorizationProvider.resolve_enrollment，由本地教师 API 调用；默认实现只返回上述演示决定。接入正式网关时需由受保护会话查出已核验主体与用途许可，再返回决定，而不是让 Agent 在请求体自行声明已核验。演示默认产生的学习处理和成果展示许可不等于直接公开：资料仍需教师创建草稿和发布，撤回后公开读取即时失效。

正式接入真实学生时不要求国家级身份接口，但至少要让监护人通过受保护渠道主动确认具体用途，保存同意文本版本、时间、主体、关系声明和可撤回记录；对公开成绩/荣誉仍做独立确认。试点可以先停留在匿名或模拟资料，等这条链路实现并审查后再开放真实资料。这样能满足“先快速跑通教师 MVP”，也不会把系统默认值伪装成监护人真实行为。

### 学生

首期由教师组织学生在受保护网页完成任务；现有“随机访问码 + 签写姓名”只作本地模拟和误归档防护，正式处理真实学生前须由网关绑定可追溯的学生账户或一次性受保护答题会话。学生 Agent 是后续能力，须先绑定学生账户及有效监护授权，只能取得本人限定权限；不可使用教师的令牌，也不能用姓名/访问码换取 A2A 身份。

### Agent 与跨岛 A2A

每个云端 Agent 实例有独立 `agent_id`、受管工作负载凭据、所属岛和生命周期。岛主 Agent 代表岛主时，服务端登记 `agent_delegation`：委托人、Agent、目标岛、允许操作、数据范围、到期和撤回版本。访客 Agent 到另一个岛时，网关核验**Agent 工作负载身份 + 其委托人 + 目标岛准入**，签发或交换短期、单 audience、最小 scope 的调用凭据。访问凭据放 HTTPS Authorization 头，A2A JSON DataPart 只放 1.2 业务命令。不能从 Agent Card 的技能声明直接推断用户已经授权。[A2A v1 安全规范](https://a2a-protocol.org/v1.0.0/specification/)

ESP32-S3 经设备配对流程绑定到岛/教师，使用设备专属凭据上报 capture_id 和媒体上传引用；设备没有读取完整学生档案、签署同意或发布展示的权限。设备丢失可单独吊销，不影响教师登录。

## 4. 令牌与授权决定

API 必须核验 `iss`、签名与 `kid`、`aud`、`exp/nbf/iat`、客户端身份和允许的算法；拒绝无匹配 audience、过期、撤销和算法降级。人的访问令牌与 Agent 工作负载/委托令牌分开。建议短时效访问令牌，长期刷新令牌只由受控 IdP/服务端保管。令牌中使用不含姓名的 `sub`、`agent_id`、`tenant_id`、`scope`、`jti`、`delegation_id`；不放学生姓名、题目、分数和监护证据。实际签发策略在 IdP 接入测试后固定。

每个请求的服务器决策输入：已核验主体、Agent 委托、操作、目标岛、学生/班关系、用途、同意与发布状态、策略版本、额度和记录归属。规则为**全部条件都成立才允许**；未知关系、缓存失效、授权服务不可用时默认拒绝。敏感写操作在数据库事务中再次校验关系和版本，不能只凭页面上的一次预检。跨岛或跨学生引用可对外统一返回 `NOT_FOUND`，真实拒绝原因写受保护审计。

首期规则示例：

| 操作 | 最低条件 |
| --- | --- |
| 教师读/改学生档案 | 已登录教师 + 当前岛成员 + 授课班/学生分配 + 对应 scope |
| 教师自动出题/批阅 | 上项 + 有效学习处理同意 + 教师预授权策略/限额 |
| 学生读本人任务/交作答 | 已绑定学生或一次性会话 + 同一 student_ref + 任务归属 + 有效同意 |
| 监护人授予/撤回同意 | 监护关系已核验；同意范围与版本明确 |
| 创建展示草稿 | 教师权限 + 有效独立公开许可 + 对应归档证据 |
| 正式发布 | 教师受保护界面二次确认 + 再次核对所有许可与证据；Agent 无直接发布工具 |
| 公开读取成果 | 条目已发布且许可和基础监护关系当前有效；只输出允许字段 |

## 5. A2A Task、MCP 和审计

A2A Task 必须持久保存 `tenant_id, task_id, context_id, creator_principal_id, creator_agent_id, delegation_id, operation, student_ref, status, created_at`。所有 GetTask、ListTasks、Cancel、Subscribe 和推送通知配置操作在查询 Task **之前**检查同一身份与委托边界；随机 Task ID 不能替代授权。任务历史和 Artifact 可能含私有内容，必须与原请求等强度保护。A2A 官方规范明确要求对所有这些操作做范围校验。[A2A v1 规范](https://a2a-protocol.org/v1.0.0/specification/)

MCP stdio 进程可从网关获得短期上下文，不把教师 ID 当工具参数；云端 MCP 必须独立认证并复用授权服务。业务审计事件记录“谁以什么委托访问什么岛/学生、操作与决定、策略和同意版本、A2A task_id、业务引用、时间、关联 ID”。不记录明文令牌、访问码、完整答卷或原始录音。审计写入与业务状态用同一事务或持久 outbox；Task 历史不等于业务审计。真实学生上线前需要访问日志保留策略、导出与删除/留存冲突处理、备份恢复演练。

## 6. 未成年人模式（产品可称“青少年模式”）

该能力先作为**服务端策略接口与数据模型预留**，首期教师版暂不提供学生独立漫游或消费。对已核验的 6—15 岁学生默认采用受保护模式；年龄未知时按更严格的访客权限处理。模式状态不能由学生 Agent 的提示词、A2A payload、前端开关或设备按钮直接提升。监护人可在受保护会话内调整允许时段、内容和功能，但不能越过法律、平台安全底线及教师对教学任务的限定。

| 策略面 | 默认保护边界 | 可控主体 |
| --- | --- | --- |
| 内容与发现 | 只展示年龄适宜、已审核的岛屿和教学内容；公开搜索、外链与推荐有单独限制 | 平台基础策略；监护人可进一步收紧 |
| Agent 互通 | 学生 Agent 默认只能与已绑定教师/监护人及获准教学 Agent 通信；跨岛访客 Agent 联系、主动私聊和文件交换默认关闭 | 监护人明确授权 + 目标岛准入 + 网关实时校验 |
| 时间与时长 | 预留每日总量、可用时段、教学任务例外及跨 Web/小程序/A2A 的统一计量；超限后暂停新互动并保留必要安全通联 | 监护人设置，平台按适用要求提供默认值 |
| 功能与消费 | 发布个人资料、公开成绩、创建新岛、第三方插件、外部链接、支付和打赏默认不可由学生 Agent 自行开启 | 监护人/教师分别按权限审批；支付在首期不开放 |
| 隐私与模型输出 | 公开卡片只用许可字段；模型回复过滤敏感信息与不适龄内容；拒绝通过提问获取其他学生档案 | 服务端内容策略 + 人工复核 |

策略判断顺序：法律及平台底线 → 已核验年龄段 → 当前监护授权与个性化配置 → 教师任务限定 → Agent 委托 → 本次操作。最终取交集；任何一层失败即拒绝。学生变更年龄段时重新计算策略并记录版本。实体预留 `minor_mode_policies`（年龄段、内容/功能/时段规则、版本）与 `minor_mode_assignments`（学生、监护设置、启停与审核时间），审计记录每次高影响放行/拒绝的策略版本。正式上线前需要验证跨端生效、绕过防护、监护人恢复流程和可解释的拒绝提示。

国家网信办《移动互联网未成年人模式建设指南》从时间、内容、功能三个方面提出建设方案；它主要面向移动终端、应用及分发平台，Hyper Dimension 的具体适用与产品细则仍应在上线前由专业合规审查确认。[官方指南](https://www.cac.gov.cn/2024-11/15/c_1733364304749288.htm)、[《未成年人网络保护条例》](https://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1778/202310/t20231025_1087333.html)。

## 7. 最小数据库对象

- `principals`：内部主体 ID、类型、人类 IdP `iss/sub` 或 Agent 工作负载 ID、状态。
- `tenant_memberships`、`teacher_class_assignments`、`student_enrollments`：岛、班、教师和学生的生效/失效版本。
- `guardian_student_links`：关系声明、核验状态（含未核验）、证据摘要、审核来源、有效期、撤回。
- `consent_grants`：用途、范围、文本版本、授予/撤回时间、监护主体、证据引用及 assurance_level；模拟默认不得提升为已核验。
- `agent_instances`、`agent_delegations`：Agent 所属、委托人、允许操作、目标范围、过期和撤回版本。
- `device_bindings`：设备身份、绑定岛、配对/吊销状态。
- `a2a_tasks`、`task_acl`、`auth_audit_events`：可恢复任务、访问范围和独立审计。
- `revocation_versions`：主体/委托/同意版本，用于短期缓存失效与紧急吊销。
- `minor_mode_policies`、`minor_mode_assignments`：年龄分层、监护设置、时段、功能与内容限制及策略版本。

所有对象使用内部不含姓名的 ID；外键和查询均带租户范围。数据库迁移、唯一约束、并发更新和多岛隔离测试需在实现阶段提交。

## 8. 网关 API 契约草案

- `GET /identity/v1/me`：返回当前已核验主体和允许进入的岛，不返回别人的学生数据。
- `POST /identity/v1/guardian-links`、`.../{id}/verify|revoke`：监护关系申请、审核、撤回；教师不可自行 verify。
- `POST /identity/v1/consents`、`.../{id}/revoke`：按用途授予/撤回；签署人及关系由会话决定。
- `POST /identity/v1/agents`、`.../{id}/delegations`、`.../{id}/revoke`：注册 Agent、授予/收回委托。
- `POST /identity/v1/exchange`：已验证的人类/Agent 会话换取短期目标 audience 凭据；服务器交集化 scope 与目标岛，不接受客户端自定权限。
- `GET/PUT /identity/v1/minor-mode`：监护人查看/调整学生保护范围；学生和 Agent 只读自己的生效限制。
- `POST /identity/v1/authorize`：仅内部服务调用；返回 allow/deny、策略版本、原因码与审计关联，不作为公网可枚举学生权限的接口。

接口名是设计草案；正式 OpenAPI、错误码、迁移与 e2e 测试通过后再标稳定。

## 9. 实施顺序与验收门

1. 冻结身份、关系、同意和委托表及迁移；把现有 `student_id` 原样迁入，不用姓名合并。
2. 集成 Keycloak OIDC 登录/JWKS，完成教师登录及角色审核；监护人可用平台账户与主动确认流程，不以前置国家身份接口为条件；写 `/me`、关系声明/复核与撤回。
3. 建 PostgreSQL 授权决策及事务化审计；先覆盖教师档案、学生答题、展示许可/发布；教师/监护人离职或撤回要在下一次请求生效。
4. 建 Agent 注册、受限委托、短期凭据交换和额度；MCP 改为可信上下文，不再使用静态教师令牌。
5. 用持久 Task Store 与 Task ACL 接 A2A；发布只包含已实现技能的 Agent Card。先教师/受限访客读，再学生 Agent。
6. 压测与负例验收：跨岛、跨学生、过期/撤回同意、教师换班、Agent 委托撤销、盗用 Task ID、重放/并发、密钥轮换、停机恢复和日志脱敏。只有全部通过，才允许真实学生与公网 A2A。

**教师 OIDC 凭据验证切片（2026-09-26）**：已在教师 API 增加可选的 TeacherOIDCVerifier 模式，使用固定 RS256/JWKS、精确 iss 与单 aud、azp、短时效、hd.teacher scope，并在每次请求调用受信成员关系查询来检查 IdP sub 对应的 island_id 与 teacher_id。缺失/轮换密钥、无效声明、撤销关系或关系服务不可用均拒绝。静态本地令牌与 OIDC 模式互斥。HTTP 测试使用内存模拟 JWKS 和关系源，另有 PostgreSQL 实库回调测试；尚未接 Keycloak discovery、正式 IdP 与部署环境、撤销令牌清单、A2A Task ACL 或真实监护流程；PostgreSQL 基础关系存储已通过实库测试。此切片仍仅供模拟资料使用，不能据此开启真实学生或公网 A2A。接入 Keycloak 时须为教师 API 配置专用 audience、授权客户端 azp 和 hd.teacher scope，JWKS 来源与签发方固定在服务端配置，不从请求头或 JWT 的 jku 读取；成员关系查询必须由服务端数据库提供。

**Agent MCP 工作负载认证切片（2026-09-26）**：create_teacher_remote_mcp 用官方 SDK 的 Streamable HTTP 资源服务器接口，要求与人类教师令牌分开的 Agent 凭据。它验证 RS256 签名、固定发行方、单一 MCP 资源 audience、客户端 azp、hd.teacher.mcp scope、短时效、agent_id 与 sub 一致、delegation_id、目标岛/教师，并在每次请求调用受信委托关系源。实际 initialize、tools/list 及撤销后拒绝已通过合成密钥和模拟关系源测试。尚未实现正式 Agent 注册 API/令牌签发、Keycloak 连接、HTTPS 部署、Hermes 实机和开岛激活；PostgreSQL 基础委托表与撤销查询已通过实库测试；此处不构成生产授权网关。正式部署须将验证器连接至持久关系源，并补齐受保护写入接口、撤销审计和配额。

**PostgreSQL 关系存储切片（2026-09-26）**：已提交 migrations/0001_identity_gateway.sql、identity_store.py 与 scripts/migrate_identity.py。初始迁移包含岛屿、内部主体、教师成员关系、Agent 实例、受限委托和授权变更审计表；迁移具备事务、校验和检查。IdentityStore.active_teacher 与 active_delegation 可直接供上述验证器逐请求调用，教师关系或委托撤销后查询立即拒绝。GitHub Actions 的 PostgreSQL 17 服务容器已运行全部 118 个测试且无跳过：[实库验收记录](https://github.com/MkaliezZ/hyper-dimension/actions/runs/36224991215)。这只验证了基础身份关系和撤销，不包含监护人关系/同意、班级/学生分配、青少年模式、正式凭据签发、管理员授权 API 或生产部署。写入方法是受保护网关未来调用的内部存储函数，不能直接暴露给 Agent。

**服务装配切片（2026-09-26）**：identity_runtime.py 固定 Keycloak 同 Realm 的 HTTPS JWKS 地址，在启动时取公钥，短时缓存并在更新失败时拒绝继续使用过期缓存。build_synthetic_island_services 将同一个 PostgreSQL IdentityStore 注入教师 API 与 Streamable HTTP MCP；两端使用不同的 audience/scope 和人类/Agent 凭据。此装配仍连接 SQLite 模拟业务资料及默认未核验监护假设，不提供登录、凭据签发、正式上传或互联网部署。真实学生数据仍被禁止。

**当前实装口径**：本仓库已实现本地模拟学生访问码、显式标记未核验的默认监护授权、静态教师 Bearer 和部分业务权限校验。新 A2A 本地读适配器的测试只能证明官方 SDK JSON-RPC、全路由本地令牌防护、两项只读业务和本地审计可工作；它不证明正式 OIDC 登录、监护关系核验、跨 Agent 互通、持久 Task ACL、完整 PostgreSQL 业务迁移或公网安全已完成。
