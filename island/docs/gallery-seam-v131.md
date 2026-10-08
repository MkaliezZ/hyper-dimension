# V131 · 会客馆接缝与虚构展示档案 / Gallery seam and fictional portfolio

> 后续复核：V131 拼接仍被用户指出痕迹，V132 已改为独立会客小岛与桥梁。 / User review found remaining V131 seams; [V132 supersedes the terrain layout](gallery-seasons-v132.md).

## 中文

东岸会客馆作为主岛的一部分绘制。更新主岛东侧分块的道路开口、两画风庭院入口与边缘遮罩；对应寻路走廊同步调整，保留原有 25 个生产建筑地块及会客馆坐标。初始总览、高清分块及海浪遮罩读取同一套地形。

会客馆示例人物为 **林予舟**。档案包含个人介绍、技能与合作方向，8 段人生／教育／就业经历，3 个有问题、角色、过程、演示成果及复盘的项目，以及 3 张原创 AI 图片。人物、院校、公司、项目、指标和照片均明确标注为虚构；图片是实际附件，保存在服务端，可刷新查看并在布展编辑中替换。

新部署默认不会填充个人资料。需要演示时，在服务停止后指定目标岛屿的私有数据目录：

    node tools/gallery-demo.mjs --directory="<目标岛屿数据目录>"

联机目录通常为 data/_lan/islands/<island-id>。工具仅填充没有草稿、没有公开档案的空会客馆；存在任何个人内容时跳过。默认发布示例，重复执行不增加附件、不改写已有档案。其数据与真实用户资料均不进入公开仓库。

Windows 部署探测优先筛选 Node 游戏进程，仅在相对路径运行入口需要辨认端口时调用 TCP 枚举；冷启动探测预算为 60 秒，无法可靠检查时仍保留旧环境并明确失败。本机 23 项部署与进程边界检查通过。GitHub 三平台结果另以实际运行记录为准。

必要回归包括：示例保存、发布、刷新、重复填充、保留已有内容、双主题共享身份、道路可达性、地形总览和世界时令。原生 Windows 浏览器展示使用隔离虚构岛，检查两套画风的会客厅、8 条经历、3 个项目及 245% 地图接缝。自动检查不代表完整产品、真人或 Mac 实机验收。

## English

The east-coast gallery is rendered as part of the island. Its terrain opening, garden entry and edge masking are aligned for both appearances; navigation follows the connecting paths. Existing production parcels and gallery anchors are retained. Overview, detailed terrain and wave masks share the same terrain sources.

**Lin Yuzhou** is a clearly fictional example: a biography, skills and collaboration interests, eight life/education/work milestones, three case studies with roles, process, illustrative results and reflections, and three original AI-generated images. People, institutions, companies and metrics are fictional. Images are actual persisted server attachments that survive reload and can be replaced in the editor.

Fresh deployments do not automatically publish a personal profile. To create a demonstration, stop the service and run the command above against the intended island's private data directory. Existing drafts or publications are preserved. Re-running does not duplicate attachments or overwrite a profile.

The Windows deployment probe enumerates only relevant Node processes and reads TCP listeners only when relative entry paths require them. It has a 60-second cold-start budget and remains fail-closed if the inventory cannot be verified. Twenty-three related checks passed locally; GitHub platform results are recorded separately.

Focused domain and native-browser checks cover persistence, publication, existing-content protection, shared appearance identity, path reachability, terrain and environment integration. Screenshots use isolated fictional accounts. This is not full-product, human or physical-Mac acceptance.
