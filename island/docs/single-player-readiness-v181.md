# 单机交付与联机接续 · 2026-10-14 / Delivery readiness

这是对当前代码、已保存验证证据和本轮实际画面的核对。历史18条要求有14条仍在进行，其中混合单机、联机、OPC、真人及物理设备验收，不能换算成单机只完成4/18，也不能将历史专项测试当作当前版本完整验收。

## 已有可交付的候选基础

- V180不可变Agent源码包已形成，本机正常运行；Windows、macOS14 ARM和macOS15 Intel的部署、原生美术和原生玩法共9项CI全部成功。源提交 `a7b3f77db66d961f54f940519e193ae2a8ba9113`，[对应CI](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38463636947)。它是云端运行器证据，不能称为用户实体Mac验收。
- 25处功能建筑、16位常住角色的住所、15位AI居民与Hermes管家；两画风共享存档，角色/管家外观和自定义名字持久化；磁盘存档及回执恢复已经接入。
- 58种基础素材、308配方、19种作物及双主题152个生长阶段图；按季节播种、雨天浇水及钓鱼影响、居民班次与归家休息已有实现。每季30视觉日、每有效日900秒。
- 采集、制作、陈列、游客消费、运营成本、订单和活动已经形成可运行闭环。人物连续网格、服装工具同步和全部地图连接已有V180专项记录。
- 五类活动和主子Agent、真实本地文档工作、成果卡等已有专项证据；完整任意委托、多种系统组合和真人手感不能由这些专项自动推定。

## 单机正式签收还需要完成的6组工作

| 工作 | 当前缺口 | 验收出口 | 剩余有效工作估计 |
| --- | --- | --- | --- |
| 1. 全岛时令与夜间表现 | 扩容地图的四季原生地形未覆盖全岛；局部夜灯、窗光、水面月影未完成。旧单角季节图已停用 | 两风格全岛逐季检查，连接连续；灯光来自场景局部，无整屏色罩代替；对总时钟接口保持一致 | 12–20小时 |
| 2. 美术、住所内部与交互落点 | 本轮16栋折纸住所已重画并校准；代码中的住所仍是屋主档案和收藏说明，尚非16个可进入互动的独立室内；还需全场景素材/动作/声音检查 | 原屋主身份、门口、点击与路径正确；主题住所内部可互动；新旧画风一致，没有截断或串图 | 约8–16小时 |
| 3. 组合经济与成长 | 既有60日矩阵没有同时覆盖当前作物、招聘、升级、设施、五活动和专精全部投入 | 零开局能成长；成熟挂机缓慢盈利；主动操作有增益；现金与库存守恒；报告包含投入回本 | 6–10小时 |
| 4. 逐馆功能与完整旅程 | 25馆需在同一候选版本统一核对；真实新档到首次活动及管家委托尚缺当前版完整签收 | 每馆可完成或清楚说明材料不足，取消/领奖/重载无死锁及重复奖励；至少一条零起点完整旅程 | 5–8小时 |
| 5. 冻结版稳定性与安装 | V180有短测和平台CI，当前资产变更后仍需冻结版两主题各1小时与重开；首次加载有长帧 | 自动保存不阻断输入，无循环待确认，正常进屋移动，峰值单独记录；独立目录安装和配置/存档保留 | 3–5小时，部分等待可重叠 |
| 6. 交付与用户复核 | 最终源码包、双语说明和视频需与最终封版对应；真人验收尚缺 | 文件与提交哈希一致，视频准确展示当前能力，用户完成关键操作确认 | 4–6小时，真人时间另约 |

估算合计38–65小时有效工作，按当前范围安排约4–6天连续开发窗口；这是排程估算，不是未经验证的交付承诺。初步32–53小时估算未包含本轮核对发现的新增住所内部缺口，最终估算已补入。若仅交付测试用候选包，V180已经具备；保留用户已提出的四季、夜间、主题室内、稳定性和经营要求时，不宜现在宣称正式单机验收完成。新的严重缺陷或重画不通过会更新剩余量。没有将一天按31小时计算。

小游戏保留用户已确认的“占位演示、后续继续优化”定位；这次要求功能完整、可结算和交互稳定，不把所有小游戏都达到独立发行品质作为本轮封版门槛。OPC课程验证、商业部署和ESP32不混入单机阻塞项；原需求仍保留在原总清单。

## 联机已经实现什么

当前代码已有2/4人会客房间、邀请与队伍、每位岛主必带自己的管家、至多2位随行居民/临时伙伴、身份和物资归属、评价与订阅、同房间NPC交互记录、活动准备协作、原机桥接，以及标准A2A消息/任务查询/取消适配。

证据包括同一台Windows上的独立用户与独立进程、真实Hermes/Flash调用、官方A2A客户端及双主题UI。它们不等于两台实体设备、不受限的跨岛生产合作或任意第三方Agent都已兼容。原岛进入会客时生产暂停，也尚未形成持续在线的多岛模拟。

## 何时继续联机

现在可以开始联机下一阶段的协议、测试和范围设计，无需等待四季素材全部完成。单机先冻结一份可回退候选、完成保存/输入/基础经营的回归后，再把主要开发精力转向联机，预计上述单机收尾的4–6天窗口后；若并行推进，优先做不会修改单机核心账本的设备互访验证。

顺序建议：

1. 两台真实设备的2人登岛：本人管家和随行NPC身份不串，原机文件任务仍由原机执行，来回岛/掉线/双端重启及画风切换可恢复。
2. 一条完整跨岛合作活动：真实A2A提出/接受/分工/交付/结算，同编号不重复扣物，返程与双方记忆保留。
3. 再扩展4人并发、多个活动和长期多岛状态；以双设备事实核查为前提，不只增加房间容量字段。

第一阶段在设备可用前提下估计3–5天，4人稳定化及活动扩展再约5–8天。设备和真人可用时间需要单独排入，不能由单机模拟替代。

相关实现与历史证据：[A2A](a2a-standard-v158.md)、[原机桥接](device-bridge-v138.md)、[天气作息](weather-life-v175.md)、[经营矩阵](economy-v143.md)、[V180](terrain-animation-v180.md)。这些是版本化证据，不保证所有较旧文档中的“待开发”句子仍代表当前代码。

## English summary

V180 is a deployable test candidate, with nine successful Windows/macOS CI jobs. Formal single-player acceptance still needs whole-island seasonal artwork and local night lighting, coherent art, interactive residence interiors, combined progression/economy checks, all-venue and first-party journeys, a frozen dual-style stability run, and matching release media plus human review. The sixteen new homes currently open owner profiles with collection descriptions, not independently interactive interior rooms. Estimated remaining work is 38–65 focused hours, roughly 4–6 development days under the stated scope; this is an estimate, not an acceptance claim.

Multiplayer foundations already exist: 2/4-owner rooms, personal stewards and companions, consented A2A tasks, ownership/receipts and original-device execution. Development can continue now; prioritize a real two-device visit and one complete cooperative event before expanding concurrent multi-island play. Same-machine multi-process evidence does not replace physical multi-device or human acceptance. The mini-games retain their disclosed demonstration status while functional completion, reward integrity and input reliability are required.
