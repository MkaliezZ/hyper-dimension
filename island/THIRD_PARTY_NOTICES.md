# 第三方依赖与素材说明 · Agent源码包

本包分发源码、资源与固定依赖归档，不包含Windows/macOS安装器、Node/Python可执行文件或已安装虚拟环境。目标机自行准备解释器，项目内部重建环境。

| 组成 | 固定版本/来源 | 许可原文 |
| --- | --- | --- |
| Hermes Agent | 0.19.1 / 0a62610f10cc34d696b2239b2c69fa1ba0f1ca63 | licenses/Hermes-Agent-MIT.txt |
| Playwright Core | 1.63.0，npm lock integrity | licenses/playwright-core/LICENSE、NOTICE、ThirdPartyNotices.txt |
| Fusion Pixel Font | 既有fusion-pixel-12px.woff2，未修改 | licenses/FusionPixel-OFL.txt |
| Python依赖 | 72个按平台条件的固定版本；Windows70、Mac ARM69、Mac Intel68 | vendor/python-platform-lock.json及licenses/python、licenses/posix |

Windows原70份wheel核对官方PyPI摘要；Mac14+/CPython3.11两架构补32份wheel，逐项核对官方摘要和兼容标签。平台兼容与完整性检查不代表Mac实体运行已验收。Python3.12/3.13及Linux缺少的本平台二进制包须由同一摘要锁从官方源下载，禁止未锁定依赖自动升级。

openpyxl3.1.5许可补自官方同版本源包，原SHA256 cf0e3cf56142039133628b5acffe8ef0c12bc902d2aadd3e0fe5878dc08d1050。其他版权/NOTICE/许可原文保留；新POSIX ptyprocess/uvloop的许可从固定wheel提取。

来源：[Hermes Agent](https://github.com/NousResearch/hermes-agent)、[Playwright](https://github.com/microsoft/playwright)、[Python包索引](https://pypi.org/)、[Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font)。

Hyper Dimension美术来自既有授权素材、AI生成或源码绘制，来源在public/assets/*provenance*.json及docs/provenance；个人绝对目录转为原文件名标识。项目原创代码与文档沿用仓库 MIT 许可；第三方内容仍遵循其各自许可，来源记录不能替代第三方授权。my_ai_town未复制进本交付代码树。
