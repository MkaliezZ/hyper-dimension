# V224 · 正式物品共创 / Custom products

## 使用入口

后台 → 共创工坊 → **新增正式物品包**。为物品选择名称、建筑、用途、等级和材料，上传像素／折纸 PNG；保存、提交、审核并启用。在关联建筑完成正常小游戏后实际扣料、入库。新增组件可以继续加工；礼物、餐食、研究品和摆件沿用对应的使用方式。背包、配方图鉴和制作材料面板显示该岛自己的定义与图片。

新建第二件物品时，可用 `@编号` 消耗本作品中的组件，并将这张配方设为前置制作。解锁同时遵守原有场馆熟练度与品质条件。旧版只调整既有小游戏的 v1 挑战包继续保留。

课程和练习册见 [150 分钟课程](../public/assets/cocreation/course-v2.md) 与 [学员练习册](../public/assets/cocreation/student-workbook-v2.md)。课堂可从独立挑战练习开始，也可以直接创建正式物品。

## 发布、复用与身份

- v2 声明式作品包新增 `content.items` 与 `content.recipes`；本地编号映射成作品命名空间下的物品／配方编号，不覆盖内置目录。
- 每包最多 12 件物品、每件一张配方；每张 1–6 种材料、每种 1–20 份。拒绝自身消耗、缺少材料与循环依赖。没有脚本、自定义货币奖励或数量倍率字段。
- 基础目录仍是 58 种素材、308 张配方；旧 50／300 成就身份保持。每个岛屿独立解析自己的发布内容，不修改进程共享的基础目录。
- 审核发布绑定当前岛屿。两种画风读取同一份发布记录与游戏进度，图片仍按画风选择。
- 已接受的制作保存其原始配方快照。发布、回退或重开服务不改变正在制作的扣料数量；重试仍按原作业编号结算一次。
- 已发布物品的建筑、等级和用途不变，避免已陈列物品改变占地或场馆归属。要改这些属性需新增物品编号。名称、介绍、图片、材料和前置条件可以形成新的审核版本。
- 停用配方不删除已有成品或其名称、图片与用途。登记缺失时保留已知物品资料并停止授权新制作，重新接入审核记录后可恢复。目录容量按当前与保留的旧物品合计检查，拒绝新发布不覆盖已有档案。

## 图片与文件

每张 PNG 为 32–512 像素、8 位非交错、最多 256 KiB。服务端核对 PNG 签名、分块校验、解压大小、行过滤器、调色板和可见像素；不接受 SVG、动画 PNG、完全透明图片或可执行内容。

图片按实际字节的 SHA-256 保存，复用相同文件；声明尺寸必须与实际解码一致。游戏存档只有有界元数据，PNG 文件位于本岛私有 `_cocreation/art/`。同名摘要文件发生损坏时保留原件并报错。保存整个 `data/` 的备份会保留作品与素材；单个游戏存档 JSON 不内嵌 PNG。

导出 v2 版本生成 `hyper-dimension.bundle/v1` 封装，包含原作品与去重的实际 PNG。另一位岛主导入后需自行审核启用，随后使用自己的材料制作；不会从作品包获得免费材料、金币或成品。

上传接口：`POST /api/cocreation/{theme}/art`，JSON 字段仅 `png`（base64），返回实际摘要、尺寸与字节数。读取接口：`GET /api/cocreation/{theme}/art/{sha256}`。LAN 读取仍需登录并指定同一个岛主身份；普通图片节点使用只适用于此 GET 路径的 `island` 参数，其他操作仍使用身份标头。任意身份参数都不能越过登录用户的岛屿边界。

## 验证与当前边界

规则测试覆盖真实输入重放后的扣料、组件复用、原编号重试、旧版本材料单、回退、陈列与收回、设施快照、目录容量及缺失登记后的资料保留。HTTP 测试覆盖认证、跨岛拒绝、图片字节、双画风共用目录与导出附件。

隔离页面使用明确预置材料的虚构岛屿，通过原生输入编辑、上传、审核、制作、二次加工、赠礼、导出并在另一岛导入制作。使用正常游戏时钟与服务端规则重放，没有注入完成结果。测试 PNG 是图案夹具，不是成品美术。实际图片解码与截图检查纳入验证；早先仅检查 DOM 节点的通过结果不能证明图片显示正确。

新增物品暂未自动加入游客货架，也未接入 NPC／Agent 自动制作与跨岛分工。生态投稿审核、真人短课、更多建筑的自定义配方体验与整条长期经营验证仍在继续；不将本专项通过写成 R15 或整体交付完成。

## English

Create a v2 product pack in the co-creation workshop, upload matching pixel/origami PNGs, review and publish, then craft through normal building minigames. Canonical material consumption, component chains, direct uses and placement retain the existing authority and replay rules. Export includes actual PNG files so another owner can import, review and craft with their own inventory.

Definitions are resolved per world without mutating the built-in catalog. Accepted crafts keep their original contracts through publication and rollback. Published structural identity stays stable; retired products keep their metadata. Images require authenticated owner-scoped reads and bounded PNG validation. Native checks use fictional progressed islands and test-pattern images, not user data, accelerated clocks, real students or production-art acceptance. Visitor shelves, automatic NPC/Agent use, ecosystem review and the full delivery goal remain unfinished.
