# Hyper Dimension · 首期实现

这是 Hyper Dimension 的公开首期代码仓库，采用 MIT 许可证。当前优先开发 **6—15 岁英语教师版**：目标、任务、口语证据、教师复核、个性化计划与报告。学生 Agent 与教师 Agent 的 A2A 通信预留在版本化业务协议中；当前代码尚未提供学生 Agent、测评后端或生产级身份认证。

## 当前状态

- FastAPI 应用起点与健康检查
- Hyper Dimension Education Protocol v1 请求/结果 JSON Schema
- 协议加载与校验函数及对应测试
- 教师版开发顺序与 A2A 接口边界文档

这些是首个基础提交，不代表学生测评闭环已经上线。下一迭代从 PostgreSQL 数据模型、权限和审计开始。

## 本地运行

需要 Python 3.11 或更新版本。在本目录创建虚拟环境并安装：

~~~bash
python -m venv .venv
python -m pip install -e ".[dev]"
python -m pytest
python -m uvicorn hyper_dimension.api:app --reload
~~~

健康检查：GET http://127.0.0.1:8000/healthz

Windows PowerShell 中先激活本地虚拟环境，或直接使用虚拟环境内的 python。服务端尚未开放学生数据 API，也不应使用真实学生资料测试。

## 协议分层

- A2A 负责未来的 Agent Card、Message、Task 与传输。
- Hyper Dimension Education Protocol 负责学生证据、计划、反馈、授权、审批和审计的业务语义。
- 首期网页与未来 A2A 适配器调用同一业务服务，不维护两份测评数据。

参见 docs/teacher-first-slice.md 和 src/hyper_dimension/schemas。

## 公开仓库约定

所有演示数据必须为模拟信息。不要提交真实学生答卷、口语录音、监护授权记录、密钥或生产日志。版权不明的 2D/3D 素材也不放入仓库。
