# Hyper Dimension · 首期实现 / First Phase

[中文](#中文) · [English](#english)

## 中文

这是 Hyper Dimension 的公开首期业务代码仓库，采用 MIT 许可证。当前聚焦 **6–15 岁英语教师版**：目标、实时任务、读写自动评测、教师异常复核、个性化计划与报告。学生 Agent 与教师 Agent 的 A2A 通信预留在版本化业务协议中。

### 当前可运行内容

- FastAPI 起点与 `/healthz` 健康检查。
- Hyper Dimension Education Protocol v1 的请求和结果 JSON Schema、校验函数及测试。
- `web/`：可独立运行的 2D 小岛视觉基线。人物、文字、图片、视频入口均为可替换的 **DEMO** 内容；详见 [前端说明](web/README.md) 和 [素材来源](web/ASSETS.md)。
- [英语测评 Agent Skill](skills/english-assessment/SKILL.md)、[原创题目生成流程](skills/english-assessment/references/item-generation-workflow.md)及[2026 公开样本核验](docs/curriculum/2026-exam-task-review.md)：按教材页证据、当年地区试题来源级别、CEFR 描述符与 A2 Key/B1 Preliminary for Schools 的公开任务逻辑生成原创题目、答案解析和教师报告草稿。教材 PDF 与真实学生证据不在本仓库。
- [实时出题、自动评测与审计契约](docs/curriculum/realtime-assessment-and-audit-v0.1.md)、[教师版切片](docs/teacher-first-slice.md)、[前端基线](docs/frontend-baseline.md)及[英语课程与多教材适配设计](docs/curriculum/curriculum-architecture-v0.1.md)、[原创单元样板](docs/curriculum/sample-unit-packs-v0.1.md)与[测评报告格式](docs/curriculum/assessment-and-report-format-v0.1.md)。

当前完成度见[开发状态与下一步](docs/development-status.md)。教师测评后端、学生 Agent、生产级身份认证与真实学生数据流程尚未实现。请勿把真实学生档案、录音、授权信息、密钥或生产日志提交到公开仓库。

### 本地运行

Python 3.11+：

```bash
python -m venv .venv
python -m pip install -e ".[dev]"
python -m pytest
python -m uvicorn hyper_dimension.api:app --reload
```

Web 前端需要 Node.js 与 pnpm：

```bash
cd web
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

### 协议分层

A2A 承载 Agent Card、Message、Task 和传输；Hyper Dimension Education Protocol 描述学生证据、计划、反馈、授权、审批与审计的业务语义。未来网页与 A2A 适配器调用同一业务服务。

## English

This MIT-licensed repository contains the first phase of Hyper Dimension. The initial product targets **English teachers of learners aged 6–15**: learning goals, live task generation, automated reading and writing assessment under teacher policy, exception review, personalized plans, and reports. Versioned business schemas reserve an interface for future student-agent and teacher-agent communication over A2A.

### What runs today

- A FastAPI starting point and `/healthz` endpoint.
- Hyper Dimension Education Protocol v1 request/result JSON Schemas, validation helpers, and tests.
- `web/`, a runnable 2D island visual baseline. Its characters, copy, images, and optional video slots are replaceable **DEMO** content; see the [web guide](web/README.md) and [asset notes](web/ASSETS.md).
- [Reusable English assessment agent skill](skills/english-assessment/SKILL.md) and [item generation workflow](skills/english-assessment/references/item-generation-workflow.md) for original tasks, explanations, and reports approved under versioned teacher policies, with exception review, grounded in textbook evidence, verified local exam sources, CEFR descriptors, and public A2 Key/B1 Preliminary for Schools formats. Copyrighted textbook PDFs and student records are not included.
- [Real-time assessment and audit contract](docs/curriculum/realtime-assessment-and-audit-v0.1.md), [teacher-first implementation slice](docs/teacher-first-slice.md), [frontend baseline](docs/frontend-baseline.md), and [curriculum and multi-edition design](docs/curriculum/curriculum-architecture-v0.1.md) (currently documented in Chinese).

See [development status and next steps](docs/development-status.md). Assessment services, the student agent, production authentication, and processing of real student records are still pending. Keep real student records, recordings, consent data, secrets, and production logs out of this public repository.

### Run locally

Use Python 3.11+ and Node.js with pnpm:

```bash
python -m venv .venv
python -m pip install -e ".[dev]"
python -m pytest
python -m uvicorn hyper_dimension.api:app --reload
cd web
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

A2A provides agent discovery, messages, tasks, and transport. The Hyper Dimension Education Protocol defines the education-specific semantics and audit trail. Future web and A2A adapters will use the same business service.
