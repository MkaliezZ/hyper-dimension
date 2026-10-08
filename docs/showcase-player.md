# 小岛放映室 / Island Cinema

[中文在线播放](https://mkaliezz.github.io/hyper-dimension/) · [Watch in English](https://mkaliezz.github.io/hyper-dimension/?lang=en)

README 的封面和视频标题打开播放器，MP4 下载有单独按钮。影片使用标准 HTML 视频控件，可暂停、拖动进度、调节音量及全屏。播放器提供中英文切换和手机布局，不需要游戏账号。

| 影片 | 时长 | 内容 |
| --- | --- | --- |
| 小岛与管家 | 30 秒 | 双画风、AI 居民、Agent 管家、房屋内小游戏、真实文档成果 |
| 完整相遇 | 45 秒 | 更多管家形象、主子 Agent 分工、练习通关与工作文件 |
| 会客馆内部 | 45 秒 | 岛主介绍、八段人生／教育／就业经历、三个项目与图片、访客留言和岛主回复、像素与折纸展厅 |

## 会客馆导览

新增影片来自 V135 实际页面与隔离示例岛。姓名、学校、公司、经历、项目、图像和留言身份均为虚构示例，画面中保留标识。访客账户通过正式留言接口投递，岛主在实际界面中保存回复；两套画风展示同一已发布档案。

原生标签捕获为 2560 × 1440。会客馆镜头采用 160% 阅读缩放与相应弹窗限高，方便阅读；不改变游戏状态、NPC 速度或动作。固定画幅、实际平滑滚动、双语字幕，配项目原创《Island Hours》（96 BPM）。未使用光流、帧混合或游戏加速。所选七段区间的捕获间隔均不超过 50 ms。

文件：`hyper-dimension-gallery-tour-v135.mp4`，45 秒，2700 帧，H.264 / AAC，48 kHz。

SHA-256：`732135b5457eca10232ea259cff5383d28a78c939a328be8edb466d6093640ba`。

## 发布方式

[播放器源码](../showcase/)由 [GitHub Pages 工作流](../.github/workflows/showcase-pages.yml)发布。构建仅复制静态播放器、公开封面和经过 SHA-256 核对的 Release 影片；不构建游戏运行时，不复制存档或本机配置。[GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## English

README covers and video titles open the online player. Downloading is a separate action. Native video controls support pause, seeking, volume and fullscreen. The bilingual, responsive page requires no game account.

The new 45-second gallery tour shows a biography, eight life/education/employment chapters, three projects and their images, an actual signed-in visitor message and saved owner reply, and both visual styles of the same published portfolio. All identities and portfolio content are fictional and labeled.

The V135 footage uses native 2560 × 1440 tab capture, a 160% reading scale with a corresponding gallery height limit, actual scrolling, bilingual captions and the original Island Hours soundtrack. No simulation acceleration, optical flow or frame blending is used. All seven selected intervals have capture gaps at or below 50 ms. The movie contains 2700 frames, H.264 video and 48 kHz AAC audio.

The Pages build publishes only static player files, public posters and SHA-256-verified Release videos. No game saves, credentials, work documents or installed runtimes are part of the site.
