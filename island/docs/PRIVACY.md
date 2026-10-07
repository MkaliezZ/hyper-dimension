# Privacy and publication / 隐私与公开边界

## 中文

- 仓库与 Release 只分发源码、固定依赖、游戏资源、许可证及隔离演示媒体。
- 不分发 .env.local、API 密钥、真实存档、账号数据库、会话记录、现实文档、生产日志、运行时、浏览器存储或本机备份。
- 截图与视频来自独立演示目录，使用默认虚构角色和练习模式；没有录制真实用户聊天、桌面、终端或配置页面。
- 测试中的令牌、用户名和文件示例是隔离夹具。不得把真实凭据替换进去后提交。
- AI 调用使用你自行配置的服务。居民身份、岛屿状态和对话可能发送至所配模型；主动委托管家处理文档时，相应文件内容也可能成为上下文。本机部署不等于模型一定离线。
- 原生管家可执行主动授权的本机文档工作。部署 Agent 应按部署指南配置工作目录和权限；不要为了演示开放整个磁盘或公网。
- 默认监听 127.0.0.1。真实存档和密钥留在本机私有目录；备份应另行保管，不作为 GitHub Release 附件上传。
- 发布前检查源码、待提交列表和媒体。文件哈希证明一致性，不等于全面安全认证。

## English

The repository and Releases contain source, pinned dependencies, game assets, licenses and isolated demo media. They exclude private configuration, API keys, real saves, account databases, conversation history, real documents, production logs, installed runtimes, browser storage and local backups.

Screenshots and video use fictional default characters and practice mode, without recording a user's desktop, terminal, configuration or real chat. Test identifiers are isolated fixtures.

AI requests use the services you configure. NPC identities, game state and conversations may be sent to that provider. Explicitly requested document work may include corresponding document content. Running the app locally does not imply an offline language model.

Use the deployment guide to configure the steward's workspace and permissions. The default listener is localhost. Keep private data and backups outside published artifacts. Integrity hashes demonstrate byte identity, not a comprehensive security certification.
