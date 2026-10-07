# Assets and media / 素材与媒体

## 中文

- 双画风地图、房屋、角色、工具、物品与场景资源保留在 public/assets/。AI 生成、后处理与既有资产的来源记录保留在该目录的 provenance JSON 和 docs/provenance/；公开记录已将个人绝对路径替换为来源文件标识。
- UI 绘制、粒子、人物与环境动画逻辑在 src/；不要仅替换静态贴图而破坏帧坐标、朝向、数量与交互匹配。
- Fusion Pixel Font 使用原有 OFL 许可，原文在 licenses/FusionPixel-OFL.txt。其他依赖见 THIRD_PARTY_NOTICES.md。
- docs/media/ 的运行截图和短预览由本次 V107 实机运行录制产生。完整 30 秒视频在 GitHub Release。录制仅使用独立演示存档与官方自由练习模式，没有真实账户、个人文档、私人聊天或配置；管家工作演示使用专门编写的虚构资料和真实工具调用。
- 视频采用原创器乐曲 Island Hours（96 BPM、12 小节、30 秒），由代码合成全部音色，无外部采样、旋律引用或人声。未使用库存视频或生成式假游戏画面；字幕、镜头推进、帧融合和时间剪辑为后期制作。本机路径已遮罩。小游戏为占位演示，玩法、美术和动画将持续优化。
- 项目 MIT 许可不能替代第三方原始许可，来源记录也不新增第三方授权。my_ai_town 的代码未被复制进此海岛交付树。

## English

Game artwork lives in public/assets/. Provenance JSON in that directory and docs/provenance/ records generated, processed and existing asset sources; personal absolute paths have been replaced with source identifiers.

UI rendering, particles and character / environment animation live in src/. Preserve frame geometry, orientation and interaction alignment when modifying artwork.

Fusion Pixel Font retains its OFL license. See licenses/FusionPixel-OFL.txt and THIRD_PARTY_NOTICES.md for dependency licenses.

The screenshots and animated preview in docs/media/ are recorded from V107 using isolated demo saves and the built-in practice mode. The complete 30-second MP4 is a Release asset. Its original instrumental score, Island Hours, is synthesized from an original 96 BPM / 12-bar composition without third-party samples, melody quotations or vocals. No stock footage or generated pretend gameplay is used. Captions, camera moves, frame blending and cuts were added in editing. The steward reads a synthetic brief with real tools; local paths are masked and no private user data is shown. Minigames are placeholder demonstrations; gameplay, art and animation remain in development.

Provenance does not create third-party rights, and the project's MIT license does not override third-party terms. No my_ai_town code has been copied into this island delivery tree.


## Original score source / 原创配乐源码

The optional compose-original-score.py in docs/media/ reproduces the score with Python, NumPy and FFmpeg (not required to run the game). All instrument sounds are synthesized. / 配乐源码需要 Python、NumPy 与 FFmpeg；仅媒体制作使用，游戏部署无需这些工具。
