# base 最小闭环 0.1 实现契约

这是现有仓库内的新通用切片，入口为 `python -m base` 和 `python -m base.mcp`。未替换 Hyper Dimension 原有入口、教师策略、档案或数据库。旧英语专用接口保持原语义。

学员交付以源码开发包与网页启动为默认路径，不需要MCP桥接或DSH。`base.mcp`只是可选产品接口，依赖在requirements-mcp.lock中，默认requirements.lock不含MCP。

`base-starter/scripts/build_distribution.py` 从唯一源码 `src/base`、分发说明 `base-starter` 和基础测试生成独立分发包；不包含旧产品后端和业务数据库。运行时底座使用独立数据目录。

## 数据与业务边界

稳定内部学习者标识随新活动自动生成；同名允许分别建档。当前每次创建活动代表新学习者档案；还没有同一学习者跨活动档案复用和成长聚合。

已发布活动保存内容和参数快照。文字提交默认待人工反馈，数值提交使用 app/assessment.py 的等值逻辑。提交有任务内幂等键，创建有可选幂等键，UI和MCP均传入。复用键与不同内容冲突时拒绝，不覆盖原记录。

维护者通过独立口令登录，Cookie HttpOnly/SameSite=strict。学习链接是该活动的持有凭证，能查看该活动提交历史；应仅交给对应学习者。公共活动返回使用字段白名单，不包含 expected、管理口令和其他活动记录。

默认网站只监听127.0.0.1，无TLS，尚未验证公网和大规模并发。stdio MCP运行者等同维护者，拥有创建与反馈权限，不是学习者入口。create_activity是显式授权发布动作，不做隐含自动审题；check_activity仅做结构检查。未实现自动模型调用。

## 已实现接口

- POST /api/login、POST /api/logout：维护者会话。
- GET /api/manage：私有预览、任务、提交。
- POST /api/tasks：预览确认后的创建；learner、可选draft、request_key。
- GET/POST /api/learn/{token}：限定活动读取与提交。
- POST /api/feedback/{submission_id}：维护者反馈与下一步，保留修订记录。
- MCP：get_context、check_activity、create_activity、list_records、record_feedback。

应用对象的必填字段和规则以 app/assessment.py 为准；README和开发指南随分发包提供。

## 验证方式

tests/test_base.py验证隔离、快照、并发幂等、错误输入和最小闭环。
tests/base_delivery_probe.py对解压并安装的副本执行真实HTTP、stdio MCP、业务改版、重启与备份恢复。该脚本会修改目标副本的app文件，只用于专门复做目录，不能指向已有学员项目。

干净虚拟环境复做与独立Agent复做分别记录，不替代真人学员试用。阶段报告存放在本地Studio交付目录，含环境路径、失败与修复信息；不将私有数据写入仓库。
