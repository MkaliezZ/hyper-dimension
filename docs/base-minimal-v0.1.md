# base 最小闭环 0.1 实现契约

## 0.3.0通用教学切片（当前）

通用约定在app/teaching.json；可选档案与学科字段Schema在app/profile.py；下一步策略在app/strategy.py。目标、成果与来源随活动快照保存，文件摘要改变时取消对应资料的旧核验标记。所有入口共用Store。

新增稳定实例身份、明确选择已有学习者跨活动复用、档案、学习事件、作品判定与人工迁移核验；暂停/恢复/归档在服务端执行；反馈支持幂等重试、评阅身份、版本和历史。完成、达标、独立迁移分别计数，不提供通用掌握度公式。旧0.2数据库只加表和state列，保留历史ID和链接，不推断同名合并。

实际范围和扩展入口见base-starter/docs/通用教学规则与修改入口.md及通用教学接口参考.md。角色目前是维护者与持链接的学习者两组；角色称呼可改，不代表已有监护人只读或多教师权限引擎。路径用普通业务函数扩展，不预建流程引擎或插件注册。

## 0.2.1修订

页面直接显示活动next_step；start.ps1支持-Port/-DataPath；随包check -Business与verify提供业务样例及真实HTTP验收。验收输入为app/acceptance.json。所有操作默认不依赖MCP或模型。

可选structure在app层给出段落/字数/模糊词辅助提示，状态保持pending，不自动给教学分数。可选rubric为label/max_score数组；维护者反馈可传scores（label/score数组），由服务端按发布快照验证维度、范围与数值，计算total/max_total。得分与反馈一起入库并保留修订历史。没有量规时仍是普通文字反馈。GET /api/manage和学习活动公开返回量规定义，学习者无评分写权限。

备份支持工程data下的隔离目录；verify.ps1只启动并停止自己的进程树。默认源码包不分发任何data目录或凭据。教学效果、真人上手、其他系统及公网仍需另测。

这是现有仓库内的新通用切片，入口为 `python -m base` 和 `python -m base.mcp`。未替换 Hyper Dimension 原有入口、教师策略、档案或数据库。旧英语专用接口保持原语义。

学员交付以源码开发包与网页启动为默认路径，不需要MCP桥接或DSH。`base.mcp`只是可选产品接口，依赖在requirements-mcp.lock中，默认requirements.lock不含MCP。

`base-starter/scripts/build_distribution.py` 从唯一源码 `src/base`、分发说明 `base-starter` 和基础测试生成独立分发包；不包含旧产品后端和业务数据库。运行时底座使用独立数据目录。

## 数据与业务边界

不指定learner_id时，新活动自动建立独立学习者档案；同名允许分别建档。v0.3可明确选择learner_id复用档案，并读取该学习者的成长证据与下一步建议。内部ID不要求学员手工设计，网页通过选择档案处理。

已发布活动保存内容和参数快照。文字提交默认待人工反馈，数值提交使用 app/assessment.py 的等值逻辑。提交有任务内幂等键，创建有可选幂等键，UI和MCP均传入。复用键与不同内容冲突时拒绝，不覆盖原记录。

维护者通过独立口令登录，Cookie HttpOnly/SameSite=strict。学习链接是该活动的持有凭证，能查看该活动提交历史；应仅交给对应学习者。公共活动返回使用字段白名单，不包含 expected、管理口令和其他活动记录。

默认网站只监听127.0.0.1，无TLS，尚未验证公网和大规模并发。stdio MCP运行者等同维护者，拥有创建与反馈权限，不是学习者入口。create_activity是显式授权发布动作，不做隐含自动审题；check_activity仅做结构检查。未实现自动模型调用。

## 已实现接口

- POST /api/login、POST /api/logout：维护者会话。
- GET /api/manage：私有预览、任务、提交。
- POST /api/tasks：预览确认后的创建；learner、可选draft、request_key。
- GET/POST /api/learn/{token}：限定活动读取与提交。
- POST /api/feedback/{submission_id}：维护者反馈与下一步，保留修订记录。
- 新增HTTP：POST /api/learners、GET /api/growth/{learner_id}、POST /api/tasks/{task_id}/state、POST /api/transfer/{submission_id}，均需维护者权限。
- MCP：get_context、check_activity、create_activity、list_records、record_feedback、save_learner、get_growth、plan_next、set_activity_state、verify_transfer。

应用对象的必填字段和规则以 app/assessment.py 为准；README和开发指南随分发包提供。

## 验证方式

tests/test_base.py验证隔离、快照、并发幂等、错误输入和最小闭环。
tests/test_base_teaching.py验证档案Schema、稳定身份、旧库兼容、来源核验失效、达标与迁移证据、状态执行、反馈重试、权限和配置修改脚本。随包scripts/verify.py验证真实网络HTTP；可选scripts/verify_mcp.py验证真实stdio和进程内学习者HTTP联动。历史tests/base_delivery_probe.py会修改目标副本，只留作历史探针，不作为当前学员入口。

干净虚拟环境复做与独立Agent复做分别记录，不替代真人学员试用。阶段报告存放在本地Studio交付目录，含环境路径、失败与修复信息；不将私有数据写入仓库。
