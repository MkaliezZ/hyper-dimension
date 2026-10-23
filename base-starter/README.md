# base 源码开发包

学员先读 [00-学员使用说明](00-学员使用说明.txt)，再复制 [AI 开发起始提示词](docs/让AI开发伴学MCP-起始提示词.txt) 开始；完成后按 [验收清单](docs/伴学MCP-验收清单.txt) 留下证据。本次学员说明版为2026-10-23，底座运行版本仍是v0.3.2。源码与可选MCP接口均在同一个工程内。

这是可直接修改的教育伴学基础工程。当前只支持文字提交、人工反馈、数值/分数等值判断；不包含模型、题库或学习效果保证。

v0.3已内置通用教学约定、可选学习档案、跨活动稳定身份、证据成长记录、下一步策略和暂停/归档。先读[通用教学规则与修改入口](docs/通用教学规则与修改入口.md)：十类基础能力逐项说明已有范围与扩展点。学科专属知识与教学判定仍由你开发，不需要先配置完整档案、路径或插件。

v0.3.1修复换成数值学科后的通用测试适配；策略动作名称由业务决定。简单学科档案字段会自动出现在网页表单；“调整本次活动”可为同一学习者先创建数值练习，再创建文字解释作品，保留各自版本。

v0.3.2的PowerShell脚本统一使用UTF-8 BOM，兼容系统自带Windows PowerShell 5.1；保留实际解析回归，不要求先安装PowerShell 7。

## 首次运行（Windows，Python 3.11+）

解压后在工程目录运行：

```powershell
.\scripts\setup.ps1
.\scripts\start.ps1
```

浏览器打开 http://127.0.0.1:8765 。用本机 `data/base/owner-token.txt` 中的口令登录。先预览活动，填写合成学习者称呼、创建链接，再打开学习链接提交。回维护者页面刷新，填写反馈与下一步；学习者刷新即可看到。

另开终端执行 `.\scripts\check.ps1` 做临时数据自检，不修改当前学习记录。启动终端按 Ctrl+C 停止。

若8765已占用，使用 `.\scripts\start.ps1 -Port 8766`，浏览器也改用8766；不要结束不属于本工程的进程。自检通过只证明保存与反馈管线可运行。改版后更新src/base/app/acceptance.json，再执行check.ps1 -Business和verify.ps1验证自己的业务；无需另写HTTP测试脚本。

安装只需首次执行；缺少Python时先安装Python 3.11以上。可通过 `setup.ps1 -PythonPath "完整python.exe路径"` 指定解释器。依赖下载需要网络，失败时脚本会停止，不能继续假装安装完成。PowerShell若阻止本地脚本，可仅对本次启动使用 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1`，不要修改整机策略。

## 做自己的伴学

主要修改 `src/base/app/`。先改 config.json、knowledge/material.txt、prompts/activity.txt；要新判分再改 assessment.py；可选structure配置提供结构提示，rubric配置提供分项得分。修改后重启，创建新活动。旧活动保留原资料与规则参数快照，不能拿旧链接判断新配置是否生效。具体字段与备份见 [开发指南](docs/开发指南.md)。

默认文字活动不会自动给出教学评价：学习者提交后显示待反馈，维护者填写具体意见。自动评价仅用于 numeric 模式确定的数值等值判定。材料与提示词不是自动生成器；是否接入AI生成、使用什么工具，由开发者按自己的应用需要决定。

通用规则改app/teaching.json；可选档案及学科字段改app/profile.py；下一步建议改app/strategy.py。已有学习者在网页选择原档案，不按同名自动合并。评价可选择“需修订/达标”，未选择则仅记反馈；分数不自动决定达标。来源可读取不等于已核验。

也可运行`.venv/Scripts/python.exe scripts/configure.py --name 我的伴学 --goal 能用证据解释一个观点`修改配置；脚本校验后保存备份，不能替你编写资料或业务评价。examples/blank提供待填参考，numeric/project提供可运行示例。接口与兼容说明见[通用教学接口参考](docs/通用教学接口参考.md)。

学员开发无需配置任何MCP桥接、DSH或模型凭据。直接编辑源码并启动网页即可。开发指南末尾的MCP说明仅供以后需要产品接口时参考，默认安装不包含该可选依赖。

此实例仅在本机监听。学习链接只授予该活动及其历史记录的访问权限，请只交给对应学习者。管理口令不要发给学习者。局域网需通过 start.ps1 -HostAddress 0.0.0.0 开放，并使用本机实际IP地址；公网部署与TLS尚未验收。

分发时不要带 data、.venv 或真实教材。examples仅供参考，无需安装或注册。源码MIT许可，保留LICENSE。

隔离试验：`scripts/start.ps1 -Port 8766 -DataPath data/my-test`。对应管理口令位置由启动终端提示。验证目录及清理边界见开发指南。
