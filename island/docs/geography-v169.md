# V169 · 山海地形与错落住所 / Organic terrain and resident homes

## 本次实现

连续主岛为 2304 × 1792 世界单位，含山岭、丘陵、瀑布、溪谷梯田、洞口、不规则海湾与岬角。码头和航线使用额外海面，完整世界 2528 × 2016。会客馆与主岛相连，旧连接桥不再叠加。

25 种生产建筑保留原编号，按职业区和道路错落布置。新增 16 座独立住所，各对应一名常住居民，包括 15 位 AI 与管家；临时招募伙伴仍使用居民之家的客房，人数限制不变。住所按稳定 ownerId 关联外观、姓名和交流入口。当前室内为身份与住所资料卡，完整住宅室内玩法及夜间休息属于后续阶段。

## 美术与清晰度

两套画风分别从连续主图约束生成 6 × 5 原生区域，共 60 张。另有 14 张完整广场／住宅空地区域覆盖，避免建筑被分块截断。每个原生区域的尺寸、世界范围、密度与 SHA-256 记录在 [素材来源](../public/assets/map-tiles-v169/native-provenance.json)。原生密度至少 2.79 像素／世界单位；低倍率预览由真实运行合成器生成，不代替放大后的原生区域。

接缝使用全局成对掩码与共享路径，交叉处的权重和为一；像素与折纸各使用自己的接缝路径。七块完整地形覆盖按固定顺序加载。地图按视口选择层级，完整地域仍能从预览进入高清区域。

16 种房屋每种画风单独生成完整透明素材，按稳定居民编号打包，并记录实际裁切框。房屋、名称、脚下占地、点击区域与门前入口使用同一坐标。生产建筑保留主题对应的既有素材；新增住所为独立素材。

## 移动与空间

寻路网格为 12 世界单位，优先走已绘制的道路，连续检查路段和边角，不允许从海面或悬崖侧面抄近路。固定地形的边连接预先计算，摆件与奇观碰撞继续在运行时核对。

角色每帧消费一次距离预算，可以跨越多个短路点，速度不随路点密度或刷新率变化。抵达回调只执行一次，等待回执时继续保留原回调。转向仍依据实际行进方向。

全部建筑、住所、资源场景和会客馆门前可达；码头保留步行上下船路线。十类奇观同时展出仍能通达所有公共及住宅入口。农田、林地和广场可为 16 位人物分配互不重叠的站位。

## 存档迁移

仅对服务端已校验的旧地图文档执行迁移，先保存 `before-geography-v169` 备份，再适配玩家位置、摆件空间和活动站位。金币、库存、制作记录、关系与记忆、身份、管家形象和存档编号保留。设施的空间快照同步更新，工时、付费回执与批次保持。

迁移幂等；再次打开不会重复处理。旧地形校验器仅用于验证历史文档，现有玩法使用新地图规则。恢复或导入历史备份也会迁移，不能用普通自动保存移除地图版本。空间不足时保留原文档并明确失败。

## 当前证据

[双画风原生浏览器检查](verification/v169/native-geography.json) 在隔离零库存世界实际点击木工房、走到门口、进入房间，并走到管家住所核对自定义姓名。画风切换保持同一存档，刷新能保留；所有可见原生区域与住宅素材加载成功，无页面错误或素材 404。

两套页面均在地形及环境素材加载后采集 120 个实际动画帧间隔：中位约 7.9 ms，95 分位约 8.1 ms。它只描述本机预热后的短样本，不代表冷启动零停顿、长期帧率或其他硬件表现。

规则检查包含所有门前的连续路线、16 人户外容量、十种奇观共存、不同刷新率的码头步行和长路点预算。历史存档夹具在两套画风完成迁移、备份恢复及导入，核对钱物与身份守恒。四份已有存档的私有副本已通过迁移检查，原件未用于公开媒体。

941 项玩法规则与 14 项运行时范围保护分别全部通过。[规则记录](verification/v169/rules.json) 保留此前失败说明；[会客厅](verification/v169/native-lobby.json) 和 [会客厅移动恢复](verification/v169/native-lobby-navigation.json) 也完成双画风原生验证。跨平台流水线、不可变源码包、真人和实体设备验收分别记录，不用本机检查替代。全地图四季美术、天气影响、昼夜灯光、住宅室内与居民休息作息仍在开发。

## English

The expanded mainland uses 60 independently generated native regions across two styles, with 14 complete landmark/clearing patches and 32 distinct transparent home sprites. Its 25 production IDs remain stable; each of the 15 AI residents and the steward has an individually themed home. Both styles share geometry and save identity.

Continuous road navigation, dock routes, ten wonder displays and all entrances are recalibrated. Movement spends a distance budget across consecutive waypoints. Validated legacy saves receive a backup before spatial migration; existing resources and identity are retained, including checkpoint restore/import.

Native browser input passed on both styles with loaded art, correct home identity, room entry, appearance persistence and no page errors or missing assets. Warm 120-frame samples measured about 7.9 ms median and 8.1 ms at the 95th percentile on this machine. Full seasonal artwork, weather, night lighting, residential interiors and sleep schedules are subsequent work. Human, physical Mac and long-running acceptance remain separate.
