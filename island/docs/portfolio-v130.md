# V130 岛主会客馆 / Islander Gallery

## 已实现

- 新增东岸展示庭院、连通步道和较大的会客馆；像素 / 折纸各自使用新生成的建筑与地形图。原 25 座生产建筑 ID 保留。
- 建造图鉴的“岛主会客馆”按钮可定位并打开；地图建筑可点选并寻路进入，旁边留言板可直接打开留言区。联机会客房支持主岛展馆参观。
- 个人介绍、最多 30 条经历、24 个项目；项目链接、图片预览、附件下载。PNG / JPEG / WebP / PDF / UTF-8 文本，单件 8 MiB，展馆合计 64 MiB / 100 文件，每项目最多 8 件。
- 草稿私有保存，点击发布产生公开快照；更新草稿不覆盖公开内容，撤下后附件不再向访客开放。每位 LAN 岛主数据分别落盘。
- 已登录访客可在当前主岛留言，名字从服务器身份获取；岛主可回复、隐藏 / 恢复展示。留言最多 300 件，同一身份一分钟最多 3 条。
- 内容、文件与留言保存于私有 data 下的 portfolio 目录，不写入游戏 state，随 data 备份。画风切换使用同一份展馆资料。

## 验证范围

6 个服务 / 规则检查通过；两套画风原生 Edge 实际完成布展、图片上传、发布、留言、刷新恢复；另一身份登岛参观图片与留言，未获得编辑入口。相关 25 项旧建筑、LAN 身份、大存档、共享外观检查通过。均使用虚构内容，没有处理真实用户资料或调用模型。

## 当前边界

展厅采用专属实时 HTML/CSS 展墙与上传图片；不是所有附件格式的嵌入式编辑器。PDF 和文本提供下载。上传文件暂不提供删除，删除项目不会删除本机原文件。访客需在当前会客房登入；不提供匿名公网留言。独立服务默认本机岛主可布展，不适合直接开放为匿名公网服务。

海面动画、昼夜 / 四季集中时钟、新版宣传视频、经济候选与完整原验收仍在进行；本次不表示整个开发目标完成。README 中 V108 视频为历史演示，未冒称 V130 录制。

## English

An additional east-coast Islander Gallery joins the existing 25 production venues, with connected paths and separate pixel/origami art. Access it through the building index, the map building or its guestbook board. LAN visitors see the current host's gallery.

Owners save private biographies, up to 30 experience entries and 24 projects. Publish explicitly to create a visitor-visible snapshot; draft edits do not alter it. Images, PDFs and UTF-8 text persist outside game saves, with an 8 MiB file limit, 64 MiB / 100-file total quota and eight attachments per project. Only published referenced files are accessible to guests. Signed-in guests leave server-attributed messages; owners reply, hide or restore them. Messages are capped at 300, three per identity per minute.

Six domain/service checks, 25 related regressions and two-theme native Edge owner/visitor UI flows passed using fictional content. This is scoped verification, not full-product or physical Mac acceptance. File deletion, anonymous public guestbooks, newer promotional video, environment clock/ocean effects and remaining acceptance work are not claimed complete.
