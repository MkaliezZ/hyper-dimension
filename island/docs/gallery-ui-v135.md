# V135 · 会客馆内部展陈与当前宣传片

## 会客馆界面

会客馆沿用游戏已有的像素／折纸室内图、主题边框和导航图标。页面分为会客厅、经历展墙、项目展厅、留言板与岛主编辑：

- 会客厅展示主题房间、人物介绍、经历／项目／来信数量，以及三个项目图片预览。
- 经历以章节时间线呈现人生、教育和就业，不改变保存的原文。
- 项目使用照片与正文并排排版；真实上传图片保持比例，附件保留打开入口。
- 留言采用对应主题的信笺卡片；登录访客留言、岛主回复和隐藏机制保持原有权限。
- 编辑区保留草稿、上传与主动发布。关闭按钮在外层固定，内容独立滚动。

两种画风共享同一档案。界面改动没有替换用户资料，也没有自动把私有草稿公开。

| 折纸会客厅 | 像素会客厅 |
| --- | --- |
| ![Origami interior](screenshots/v135-origami-gallery.png) | ![Pixel interior](screenshots/v135-pixel-gallery.png) |

| 经历展墙 | 项目展厅 |
| --- | --- |
| ![Experience timeline](screenshots/v135-origami-experiences.png) | ![Project photos](screenshots/v135-origami-projects.png) |

截图与视频中人物、院校、公司、项目数字和照片均为虚构示例；照片为既有 AI 生成展示素材。用户可以通过编辑、上传和发布展示自己的资料。

## 手动管家请求修复

录制时发现成熟岛屿上下文与中文对话历史可能超过原先 90 KB 请求体限制。现在发送前仅取模型原本使用的最近五条居民记忆、最近十二条对话摘要，并去掉与模型决策无关的贴图和经济内部字段。完整本地记录保留；只把手动管家入口上限改为 256 KiB，单机与联机共用同一上限。自动模型调用频率仍为 300／600／950 秒，无 Pro 回退。

## 证据与边界

实际原生浏览器检查覆盖两套展厅、8 段经历、3 项项目、3 张图片，编辑、上传、发布、刷新恢复、访客权限、访客留言和退出后的资料清理。长中文历史的真实运行时请求字节回归，以及原有低频调用和 UTF-8 请求边界检查通过。

新视频展示当前会客馆内部，并使用当前代码录制双风格小岛、实际居民互动、管家形象、Hermes 协作记录和文件成果。[视频验证](showcase-v135.md)。小游戏仍为占位演示；这些局部检查不等于完整产品、实体 Mac 或商业验收。

## English

V135 uses existing themed room art, frames and HUD icons to present a coherent gallery interior. Its biography, chapter-based life/education/employment timeline, framed project photos, guestbook and owner editor retain the original persistence and permission rules. Uploaded photos keep their aspect ratios; draft publication remains explicit. Existing user data is preserved.

Native checks cover both appearances, eight experiences, three projects/images, editing, uploading, publication, reload persistence, guest permissions/messages and logout cleanup. All illustrated profiles, figures and project pictures are fictional examples.

A mature-island manual request could exceed the old 90 KB transport limit. Outbound memory/history is now compacted to the model's existing bounds without deleting local records. Only the manual steward endpoint uses the shared 256 KiB allowance. Automatic 300/600/950-second cadences and the fixed Flash model remain unchanged.

The new showcase includes the gallery's internal content. Minigames remain placeholders; scoped native and transport checks do not establish full product or commercial acceptance.
