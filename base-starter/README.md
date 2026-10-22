# base 最小闭环 0.1

这是可直接修改的教育伴学基础工程。当前只支持文字提交、人工反馈、数值/分数等值判断；不包含模型、题库或学习效果保证。

## 首次运行（Windows，Python 3.11+）

解压后在工程目录运行：

```powershell
.\scripts\setup.ps1
.\scripts\start.ps1
```

浏览器打开 http://127.0.0.1:8765 。用本机 `data/base/owner-token.txt` 中的口令登录。先预览活动，填写合成学习者称呼、创建链接，再打开学习链接提交。回维护者页面刷新，填写反馈与下一步；学习者刷新即可看到。

另开终端执行 `.\scripts\check.ps1` 做临时数据自检，不修改当前学习记录。启动终端按 Ctrl+C 停止。

安装只需首次执行；缺少Python时先安装Python 3.11以上。可通过 `setup.ps1 -PythonPath "完整python.exe路径"` 指定解释器。依赖下载需要网络，失败时脚本会停止，不能继续假装安装完成。PowerShell若阻止本地脚本，可仅对本次启动使用 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1`，不要修改整机策略。

## 做自己的伴学

主要修改 `src/base/app/`。先改 config.json、knowledge/material.txt、prompts/activity.txt；要新判分再改 assessment.py。修改后重启，创建新活动。旧活动保留原资料与规则参数快照，不能拿旧链接判断新配置是否生效。具体字段、MCP与备份见 [开发指南](docs/开发指南.md)。

默认文字活动不会自动给出教学评价：学习者提交后显示待反馈，维护者填写具体意见。自动评价仅用于 numeric 模式确定的数值等值判定。材料与提示词不是自动生成器；需要真实生成时接入你自己的MCP客户端。

此实例仅在本机监听。学习链接只授予该活动及其历史记录的访问权限，请只交给对应学习者。管理口令不要发给学习者。局域网需通过 start.ps1 -HostAddress 0.0.0.0 开放，并使用本机实际IP地址；公网部署与TLS尚未验收。

分发时不要带 data、.venv 或真实教材。examples仅供参考，无需安装或注册。源码MIT许可，保留LICENSE。
