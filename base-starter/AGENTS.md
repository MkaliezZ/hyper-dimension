# base 学员开发约定

先读README和docs/开发指南.md，先运行默认闭环，再修改src/base/app。这里没有插件ID或注册流程。

先读docs/通用教学规则与修改入口.md。通用约定在app/teaching.json，类型化档案在app/profile.py，策略在app/strategy.py。具体活动明确目标、成果、评价依据与下一步；不要把结构通过、提交完成或分数当成能力达标。资料可读不等于知识已核验。学科规则与资料仍由开发者填写。

不要求完整学习档案、诊断、前置关系或全部生命周期才允许活动。不要先加多角色引擎、图谱或插件注册。角色称呼不改变权限，不能把维护者口令当作监护人只读授权。

所有业务规则与内容修改优先放app；web与MCP共用core。需要改core时说明理由并跑相关回归。配置、资料或提示词变化不代表程序会自动调用模型。

不要修改SQLite中的实例口令来复用其他人的实例。不要把data、密钥、真实学习者信息、教材原书提交或分发。

完成后实际启动页面，创建任务、提交、反馈并读取结果。运行scripts/check.py和相关tests；未执行的步骤不得宣称通过。保留待确认的教学内容质量问题。

修改通用能力时跑tests/test_base.py与tests/test_base_teaching.py；业务改版更新app/acceptance.json并增加正反例。需要MCP时安装可选依赖并运行scripts/verify_mcp.py；默认运行仍不需要MCP或模型。
