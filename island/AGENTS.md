# Agent 部署入口

你正在接手Hyper Dimension的可部署源码包。读 deploy.json、DEPLOYMENT.md 和本文件，然后完成目标机部署并给出证据。该协议不限Agent品牌/IDE；无需双击安装器。

## 顺序

1. 保留用户现有数据，确认当前目录/实际Windows或Mac架构、Node/Python版本。先运行 node tools/agent-deploy.mjs plan 和 doctor。
2. 缺少基础解释器时依据目标机包管理器准备Node22.13+、Python3.11–3.13；优先24.19/3.11。不改变用户系统选项变量，不安装到已有游戏数据目录。
3. node tools/agent-deploy.mjs setup --python=目标解释器；Windows/macOS 14+ CPython3.11可 --offline。解析JSON/退出码，失败保留现有环境及报告，不把失败写成成功。
4. 用户提供API密钥后放私有.env.local/进程环境。无密钥也可启动规则模式，清楚报告AI未配置；不要搜集或上传无关文件。
5. node tools/agent-deploy.mjs verify，随后 run --mode=lan（或用户要求的独立画风）。使用自身后台进程工具保持服务，Windows隐藏窗口。
6. 实际验证登录/两主题/零资源采集/存档/重开，提供URL、运行版本、测试和未通过项。只在收到用户要求时迁移旧数据，并保留原件和完整备份。

## 持续规则

- 模型固定DeepSeek V4.1 Flash/deepseek-flash，自动300/600/950秒，无Pro/其他模型回退。
- 25建筑、15AI+Hermes、临时1席、50素材/300配方、900秒有效日、首次零币零库存；两主题共享规则。
- 源码/资源清单须核对，不公开data、.env.local、签名私钥、现实文档和私有运行日志。
- .runtime只在目标机重建；Mac使用bin/python，Windows使用Scripts/python.exe。路径含空格也必须以参数数组执行，不能拼接shell脚本。
- 不清空现有存档、不覆盖不兼容环境、不自动重放现实文件工作、不批量终止无关进程。
- 支持路径测试不代表Mac实机/真人/完整游戏验收。按真实证据报告。
