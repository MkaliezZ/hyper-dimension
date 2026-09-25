# Hyper Dimension 2D Web · DEMO


[中文](#中文) · [English](#english)

## 中文

这是公开首期仓库中的可运行 2D 前端基线，来自项目的 2D 本地演示。当前岛主“林屿”、六栋房子、卡片、文章、头像、岛屿和天空均为**演示内容**。用户可以替换名称、说明、文章、图片、视频、图标、背景、岛体和卡片链接。真实学生资料不得放入公开配置。

## 运行

在本目录执行：

~~~bash
pnpm install --frozen-lockfile
pnpm build
pnpm dev
~~~

打开本地开发服务器显示的地址。构建结果仅是公开演示页面，不包含教师测评后端或真实学生记录。

## 更换内容和素材

| 要更换的内容 | 编辑位置 |
| --- | --- |
| 网站名称、简介、首页欢迎语、头像、岛体、背景、横幅 | src/data/demoSite.ts |
| 六栋房子的名称、说明、动作和热点区域 | src/data/island.ts |
| 左下角三张信息卡的文字、图标、图片或视频 | src/data/infoCards.ts |
| 侧边栏 tag 的名称、图标和目标页 | src/components/SideBarMenu.astro |
| 岛主个人资料、作品与服务、日记文章 | src/pages/personal.astro、src/pages/projects、src/content |
| 文件本身 | public/ 目录；替换后同步修改上述引用 |

卡片可选媒体示例：在 src/data/infoCards.ts 的某张卡片加入
media: { type: "image", src: "media/my-photo.webp", alt: "图片说明" }
或
media: { type: "video", src: "media/my-video.mp4", poster: "media/poster.webp", caption: "视频说明" }。
把文件放到 public/media/。视频由用户点击播放，不自动播放。图片需要合适的 alt 文本；视频建议提供字幕或文字摘要。

替换岛体图片后，如果六栋房屋的位置不同，还须调整 src/data/island.ts 中的 polygon，确保点击区域与新房屋对齐。需要用真实教师信息时，确认公开展示授权，再把 src/data/demoSite.ts 的 isDemo 改为 false，并逐项移除或替换其它演示文案。不要只关闭 DEMO 标识而保留虚构内容。

完整可替换清单见 demo-assets.json。公开素材来源见 ASSETS.md。

## 授权边界

前端模板代码保留原作者的 MIT 声明，见 LICENSE.UPSTREAM。旧演示里的外部图标包没有纳入此公开版本；这里的导航图标是新绘制的 SVG。用户更换的图片、视频和文字需由用户自行拥有公开展示或再分发权。


## English

This runnable **2D visual DEMO** is the public island frontend baseline. Lin Yu, the six houses, cards, articles, avatar, island and sky are fictional, replaceable content. The frontend does not include the teacher assessment backend or real student records.

### Run locally

With Node.js and pnpm installed:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

### Replace content and media

| Content | Location |
| --- | --- |
| Site name, hero copy, primary images | `src/data/demoSite.ts` |
| Six houses, actions, and hit polygons | `src/data/island.ts` |
| Three footer cards and optional image/video | `src/data/infoCards.ts` |
| Sidebar labels, icons, destinations | `src/components/SideBarMenu.astro` |
| Profile, articles, portfolio and services | `src/pages/`, `src/content/` |
| Image/video files | `public/` |

For card media, use `{ type: "image", src: "media/photo.webp", alt: "Description" }` or `{ type: "video", src: "media/video.mp4", poster: "media/poster.webp", caption: "Description" }` in `src/data/infoCards.ts`, with files under `public/media/`. Videos play on user action. Recalibrate the house polygons when replacing the island artwork. Only turn off the DEMO badge after replacing all fictional content and confirming publication rights.

See [demo-assets.json](demo-assets.json) for the replacement manifest and [ASSETS.md](ASSETS.md) for provenance. The upstream MIT notice is in [LICENSE.UPSTREAM](LICENSE.UPSTREAM); old external icons were removed and replaced with newly drawn SVGs.
