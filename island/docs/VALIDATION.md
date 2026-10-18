# Validation / 验收说明

以下按版本保留历史证据；最新源码与交付状态见 README；下文保留历史版本证据。 / The README identifies current source and delivery status; historical evidence follows.

## V107 · 历史基线 / Historical baseline

## 中文

这是公开开发快照。自动测试、可部署与完整产品签收分开记录。

| 检查 | 结果与边界 |
| --- | --- |
| 默认规则 | 659 / 659 通过；真实候选与独立解压版本分别运行。 |
| Windows 部署 | Node 24.19、Python 3.11.15，独立目录离线安装及原生依赖导入通过。 |
| 四种浏览器模式 | 像素 / 折纸 × 单机 / LAN：新岛零资源、真实采集、存档、空浏览器重开；无页面或资源加载错误。 |
| 管家配方任务 | 两画风通过真实 Hermes / deepseek-flash 下发一项配方任务；居民实际走路、采矿、进工坊制作，服务器仅确认一次灯笼产出；空浏览器恢复已完成任务。未注入库存、人物位置或加速时钟。 |
| 途中改派 | 四项回归分别模拟行走中收到木料 / 矿石，验证先改道再申请作业；改前失败、改后通过，保留服务端权限门槛。此项使用明确的合成物资交付夹具。 |
| 经济 | 2 画风 × 6 场景 × 30 游戏日；真实领域规则、自动居民 / 游客过程，玩家订单输入为合成。稳定期挂机全成本日均 −5.72 至 −4.20，主动订单 +4.44 至 +5.32；无经济公式改动。 |
| macOS | 14+ ARM / Intel 条件依赖闭包与 108 个 vendor 文件摘要核对；无实体 Mac 执行。 |
| 实机视频 | 30 秒、3840 × 2160、H.264 / AAC、原创 BGM。隔离岛、真实 DeepSeek 决策、53 秒完成的三星烹饪练习，以及真实 Hermes 读取虚构资料、生成并回读 DOCX。镜头剪辑省略等待，路径遮罩；小游戏明确标为占位演示。 |

V106 已完成双画风实际一小时，V107 没有重复完整一小时。这些历史结果不能替代 V107 的最新完整验收。原始内部日志、运行标识和本机路径不公开；公开摘要保留范围和限制。

待验包括：跨设备原属管家桥接；更多真实多岛、多用户与 A2A 协作；十场真实主子合作活动；25 馆人工体验与声音打磨；完整主动经营与招聘工资、五类活动组合；OPC 新用户课程；实体 Mac 与真人签收。原有 18 项主需求仍为 4 项本地闭环、14 项进行中。

## English

This is a development snapshot. Automated checks and deployability do not constitute full product acceptance.

- **659 default checks passed**, on both the candidate and an independently extracted package.
- **Windows offline setup** passed with Node 24.19 and Python 3.11.15, including native dependency imports.
- **Four browser modes** passed: both themes in standalone and LAN modes, starting empty, gathering, saving and reopening with fresh browser storage.
- **Two native Hermes / Flash recipe assignments** completed with actual travel, mining, indoor crafting, exactly-once protected delivery and fresh-browser recovery. No stock, position or clock injection.
- **Four en-route reassignment regressions** deliberately simulate an ingredient arriving during travel. These are synthetic race fixtures, not live provider reproductions.
- **Twelve 30-day economic simulations** use real domain rules and synthetic player order inputs. Stable full-cost daily net is slightly negative for passive play and positive with one daily handmade order. This is not complete live-AI / party / hiring economic acceptance.
- **macOS dependency and package checks passed**, but physical Mac execution has not been verified.
- **The 30-second 4K video** includes an original score, actual DeepSeek decisions, a three-star kitchen practice completion (53 seconds of real play), and native Hermes producing a verified DOCX from a fictional brief. Editing omits waiting; local paths are masked. The minigames are explicitly labeled placeholder demonstrations whose gameplay, art and animation remain in development.

The prior V106 one-hour runs apply to V106. V107 has not repeated a complete one-hour run. Human quality review, physical multi-device and Mac testing, broader cooperative events, cross-device steward bridging and OPC newcomer courses remain open.


## V132 · 本轮局部验收 / Focused update

本机默认发布回归 804 / 804 通过。第一次并发运行有两项维护检查受到运行端干扰；备份／停机检查现移到并发领域测试结束后，全部原断言保留，修正后的完整执行为 790 项领域检查及 14 项维护检查全部通过。实际存档运行锁仍保守拒绝未确认写入进程。

双画风独立会客小岛与桥梁、桥旁海水约束、8 段经历／3 项项目／3 张持久化图片、16 组昼夜季节实景、8 组林地近景及六组飘落动画移动验证通过。当前季节地形覆盖北部林地，沿海棕榈与建筑屋顶保留原稿。账号与已有展馆资料经备份及更新前后核对保留。新增美术和实景见 [gallery-seasons-v132.md](gallery-seasons-v132.md)。

The default local release suite passes 804 / 804 checks: 790 domain checks followed by 14 maintenance checks. The initial concurrent run hit two maintenance collisions; running those checks after concurrent writers exit retains every assertion and passes the complete suite. Live unverified writers still block backup. Native evidence covers both bridged gallery islands, adjacent-water restrictions, fictional persistent portfolio content, sixteen environment combinations, eight forest close-ups and six falling-animation motion checks. Seasonal terrain currently covers the northern forest. Accounts and existing gallery content are preserved. These are focused checks, not full-product or physical-Mac acceptance; original outstanding scope and the refreshed showcase video remain open.


## V134 · 连续底图与时令 / Continuous terrain and seasons

807 / 807 默认发布检查通过（793 项领域检查，随后 14 项维护检查）；原断言完整保留。另有 30 项直接相关检查、双画风实际会客馆、18 项四季／暂停昼夜渲染场景、11 组高清地形加载兼容场景、4 项联机与 WebGL 回退／恢复验证通过。本机 4173 / 4174 / 4175 已核对新源码和美术文件一致，账号及会客馆文档摘要保持一致。新连续庭院与通行路径见 [continuous-terrain-v134.md](continuous-terrain-v134.md)。冷启动兼容加载仍存在最大 103–139 ms 帧间隔，稳态限定场景采样不能代替完整性能验收。

The local default release suite passes 807 / 807 checks (793 domain checks, then 14 maintenance checks). Focused domain, native gallery, environment, terrain-loading and shared-room/WebGL checks are recorded separately. All three local deployments serve matching current source/art; identity and gallery document hashes are preserved. See the current feature document for evidence and loading limitations. Physical Mac, refreshed showcase video and complete product acceptance remain open.


## V135 · 会客馆内部与新视频 / Gallery interior and refreshed video

808 / 808 默认发布检查通过（794 项领域检查，随后 14 项维护检查），原断言保留并纳入长中文管家请求回归。双风格会客馆原生展示和实际编辑／上传／发布／刷新／访客留言通过；1280 × 720、680 × 860、390 × 844 各两套风格均无横向溢出，滚动后关闭按钮保持固定。

本次 30／45 秒宣传片从当前代码重新录制，2560 × 1440、60 fps，含馆内介绍、经历、项目图片和留言，也展示真实 Flash 居民互动、管家形象、Hermes 协商与实际创建／回读的 Word 文件。虚构档案、工作资料和小游戏占位身份在成片中明确标注。[会客馆](gallery-ui-v135.md) · [成片验证](showcase-v135.md)。旧 V107／V108 视频仍属历史记录；完整产品、实体 Mac、真人和商业验收仍待完成。

The current default suite passes 808 / 808 checks (794 domain checks followed by 14 maintenance checks). Both themed gallery flows and six responsive-layout cases passed. Current 1440p60 footage includes the actual gallery interior and real provider/tool evidence, with fictional content and placeholder minigames explicitly labeled. These scoped checks do not close the original full-product acceptance scope.


## V136 · 管家异常恢复 / Steward recovery

816 / 816 默认检查通过（802 项领域检查，随后 14 项维护检查），包含八项新的持久化／进程争抢／写入后中断检查。双画风原生联机页面通过四类异常场景及权限验证，执行端为写入真实隔离文件的夹具；双画风单机页面另用真实 Hermes／deepseek-flash 文档工具加一、保存回读，在丢失回复、空浏览器重开及同编号 HTTP 重试后保持文件为 1，每种画风只有一次手动模型委托。[恢复协议与证据](steward-recovery-v136.md)。

The default suite passes 816 / 816 checks (802 domain, then 14 maintenance), including eight new durable-receipt and process/race checks. Both themed native LAN flows cover four interruption cases and owner/authentication boundaries with an isolated file-writing fixture. Separate native standalone runs use real Hermes/deepseek-flash tools: each numeric file remains 1 after a lost reply, empty-browser recovery and an identical HTTP replay, with one manual model request per style. This focused result does not close the original full-game, long-term or human acceptance scope.

## V137 · 跨岛通信与首盏灯 / Correspondence and first crafting

默认必要检查 832 / 832 通过：818 项领域检查，随后 14 项维护检查。 / Default checks pass 832 / 832: 818 domain checks, followed by 14 maintenance checks.

双画风原生浏览器已使用两名各自隔离的真实 Hermes／deepseek-flash 管家互相回信：每位管家的独立运行账本记录一轮通信，上一轮关联一致；丢失 HTTP 确认后重试原编号没有额外模型调用，刷新可恢复两封信件。390 像素宽的界面无横向溢出，顶部关闭按钮始终可见，信息信件不会误入活动物资面板，访客离岛会停止继续往来。同服务器运行，不代表访客原设备桥接。

Both native themes pass two-owner real Hermes/deepseek-flash correspondence with separate run ledgers and linked turns. Replaying a lost HTTP acknowledgement creates no extra model request. Reload restores both letters; the 390-pixel panel has no horizontal overflow and retains its fixed close control. Activity UI remains separate, and departure closes the exchange. This is same-server owner isolation, not an original-device bridge.

首日新档在两种画风均完成实际砍木、订单交付、通过手账导航开采石英与采集蜂蜡／纤维、正式拼合制作星灯、里程碑领种、锄地／播种／浇水、真实等待成熟收获、成品订单收益及空浏览器重开。种植等待实际约184和186秒。全程未注入库存、金币、时间或小游戏品质；本项隔离 UI 测试阻断外部模型。验证首日这条操作链，不代替全部小游戏、完整多人或真人验收。

Both fresh-island flows pass actual resource gathering using the updated journal buttons, production (not practice), order payment, milestone seeds, hoe/sow/water, actual crop waiting (about 184/186 seconds), harvest and empty-browser recovery. No stock, currency, clock or quality injection is used; provider calls are blocked in this focused journey check. Full workshop, multiplayer and human acceptance remain separate. [Implementation and player flow](a2a-information-v137.md).
### V137 补验 · 管家姓名与 macOS 临时目录

现有自定义姓名功能保留，并修复保存成功后档案界面无法返回的问题：服务端回填会替换状态对象，编辑保护现在核对稳定的存档身份和画风。隔离浏览器实测改名写入本机服务端、刷新保留、折纸／像素切换保留、空浏览器恢复与随行角色读取均通过；未改动用户存档。

macOS ARM 的新增通信检查曾被系统临时目录 `/var` 的符号链接拦截。仅将测试临时目录解析为真实路径；产品数据目录的符号链接保护继续保留。Windows 及 macOS 的最终发布检查以修复后同一提交为准，旧失败记录仍保留。

Existing name customization is preserved. Successful saves now return from the editor after server state replacement, using stable world identity checks. Actual isolated browser checks cover disk persistence, reload, both art styles, empty-browser restore and visiting actor projection. The macOS information-test fixture resolves the system temporary directory without weakening production data-path checks.

## V138 · 原机工作区与随行管家 / Original-device workspace

21/21桥接／信息通信／活动通信回归通过。双画风原生 UI 配对、标记确认、刷新保留与窄屏固定关闭通过；两个独立原机 CLI 与真实 Hermes／deepseek-flash 完成虚构文件读取、修改、回读以及有署名和运行关联的岛屿信息交流。原机和服务一起重启后保留结果，不重做文件操作。

Focused bridge/information/activity regressions pass 21/21. Both native themes pass pairing, owner confirmation, refresh, compact layout and fixed close controls. Two original-device CLI processes use real Hermes/deepseek-flash for fictional file read/edit/read-back and linked, attributed island correspondence. Transport and restart tests retain completed results without repeating tools. The real provider test used separate processes on one Windows machine; physical cross-device/Mac and whole-project acceptance remain distinct. [部署、数据范围与边界](device-bridge-v138.md)。

V138 默认领域检查827项通过；首次维护检查有两项被同时运行的真实录制 Agent 阻挡。停止录制后单独重跑14项维护检查全部通过，保护规则未放宽。 / All827 domain checks pass; concurrent real recording agents initially block two maintenance checks. After recording stops, all14 maintenance checks pass with existing data protection unchanged.

## V139 · 绘画委托升级 / Drawing commissions

工艺学院绘画改为四类随机风物，5／7／9 笔难度，连续轨迹、配色、墨量、晾干和最终装裱评审；旧三笔作业仍可恢复。相关92项回归与双画风真实鼠标制作／刷新／窄屏结算通过。小游戏集合的真人手感、完整动画素材与全产品验收继续保留原有未完成项。[玩法与证据](brush-studio-v139.md)。

Four seeded painting motifs use progressive stroke counts, continuous path checks, palette/ink/drying decisions and framing review. Legacy sessions remain compatible. Focused92-case regressions and native dual-theme production/reload/compact-result checks pass. Human feel and whole-product acceptance remain separate.

## V140 · 真实主子活动连续验证 / Continuous real delegation journey

双画风隔离演示岛完成实际 Hermes／deepseek-flash 招聘、正常时钟乘船／栈桥／工位制作、亲自邀请、夜集领取、贡献回执、工资与离岛归档、刷新保留。修复同步存档重复取消和迟到回调打断新行动。53项最终直接回归与10项招聘协议通过；76项协作／收藏相关回归另记，存在重叠。测试为有生活物资的单机演示岛，不代替零起点、物理设备、真人与全产品验收。[完整范围](recruitment-v140.md)。

Both native styles pass a continuous real-provider delegation journey with normal movement/production, authoritative results, wages, departure and reload. Fixture scope and acceptance limits remain explicit.

## V140 修订 · 地图居民身份 / Map picking revision

修复姓名牌与脚底命中范围不一致、重叠居民按数组顺序误选的问题；地图身体、姓名与气泡共用稳定身份。8项直接回归、两种画风各18次真实鼠标点击通过，包含全部15名AI居民、管家与缩放拖拽后的黎音姓名。[说明与证据](npc-map-identity.md)。

Rendered nameplates and bodies now select the same stable resident identity. Eight focused tests and36 native clicks across both art styles pass.


## V141 · 星图夜集 / Starlight gathering

基础夜集新增四幕随机星点、持续横风与云带、原生瞄准和一次空中修正；保留原费用、奖励、邀请同意、贡献和纪念品规则。旧进行中作业保留节奏玩法版本。默认回归878项通过（864领域、14维护）；双画风原生输入、触控、飞行中刷新、丢失结算回复、三居民方案与礼物／再同意、经典连连看与三消恢复通过。双画风真正零库存／零币、正常时钟完整完成采集、正式制作、约181秒实际成熟等待、订单、居民备料、亲自邀请、实际道路到场、四幕夜集、纪念品及空浏览器恢复。隔离数据未调用模型，真实物理设备、真人手感和完整验收继续保留原有范围。[说明与脱敏证据](night-sky-v141.md)。

Both themes pass native input/recovery, three-resident consent and gifts, classic-game recovery and a genuinely zero-stock first-day journey through farming, resident deliveries, attendance, a four-flight gathering, authoritative rewards and empty-browser restore. The default gate passes878 checks. These focused isolated tests use the normal clock and no provider calls; they do not replace human, physical Mac or whole-product acceptance.

V141 追加地图交互复核：双画风原生空地点击、居民弹窗关闭、建筑到达及进入；叠加恢复锁释放和会客准备／关闭均通过。[记录](map-navigation-v141.md)。


## V142 — 双灶空间切配（2026-10-09）

已取得双画风的原生鼠标、手机触摸、空格、正常时间双灶、磁盘刷新续玩和单次料理结算证据；旧厨房规则保持兼容。[玩法与验收](kitchen-v142.md)。本项不覆盖真人体验、真实模型或长期经济；原全目标验收范围保持。


## V143 · 经营趋势与慢增长（2026-10-09）

成熟经营允许小幅挂机盈余；保留V105现金报价与预算。双风格12场景各60日模拟通过，成熟挂机平均净收益8.4–10岛币／日；时间与玩家输入是合成，模型屏蔽。近期七个日结的完整预算、接待与主动收支分开核算；双风格桌面/390px/关闭重开/刷新通过。原五活动、招聘、升级、真人和完整验收仍保留。[规则与范围](economy-v143.md)。


### V142 冻结版一小时追加复核（2026-10-09）

双画风真实60分钟、实际DeepSeek/Hermes、空浏览器恢复和1569载荷前后哈希一致通过；帧峰值、两次低频429及三次完整日结保留原值。[数据与范围](frozen-hour-v142.md)。此项不覆盖V143或全产品验收。


## V144 · 2026-10-09 · 居民空间声音

附近四名居民按距离及左右声道发声，实际步态／工具触碰／说话跟随现有动作；暂停和场景切换不补播。16声音专项与双画风原生声道路由、静音、偏好恢复通过。真人试听、完整动画声音与全部原范围继续。[规则与证据](spatial-sound-v144.md)。另附V143真实零起点Flash/Hermes父子活动证据，保持实际版本标记。


## V145 · 管家发送顺序 / Steward submission order

居民作业正在结算时，管家会等待回执再保存并寄出，减少短暂结算导致的发送失败。双画风原生UI验证：延迟期间零发送，恢复后唯一发送；离线和未确认作业仍保留恢复流程。[说明与证据](steward-preflight-v145.md)。

The steward waits for in-flight game receipts before saving and submitting. Native dual-theme delayed-receipt checks confirm zero early calls and one eventual submission; unresolved failures retain explicit recovery.


## V146 · 地图存档冲突 / Map save conflicts

明确的版本拒绝会安全合并独立修改；无法合并时显示可点击的恢复入口。双画风地图移动、房屋进入及恢复回归通过。[说明](map-save-conflict-v146.md)。

Definite version rejections preserve independent edits. Overlapping edits expose a clickable recovery flow with a retained backup. Native map movement and building entry passed in both appearances.


## V147 · 主题鼠标 / Theme cursors

双画风原创鼠标覆盖地图、按钮、拖拽、输入、禁用和保存等待。素材与原生地图交互检查通过。[说明](theme-cursors-v147.md)。

Original cursors follow the active appearance across navigation, interactions, dragging, text input and save status.


## V148 · UI 与联机显示修复

主题鼠标、身份重试、同档画风切换、放大会客地图、NPC 动画同步及会客馆预加载。[说明与证据](ui-reliability-v148.md)。


## V149 · 渲染快照检查

NPC 原生回归等待实际帧，并核对同一服务器时间戳后执行严格朝向断言。[CI原因与重跑](browser-snapshot-v149.md)。


## V150 · 存档恢复导航检查

恢复回归从点击前监听实际刷新并确认新页面上下文，再读取备份；保留全部业务断言。[失败记录与修正](recovery-navigation-v150.md)。


## V151 · 会客地图提示与缓存计时

正常点击不再闪现核对卡片；旧轮询结果不覆盖动作。失败重试仍使用原编号。缓存打开分开记录驱动墙钟与真实浏览器点击到可见绘制，保留1500ms标准。[原因与双画风证据](lobby-navigation-v151.md)。三平台结果以本提交CI为准。


## V152 · 堵停与窗口恢复

只插值已确认位置，避免预测后回拉；窗口恢复重置帧计时/插值/步态，跳过近零路径节点。[说明与回归](lobby-motion-v152.md)。V151同提交三平台通过；V152另行核对。

## V153 · 立绘

原生双主题实际形象选择与服务端确认、刷新同档、窄屏及六处截图探针通过；24 个可选立绘和两套默认管家截图已查看。源图未重画。V153 的交付包、平台检查和一小时均按版本分别记录，不能套用 V152 的结果。完整 18R/28F/30T 范围仍未完成。

## V154 · 基础材料裁切

双画风 100 个真实图标经过 SVG、场景与手持原生渲染，共 300 个显示面；非空、SVG 留白及四处已知邻图探针通过。开发 Agent 查看截图；不是全部素材语义或真人验收。V152 真实一小时完成不冒称 V154 一小时，完整 18R/28F/30T 范围尚未完成。


## V155–V164 · 后续校验范围

材料/产物裁切、实际制作与刷新、标准 A2A、肥料用途、刷新基线和 Windows 文件锁按对应提交分别留存。V162 默认 930 项本机通过，但跨平台 4/6；V163 提供实际失败阶段。V164 修复首次 NPC 产出导致的发现标记差异，原产量不变；完整结果继续验证。[V164 原因与范围](npc-gain-reload-v164.md)。当前公开 V158、本机 V160，后续源码不自动替换公开包或旧证据。

Later evidence remains version-specific. V162 passed 930 local checks but four of six platform jobs; V163 exposes actual failure phases. V164 fixes first-NPC discovery/snapshot consistency with original yields retained. Full verification remains pending; public V158 and local V160 remain current.


## V165 · 恢复保存与旧发现记录

V164 完整 CI 最终 4/6：Windows/Intel Mac 农田刷新恢复失败。V165 合并恢复期间重复保存，并从已确认库存修复旧发现标记；6 项新增针对性检查通过，完整原生/平台结果另计。[范围与边界](recovery-checkpoints-v165.md)。本机 V160、公开 V158 暂不替换。


## V166 · Windows 时钟锁

V165 Windows 规则检查暴露并发首次创建时钟锁的 EPERM；接入既有有界 exclusive-open 重试后，本机 22 项时钟/锁检查通过。[范围](environment-lock-v166.md)。完整平台另验，V165 独立包 945 项证据保持其版本，不转记给 V166。


## V167 · 启动与画风事务绘制暂停

V166 全平台最终 5/6（Intel 折纸农田刷新失败）。V167 让存档恢复期间的世界绘制让出 CPU，16 项真实孤立作业的双主题降速核对、8 项刷新故障与双主题会客厅检查通过。完整平台另验；V166 独立包与新视频保留各自版本。[范围](startup-render-v167.md)。


## V168 · 制作领奖

V167 全平台最终 5/6，Windows 折纸温室领奖等待失败。排队领奖等待真实保存回包后结算，双画风领取/取消与保护重开通过；原时间与资源断言保留。管家 26 张立绘复核通过。本次完整 CI、独立包与真人/实体设备分别验证。[范围](reward-confirmation-v168.md)。


## V169 · 地形与住所扩容

941 项玩法规则与 14 项运行时范围保护通过；双画风原生进屋、住所身份、画风持久化和会客厅导航通过。新地图为 60 张独立原生区域、14 张完整地标覆盖与 32 个住所原图。历史存档先备份后适配；住宅室内、全图四季、天气、昼夜灯光及休息作息仍在开发。跨平台与不可变包另验。新版 30 秒影片包含 V169 新画面和明确标注的三段 V166 实录。[实现与范围](geography-v169.md)。


## V170 · 制作并发确认

V169完整CI为5/6，Intel折纸温室领奖等待失败。已复现成功居民事务挤入制作确认后使领奖或取消丢失。等待队列确认的修复通过六个并发／丢包恢复原生场景、四个原领取／取消与22规则；单次成本、回执和原场景时限保持。完整平台与不可变包另验，当前本机仍V169。[范围](reward-drain-v170.md)。


## V171 · 会客连续移动与地块校准

双画风原生快速改点与移动样本通过；每画风实际观察7位移动NPC，普通移动没有重建页面或短暂确认弹窗。旧会客原档备份与迁移、丢包同编号恢复、进入建筑及住所身份、画风共享刷新通过。PNG原件核对、完整房屋裁切重建与47处入口可达性通过。见[lobby-ground-v171](lobby-ground-v171.md)。该记录属于本机隔离原生与规则验证，完整平台CI独立追踪。

V170不可变包现已公开发布，目标提交01f2228c76389a5d9a0066a9a3aa5e3681c6e696；该头的六个平台检查全部通过，包SHA为bae06f8d261aa9ed3c6d33d31eebd4415447f3215996617dc30c73fed6a9f63d。独立离线955/955与六个并发领取／恢复场景通过。原V169失败、V168后续重复运行失败和当时的通过记录均保留。


## V172 · 保存占锁与入口恢复（2026-10-13）

[本次原因、修复、实测与未通过的平台项目](save-entry-v172.md)。完整规则回归 967/967 通过，新增 4 项规则及双画风原生入口恢复通过。完整发布验收不据此升级。


## V173 · 低帧率导航与会客补间（2026-10-13）

双画风 8／15 帧真实农田导航、10 帧会客连续改点与换路、完整施肥生长收获流程通过。修正 Mac 测试临时目录及多目录数据锁遗漏。[原因、测试口径与范围](frame-motion-v173.md)。上一版 V172 CI 为 3/6，本版本云端与独立交付包另验。


## V174 · 原生地块与房屋校准

两主题 82 个落点完成贴图合成审查；重点修正潮汐船屋、船坞、邮局、露营站，窄地块保持等比缩放。渲染/名称/点击统一几何数据，地面碰撞与通路缓存同步。新增 5 项校准规则通过，既有全入口与奇观路径检查通过。详见 [校准说明](parcel-alignment-v174.md)。本记录不替代完整云端与真人验收。

V174 本地完整规则 984/984 通过；本机双风格实际点击与邮局进入室内通过。现有私人数据更新前后 816 文件哈希一致，已制作并验证备份。


## V175 · 时令玩法、作息与有效时间

默认回归 1020/1020 通过；两风格实际低帧率耕种、晴/雨/雪原生页面与服务端农田结果、居民归家及受邀夜集规则通过。保持自动调用频率和收益上限，未宣称完整四季底图或夜间灯光完成。Mac Intel 的导航慢帧仍需本版本云端诊断。[范围与证据](weather-life-v175.md)。


V175 云端终态补记：运行 38388258952 六项全部成功。Mac Intel 原生施肥、生长、收获与刷新双主题通过，实际生长分别 198.312 / 199.821 秒；旧失败记录保留。[CI](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38388258952)。

## V176 · 季节作物、食品与采收

默认回归 1071/1071 通过，0 跳过（1057 领域规则 + 14 运行目录保护）。新增八种作物、八个食品配方与双主题 96 个美术单元；原生物品检查 116 素材与 616 制作品，覆盖 SVG、场景和手持，并保留旧串图探针。两风格各三种代表配方通过原生输入、服务端回放、唯一领取和刷新；烘焙文案另有两例复核。两风格实际农田16图均已加载且尺寸正确，两次真实采收回执通过。旧档零库存迁移、材料预留与历史回执兼容通过。

作物与食品的数量、季节、产量、成本、用途和边界见[季节内容说明](seasonal-content-v176.md)。原生验收使用隔离备料存档，不表示零起点、人类体验、长时平衡或八道食谱全难度完成。完整四季地形、旧十一种作物专用四阶段图和物理夜间灯光仍未完成；V176 云端检查和独立源码包另外记录。


### V176 interaction and parcel follow-up

The final default command passed **1071/1071** (1057 domain checks plus 14 runtime-scope checks), with no failures or skips. Both themes passed actual boatyard/fireworks map clicks, walking and indoor entry. The wardrobe comparison passed normal and delayed transport, deliberate lost-response recovery, one actual output and reload checks. Shared controller and held-input tests remain separate bounded evidence; see [the interaction notes](minigame-input-v176.md). Full seasonal terrain, all legacy crop growth art, physical night lighting and human acceptance are still separate work.


## V178 · 全作物生长美术 / Crop growth art



最终默认检查 1078/1078 通过（1064 领域规则 + 14 运行目录保护），0 失败、0 跳过。两画风 88 个阶段实际绘制通过；两组农田共四次原生浏览器检查覆盖 11 个旧作物、19 个已加载作物资源，实际麦穗割取和胡萝卜拔取各获得作物2、种子1，刷新不重复。

The final default gate passed 1078/1078 (1064 domain checks and 14 runtime guards), without failures or skips. All 88 native legacy stages rendered; four native farm cases cover all eleven legacy crops and all nineteen loaded crop resources. Wheat cutting and carrot pulling each received two crops and one seed, without duplicate gains after reload.

见 [V178 美术和验证](legacy-crop-art-v178.md)。原生成 PNG、完整裁切、土壤锚点和两个画风各自来源已记录；四季全岛地形、夜间实体灯光及完整真人验收继续。


## V179 · 后台作业、移动与 CI 时序 / Work and navigation

最终默认检查 **1095/1095** 通过（1081 领域规则 + 14 运行目录保护），0 失败、0 跳过。两画风 8/15 FPS 四组真实导航保留原断言通过；六组奖励、取消与丢失回执恢复通过。晴天夹具中 NPC 实际播种与浇水保留20秒动作，独立已批准居民回执暂缓期间动作仍结束、等待姿态停止，原田地在农活回执前保持原阶段；唯一耗种、浇水与刷新通过。

The final default gate passed **1095/1095** (1081 domain checks and 14 runtime guards), without failures or skips. Four native 8/15 FPS navigation cases retain their original assertions; all six reward/cancel/recovery cases passed. Sunny NPC fixtures complete actual 20-second sow and water work while unrelated accepted replies are held, without changing soil before the farm receipt or duplicating seed costs after reload.

V178 run 38418522784 has three successful jobs, two failed jobs and one timed-out job: the macOS 14 reward barrier race and Intel slow-frame navigation are distinct findings. Catalog art and native gameplay now run in independent jobs while preserving every original check; the new head requires fresh cloud verification. Native/fixture checks do not replace physical Mac, human, full-day schedule or whole-product acceptance. [Implementation and scope](navigation-arrival-v179.md).


## V180 · 连续人物与所有地形连接 / Connected animation and every terrain join

默认门1102项：1088领域规则通过，14运行目录保护在沙箱进程查询拒绝后以本机读权限重跑通过。双画风解码448个人物帧，审查3136个七类动作图样和480个穿衣工具组合；全部98个区域连接与20处补绘周边有逐项原生审查。6张局部原生PNG接入，原生产地块和寻路坐标保留。真实浏览器夹具的工坊/管家住所、换风格、刷新通过；模型调用关闭。初始化与后台加载长帧单独保留。V179云端为8成功、1取消，Intel部署45分钟时取消且checkout占约30分钟；该任务预算更新为60分钟，新提交尚需独立云端结果。[完整范围](terrain-animation-v180.md)。

The required gate passed 1102 checks: 1088 domain checks and 14 runtime guards; the guards were rerun with local process-inventory permissions after a sandbox denial, without changing assertions. Native review covers 448 decoded character frames, 3136 action samples, 480 dressed-tool samples, all 98 regional joins and 20 landmark/repair perimeters. Six unmodified generated PNGs repair local joins without relocating production/navigation geometry. Isolated browser entry, shared-style switching and reload checks passed with models disabled. Cold and background-loading stalls are retained. V179 had eight successful jobs and one cancelled Intel deployment job; its checkout took about 30 minutes of the 45-minute limit. The deployment job budget is now 60 minutes; the new head needs fresh cloud results.


V180云端终态补记：提交 `a7b3f77db66d961f54f940519e193ae2a8ba9113` 的9项Windows、macOS14、macOS15 Intel检查全部成功。[运行38463636947](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38463636947)。旧取消记录保留。

## V181 · 折纸住所与交付范围核对

16栋新增折纸住所重画为与原建筑一致的宽纸面和折痕风格，完整透明连通区取样与门口轴重新校准。原像素素材、地块、路径及存档结构不变。14项现有地形、迁移及建筑身份检查通过。本机实际总览与住所入口核对另存私人证据。新提交的全平台检查单独记录。[素材与范围](origami-homes-v181.md) · [单机与联机接续评估](single-player-readiness-v181.md)。

Sixteen origami residences now follow the existing paper-building language. Complete connected-component crops and door axes preserve identity and placement. Fourteen existing geometry, migration and navigation checks passed; pixel art and world/save structure are unchanged. The new commit requires its own cloud results. See the linked readiness review for remaining single-player gates and multiplayer work.


## V182 · 领奖回执拦截与全动作复查

Intel Mac 原生玩法检查修复结果回执拦截时序；四个延迟领奖、六个独立回执/恢复场景通过。人物动作复查扩展到待机、走路、锄地、采矿、伐木、播种、收获及穿衣浇水，双画风448个方向帧和480个穿衣工具样本通过。[修复与验证](docs/reward-checkpoint-v182.md)。V182云端结果单独跟进。

The Intel Mac native-gameplay fixture now holds the accepted winning checkpoint independently of result-panel paint timing. Four delayed-claim and six independent-receipt/recovery cases pass. Native action review now includes idle, walk, hoe, mining, chopping, sowing, harvesting and clothed watering: 448 direction frames and 480 dressed/tool samples across both styles. [Fix and validation](docs/reward-checkpoint-v182.md). V182 cloud results are tracked separately.


## V184 · 原生领奖夹具与自主生产隔离

Intel Mac 领奖取消夹具已在运行前暂停自主NPC生产，避免长时间测试期间的新采集干扰精确库存断言。四个延迟领奖/取消、六个独立回执/断线恢复场景本地通过，真实居民回执及原单次结算断言保留。[修复与证据](docs/reward-fixture-v184.md)。新提交云端结果继续核对。

Native reward fixtures now suspend autonomous NPC production before runtime initialization, preventing unrelated gathering from changing exact cancellation inventory assertions on longer Intel runs. Four delayed-claim/cancel and six independent-receipt/recovery cases pass locally, retaining actual resident receipts and all original single-settlement checks. [Fix and evidence](docs/reward-fixture-v184.md). New cloud results remain pending.


## V185 · 原生弹窗导航与失败诊断

Intel Mac原生玩法已在V184云端通过。Mac ARM订单弹窗检查补齐启动条件、隔离生产与恢复现场诊断；双画风12个真实命令/原生关闭/晚到回执/刷新场景本地通过，新增对应CI失败附件。[范围与证据](docs/modal-navigation-v185.md)。Mac ARM新提交云端结果另行跟进。

Intel Mac native gameplay passed in V184. The Mac ARM modal-navigation fixture now waits for completed startup, isolates autonomous production and records recovery diagnostics. Twelve dual-style native command/close/late-acknowledgement/reload cases pass locally, with retained CI failure artifacts. [Scope and evidence](docs/modal-navigation-v185.md). The new Mac ARM cloud result is tracked separately.


## V186 · 自然换季边界

修复自然跨过第30视觉日时未记录季节过渡，以及切回窗口后的换季检测；18项时钟与服务检查通过。V185的Windows与两种Mac云端9项检查已全部成功。[换季修复与美术进度](docs/season-boundary-v186.md)。原生四季底图尚在制作，未作为完整换季上线。

Natural thirtieth-day boundaries and hidden-window recovery now record the season transition without restarting it on every frame or clock refresh. Eighteen focused clock/service checks pass; all nine V185 Windows/macOS cloud jobs succeeded. [Fix and artwork scope](docs/season-boundary-v186.md). Complete native seasonal terrain is still in production.


## V187 · 整岛四季底图

整岛四季底图现已覆盖像素与折纸两种画风：新增280张区域、连接与预览素材。换季等待可见区域加载齐全后过渡，缺图保留上一季；拖拽到新区域显示同季节预览。两种画风、小岛/会客房、四季共16组实际渲染检查通过，33项相关测试通过。[四季素材与验证范围](docs/native-seasons-v187.md)。

Whole-island seasonal terrain is now connected in both styles, with 280 regional, join and preview images. Transitions wait for the visible view; failed loads retain the previous season and cold pans use the current season preview. All 16 actual home/meeting-room seasonal cases and 33 focused checks passed locally. [Artwork and validation scope](docs/native-seasons-v187.md).


## V188 · Mac检查时序与退出

修正Intel Mac导航检查的计时起点，并补齐领奖测试退出时异步请求的收尾和失败记录。双画风8/15 FPS寻路4组、领奖/取消/断线核对6组本地通过，原移动时限和单次结算断言保留。[修复与验证范围](docs/mac-checks-v188.md)。新云端结果待核对；新版视频正使用当前四季底图重新录制。

Fixed the navigation harness timing baseline and reward-interceptor teardown reporting. Four dual-style 8/15 FPS navigation cases and six reward/cancel/recovery cases passed locally, with original travel and settlement assertions retained. [Scope and evidence](docs/mac-checks-v188.md). Cloud results remain pending; new footage is being recorded on the current seasonal terrain.

## V191 · Independent residence interiors

Wheat Cottage and Joinery House now have different native pixel/origami interior paintings, individually calibrated floor navigation and furniture interactions. Their daily nursery and sliding-picture hobbies save non-economic journal entries through the existing personal-action ledger. Old personal snapshots without the optional home record remain compatible. The remaining fourteen homes still require their own art and interaction work; see [residence design](residence-interiors-v191.md).

Eleven focused home and personal-ledger tests passed, including reachable furniture, seasonal puzzle solvability, legal slide replay, old-book compatibility, duplicate requests, forged autosaves and unchanged currency/inventory. Four native browser cases cover both homes and both styles, actual game inputs, server records, reload and close. A narrower mobile follow-up checks that labels become numbered markers plus readable shortcuts. The LAN browser check verifies /play, the real personal action, appearance switching and a shared persisted home record. These isolated local fixtures do not prove all sixteen homes, physical Mac use or human acceptance.

Run `npm run test:homes` and `npm run test:homes:browser`. No paid model calls or real user saves are needed by these checks. README updates remain functional only.

## V192 · Host and observer homes

Two more independent pixel/origami homes are playable: Lulu's gathering room and Xingye's curved observatory. Four original images have separate collision/interaction calibration, including a repainted observatory passage. Seating cards use a unique daily solution; fictional sky logs identify stars by bearing, colour, brightness and order. Both save through the personal ledger without economic rewards. Four of sixteen homes now have playable interiors; twelve remain.

Twenty focused rules passed across home navigation, daily challenge solvability, duplicate commits, restart, forged state rejection, unchanged economy and shared appearance. Four new native browser cases cover both houses/styles, every furniture approach, actual puzzle inputs, completion, save/reload, mobile labels and close. These checks use isolated fictional saves at fresh ports and no external model calls; they never operate on the user's browser or private saves. Follow-up LAN cases check the real personal action and style-switch persistence. Original farmer/carpenter rooms are also regression checked after extending the shared UI. This is not all-home, physical multi-device, Mac hardware or human acceptance.

Run `npm run test:homes` and `npm run test:homes:browser`. For the host LAN case, set `HD_HOME_ID=2` before `node tests/v192-social-homes-lan-browser.mjs`; the default is the observatory.

## V193 · Florist and shipwright homes

Two independently planned houses add the florist's glasshouse, pressed-flower desk and curtained bed, and the shipwright's curved cabin with map table, repair bench and built-in berth. Four original images cover pixel and origami. Daily pressed-specimen arrangements and rotating rope boards have server-validated solutions and persistent personal journals, without economic rewards. Six of sixteen homes now have playable interiors; ten remain.

23 focused rules passed, including navigation between all furniture approaches, challenge variation and solvability, fixed rope terminals, duplicate/forged requests, restart, unchanged inventory and shared appearance. Four native browser cases cover both new houses/styles, real puzzle input, completion, save/reload, mobile close and asset loading. Two isolated LAN cases verify the personal action and journal after style switch and reload. Two prior homes are regression checked through their activities. All use fictional isolated saves at fresh ports and no external model calls; no live user browser or saves are used. These are not physical Mac, multi-device or human acceptance.

Run `npm run test:homes` and `npm run test:homes:browser`. For the florist LAN case set `HD_HOME_ID=4` before `node tests/v193-craft-homes-lan-browser.mjs`; default is the shipwright.

The preceding deployment workflow 38751583983 has a macOS Intel native queued-reward failure: a checkpoint request aborted while the test awaited the crafting result. Its diagnostic log is retained for follow-up; this residence iteration does not claim to repair that failure or complete cross-platform acceptance.

## V194 · Result presentation and movement receipt recovery

The macOS Intel queued-reward failure in run 38751583983 was reproduced locally: after genuine winning inputs, an intentionally slow 750 ms workshop render interval stretched the 2.6-second result reveal past the 12-second checkpoint deadline. The last accepted response was held by the native test, and the aborted checkpoint then paused the reveal indefinitely. Completed results now reveal using visible elapsed time; active gameplay retains its existing capped simulation steps. Result particles and stars use the same presentation clock, reset when visibility changes. Scoring, input replay and reward authority are unchanged.

Before the change, the isolated slow-frame test remained in celebration and timed out. Afterward, all four pixel/origami claim/cancel cases revealed in about 2.9 seconds. Four ordinary queued-reward cases and six independent-receipt/cancel-recovery cases also passed. The regression holds a real accepted winning checkpoint, uses real board input and preserves exactly-once rewards; it does not fabricate a score or grant a finished product.

The separate Windows motion failure in run 38758781361 retained an unconfirmed movement request and displayed recovery UI. Its original transport failure was not retained, so its precise trigger is not yet established. An isolated lost-successful-receipt test reproduces the user-visible symptom: without recovery, walking keeps the old destination, drops the newest queued destination and rebuilds the room to show a manual confirmation. Recoverable movement failures now retry the same durable request ID at most twice. Confirmed invalid input or lost authentication still stops immediately; other room actions are unchanged. If retries fail, the original pending request remains available for explicit recovery. Native diagnostics now retain requests, replay flags, toasts and DOM rebuild counts on failure. Both styles passed the lost-receipt and busy-response native cases with zero unwanted UI rebuilds/toasts. 33 focused rules passed, including reward authority, the movement queue and locked-store handling.

All checks use fictional identities/saves, fresh loopback ports and disabled model providers. They do not access the user's active browser or constitute physical Mac, two-device or human acceptance. This iteration does not add homes: six of sixteen distinct playable interiors are implemented and ten remain. README content remains functional and contains no CI log.

Reproduce the slow result with `node tests/v194-result-pacing-browser.mjs`. For the native movement receipt case set `HD_MOTION_FAULT=lost` and `HD_QA_OUT=qa/v194/movement-lost`, then run `node tests/v171-lobby-motion-browser.mjs`; `HD_MOTION_FAULT=busy` exercises a transient busy response. Omit the fault variable for ordinary walking. The deployment workflow retains both result and movement diagnostics.

## V195 · Baker and photographer homes

Two distinct playable homes add an open kitchen, sharing table and curtained bed for the baker, and an L-shaped gallery/daylight desk/darkroom/daybed for the photographer. The front wall, door swing and screen were corrected to preserve visible circulation. Four original images cover both styles. Every furniture approach connects through the calibrated walkable floor.

The daily baking schedule validates eight steps across four exclusive stations, precedence and a deadline. The photographer uses real pointer drag and lens controls to frame four subjects from the loaded home artwork. Full subject bounds, composition and magnification are verified server-side; the four resulting crops are displayed in a persistent album. Neither activity mints currency or stock.

26 focused rules passed, covering all eight homes' connected routes, 365 daily schedules/framing briefs, rejection of overlapping/late/forged submissions, exactly-once journals, save restart and appearance invariants. Four native cases cover actual entry, all furniture approaches, game input, server save/reload, assets and narrow-screen close in both styles. One isolated LAN photographer case additionally verifies the four-frame album after switching from origami to pixel and reloading. Fresh fictional identities/saves, ephemeral loopback ports and disabled providers are used; these are not physical multi-device or human acceptance.

The V194 deployment run 38763968313 passed all three native-gameplay and all three native-art jobs. Its three Python matrix jobs failed in an older native lobby test that expected manual recovery after a single lost response, whereas V194 now recovers that response automatically. The test now drops all three bounded attempts, confirms the original pending request remains, and verifies a manual replay with the same request ID. Both styles pass locally; automatic recovery remains covered separately. This updates the expected recovery contract without removing the manual-recovery or layout assertions. Current cross-platform results must still be checked on the new commit.

Run `npm run test:homes` and `npm run test:homes:browser`. The new LAN case defaults to home 7 (photographer); `HD_HOME_ID=6` selects the baker. Eight of sixteen distinct interiors are implemented; the remaining homes and broader goal are incomplete.

## V196 · Fisher and herbalist homes, gallery rendering

Two unique interiors add a wet entry/tackle bench/tide desk for Xiaoman and a front visiting nook/rear botanical desk/private bed for Luobai. Four original assets cover both styles, with the herbalist's obstructing central partition corrected. Ten homes now have calibrated floor routes and personal hobbies; six remain.

The travel-case exercise checks six rotated packing shapes, collisions, bounds, fixed dividers and a suitable fictional departure forecast. The click anchor is an occupied point on each shape, so a concave shape never requires clicking a disabled cell. The leaf notebook validates row/column clues, explicit blank markings and a unique solution. Both save exactly once without minting stock or currency.

29 focused rules pass, including 365 daily briefs, every home furniture approach, rejected malformed submissions, journal restart and autosave protection. Four native final cases use day 4 (including the concave rotation), real clicks/drags and server persistence in both styles. A further compact-layout case and one LAN travel-case appearance-switch/reload case pass. These use fictional saves, ephemeral ports and disabled providers, not the user browser or physical multi-device acceptance.

V195's Windows and Mac ARM Python jobs failed because an older checkpoint fixture waited for a response only after the browser reached the result phase; the actual accepted winning response had already arrived during celebration. The fixture now holds the server-replayed winning checkpoint independently of presentation phase, preserving all pending-restart, no-early-reward and fresh-ticket assertions. Both styles pass locally.

V195 Intel Mac also exceeded the existing 1500 ms cached-gallery paint budget. Local 4x CPU sampling did not reproduce the 1957.5 ms CI result, but showed full island rendering dominating sampled JavaScript while the opaque gallery covered it. The gallery now retains the already painted backdrop; world updates continue, resize invalidates the snapshot and closing resumes world rendering. Under the same local 4x throttle, paired samples changed from 186/221 ms to 118/120 ms. A native regression verifies zero covered background paints, exactly one resize paint locally, and continuous paints after close in both styles. The 1500 ms budget is retained; new CI results must still be verified rather than inferred from local results.

The full existing lobby regression also passes locally in both styles, including shared-save appearance, bootstrap recovery, gallery drafting and mobile overflow.

Run `npm run test:homes`, `npm run test:homes:browser`, and `npm run test:gallery:browser`. The broader goal, remaining homes, local night lighting, combined playthroughs and real cross-device/human/OPC validation remain incomplete.

## V197 · Librarian and mineral explorer homes

Two new private interiors bring the implemented total to 12/16 homes. Qinghe's archive desk, mismatched reading chairs, U-shaped book wall and source index surround a continuous route from the front-left door to the rear-right bed. An obstructing high partition and long bedside shelf in the first art draft were corrected. Yanyan's irregular stone cottage has a diagonal specimen table with a route on each side, a wet boot entry, tool-care bench, map desk and bed. Four original images provide matching pixel/origami floor plans.

The archive hobby distinguishes the time of an event from a later letter or an announcement's print date. Six events, sources and timeline positions vary daily. The mineral hobby swaps and rotates nine cuts of a continuous procedural cross-section, with distinct inclusions, layer boundaries and a quartz vein. Rotation uses short quarter-turn animation across the wrap boundary. These are explicit home exercises, not actual voyage/production completion; journals persist without creating goods or currency.

32 focused rules pass, including all-pairs furniture paths for every implemented home, 365 archive briefs, 365 mineral boards, rejecting forged submissions, immutable retries, restart and autosave protection. Four final native input cases cover both new homes in both styles, including real furniture navigation, source selection, swaps, rotations, undo, reference, saving, refresh, mobile layout and closing. One isolated LAN archive case verifies shared-style persistence after switching appearance and reloading. Test users and saves are fictional; provider APIs are disabled and ports are ephemeral. This does not constitute physical two-device, human or Mac acceptance.

Use `npm run test:homes` and `npm run test:homes:browser`. Remaining scope includes four homes, local night lights and moon reflection, combined economy/workshop playthroughs, cross-device A2A and human/OPC validation. Public video coverage remains the V190 ending-v2 sequence and does not yet include these homes.

## V198 · Musician and tailor homes

Four new images and independently calibrated routes implement Liyin's piano/screened bedroom/sea-window/composition desk and Tongtong's swatch wall/sewing table/mirror/private bed. An extra ottoman blocking the tailor's swatch-wall approach was removed in both styles. Fourteen of sixteen homes now have unique playable interiors.

The music hobby records eight pitches and short/long holds on a seven-white-key piano. It uses the existing mixer, scoped voices, cancellable playback, visual score/key feedback, keyboard/pointer/accessibility input, undo and per-note editing. Event timestamps measure holds. A generation token prevents late audio-unlock results from reviving cancelled playback. The tailor's daily brief constrains main colors and trim textiles; a four-role hidden combination uses exact/misplaced count feedback, including duplicates, a live outfit preview and at most twelve submissions. Both persist personal journals without producing stock or cash.

45 focused rules pass, covering all fourteen furniture-path networks, 365 daily music/brief variants, malformed boards, repeated-material accounting, immutable retries, restart, protected inventories and the existing sound mixer's lifecycle. Four final native cases cover both homes/styles. Two isolated LAN cases cover the piano and the revised swatch brief across appearance switching/reload. Four prior-home regression cases verify archive/mineral paths and input with the shared residence changes. Music input checks include short/long mouse holds, a held keyboard key, correction, audio production, playback cancellation when leaving the desk, and scope cleanup.

The longer music session allowed normal resident mining/harvesting to occur. The first fixture incorrectly required the whole island's inventory to remain zero; its saved home receipt already showed zero stock/cash delta. Home fixtures now assert the specific authoritative journal receipt. Transactional unit tests continue checking unchanged inventories in controlled actions. No game rewards were relaxed.

A dedicated native-homes workflow lane runs archive/mineral and music/tailor browser suites plus shared-appearance journal cases on Windows, Mac ARM and Intel Mac; its YAML and exact command list are parsed locally. V197 deployment run 38782335120 passed all nine jobs. New V198 hosted results must be checked after this commit; local tests are not physical Mac, human or multi-device acceptance. All fixtures use ephemeral ports, fictional saves and disabled model providers.

Use `npm run test:homes` and `npm run test:homes:browser`. Remaining goal scope includes two homes, local night lights and moon reflection, combined economy/workshop playthroughs, real cross-device A2A, and human/OPC validation. Public video remains V190 ending-v2 and does not cover new homes.

## V199 · Curator and steward homes

Sixteen independently arranged dual-style residences are now implemented. New curator and steward paintings have separate doors, furniture, living/sleeping zones, collision areas and reachable approaches. The steward tea setup has two cups/two seats and one teapot with one spout and one side handle; the incorrectly generated overhead handle was removed before the final pixel counterpart.

Curator shelves show canonical saved wonder acquisitions and open the existing full collection book. The hobby matches objects with source cards and acquisition dates; saved awards and explicitly fictional practice remain separate. The server reads its own awards, rejects invented, mixed and incomplete source submissions, and permits a completed set to survive an additional acquisition. Postal puzzles are generated with a legal reverse sequence and replayed forward; 365 days are solvable and start incomplete. Direction/keyboard/click-to-walk, undo/reset, stable box identity, selected steward appearance and cancellable movement are integrated. These hobbies create only a daily personal journal, never currency, goods, wonders or real-task completion.

The steward task desk opens existing Hermes chat. Project shelves open actual workbench and runtime-ledger views, while the visitor chairs open the existing LAN personal-steward exchange tab. Native fixtures read actual isolated workbench/admin endpoints but never send provider requests or replay real work. This is entry integration, not new evidence of physical two-device A2A.

V198 hosted run 38793263748 finished with eleven successful jobs and one failed Intel-Mac native-homes job. Its artifact showed legal room routes still in progress after the 15-second wait, with no page errors or missing assets. Residence movement had capped every foreground frame to 50ms, slowing navigation on overloaded runners. Foreground motion now consumes up to 500ms per frame, retaining a separate 50ms animation step and discarding hidden-tab time; a 5fps/60fps distance regression checks the distinction. Home fixture waits allow 45 seconds while still asserting actual furniture arrival and collision-free paths. The failure is not represented as a pass; the next hosted run must be checked.

62 focused rules pass: all sixteen furniture-path networks, per-owner plans, 365 daily legacy activities, saved provenance, illegal/malformed moves, transaction/retry and tamper checks, all prior home activities, existing personal/collection authority, sound lifecycle and shared movement budgets. Four new final native cases cover both homes/styles, real journal persistence/reload, actual workbench/admin reads and small-screen close. Two isolated LAN cases verify shared appearance/reload records and the steward exchange entry. Four archive/mineral native regression cases cover the shared timing change. These use fictional saves, ephemeral ports and disabled model providers, with no access to the denied live browser; they are not physical Mac, multi-device, human or complete-game acceptance.

Use `npm run test:homes` and `npm run test:homes:browser`. Remaining active goal scope includes local night lights/moon reflection, combined economic and workshop playthroughs, renewed public video/site media, physical cross-device A2A and human/OPC feedback. The public video still predates these residence additions. Hardware and commercial deployment remain excluded.

## V200 · Clock-driven local lighting and water reflection

Both styles now render evening illumination in the actual home and meeting maps. Individually measured fixtures cover production buildings, all16 homes, the existing harbor and portfolio hall; four painted plaza posts stand on verified walkable edges. Home windows extinguish at sleep time while porch lights remain; late premises, active occupants and an awake event participant affect lighting. Unbuilt premises emit no light. The existing shared clock and NPC schedules remain authoritative inputs; no inventory, task completion or economic date is changed by this renderer.

World-canvas ambient illumination accompanies source-aligned warm lights, ground pools and the sea-clipped lighthouse beam. DOM UI retains its palette and no input-blocking overlay is added. Moon imagery is broken into waving horizontal strips and a widening specular trail, world anchored, phase varying and diminished by clouds/rain/snow. Solar glitter fades away at night. Final visual review caught a ferry crossing the reflection: cached contours extracted from actual ferry and dock alpha clip the reflected light so the hull stays in front. A first offscreen-layer version caused a pixel performance regression. Paired source-interception profiles isolated the moon-copy path; direct alpha-contour clipping removed that copy, reducing the profiled night median on this host from about52ms to15.2ms while retaining water and boat occlusion.

48 related rules pass, including minute-by-minute continuity, per-style positions, all16 sleep schedules and actual return-home/wake transitions in standalone and LAN simulations, weather effects, clock persistence/revisions and seasonal boundaries. Sixteen final native render cases cover both themes, day/dusk/night/dawn, rainy night, winter snowfall and the meeting renderer. Native pixel checks verify synthetic land excludes moonlight and actual ferry alpha occludes a reflection. Recorded day/night frame intervals are diagnostic samples on this Windows host, not a universal frame-rate guarantee. Fixtures use isolated fictional saves, controlled central-clock descriptors, ephemeral ports and disabled model APIs; no denied user-browser access was retried.

V199 hosted run38801937118 has two confirmed failures: Windows Python lane's lobby fixture asserted room creation without retaining the HTTP body; Intel native-gameplay's intercepted request hit ECONNRESET during explicit recovery. Both home styles pass locally, but the original Windows status/body is unavailable, so its cause is not claimed proven. The lobby fixture now preserves immutable request IDs across bounded retries of only declared busy/rate responses, with immediate diagnostic failure for auth/validation/unknown responses. The reward interceptor uses Playwright's bounded ECONNRESET-only retry for the same idempotent body; deliberate dropped-response injection remains unchanged. Two lobby and six reward claim/cancel/recovery native cases pass locally. Actual next hosted outcomes remain required.

Use `npm run test:night`. Full current video/site renewal, combined economy and25workshop journeys, physical cross-device A2A and human/OPC acceptance remain in the active goal. New lighting is not evidence of whole-product completion, Mac hardware acceptance or a fresh offline installation.


## V201 · 会客厅断线回执（2026-10-16）

- V200 Windows Python 任务 116718359445 的失败日志为建房 APIRequestContext.post ECONNRESET。只据此处理本轮传输重置，不追认 V199 的未知 HTTP 失败原因。
- 测试辅助器对 ECONNRESET 使用最多两次相同内容重试，原有明确繁忙/限流等待与身份、校验、未知错误立即失败规则保留。
- 实际 HTTP 回包在持久建房后被断开，恢复取得相同房间与重放回执；错误边界检查合计 2 项通过。双画风实际会客厅 2 个原生场景通过。没有提高交互性能或玩法判定门槛。
- 新托管结果尚待；本机回归不代替完整跨平台、实体设备、真人或整体交付验收。详见 [请求回包验证](lan-reply-recovery-v201.md)。

V201 media: current V200 runtime visuals are newly exported at 1440p, with home interiors, clock-driven night lights and water reflection. Historical actual fictional AI/Hermes results are explicitly identified; the native party is newly played and uniquely paid. Caption margins preserve the entire browser view. Original music and a branded three-second closing remain. Video frame rate is not a runtime benchmark. Media playback and publication are verified separately; the whole goal remains incomplete.

V201 course files now describe Agent deployment, independent accounts, one home workshop across styles, package exchange and real participant feedback. The environment check locates the current eight style/season terrain groups and validates both downloadable packs. No real class is claimed. The home-camera button no longer uses the old 768/512 coordinates: it resets to the actual world/room center. Four native new-start/gather/save/empty-browser recovery cases, including actual home-button center assertions, pass locally; independent final-archive installation is recorded separately. Follow-up Windows deployment passed at84f8f91, while both Mac Python lanes exposed a system-temp symlink in the new reset fixture. That fixture now resolves the real temp root, preserving production path protection; next hosted results remain necessary.

V201 reference playback: ordinary bundled Chromium plays the complete30seconds/1800frames with0dropped frames, controls, language switch and no download/error. Default Edge headless on this host drops~303frames at a uniform~50presented frames/s; archivedV190 shows the same behavior. Hardware/software decoders and plain layout do not change the cap; an uncapped diagnostic presents1800/0. This boundary remains recorded and is not reclassified as universal browser smoothness.


## V202 · 经营与离线部署

[经营策略与范围](economy-upkeep-v202.md)保留V201实际失败的12组对照；候选12组各60游戏日通过，成熟挂机均值为正。旧档两画风原生跨日/刷新/390px迁移通过，历史账单不改；1138默认与14运行范围规则通过。离线解释器预检在写入前拒绝不兼容版本，直接Python入口的负例也加入verify。当前不可变V201包另完成双画风25馆共50个实际制作/结算/刷新流程，材料与解法由测试提供，一次合法三消失败及零成本重开保留。上述均不代表真人娱乐性、完整组合经济、实体多设备、当前冻结版一小时或整个目标完成。

## V203 · 室内返回与操作保存顺序

现有16户住所的32张内景逐户核对，均有独立户型、家具碰撞与活动；[人物与布局对应表](residence-interiors-v191.md)保留职业、性格、喜好及生活动线的依据。此次未重新生成这些素材。

完整从零流程中，V202像素岛完成了实际Flash管家主子协作、生产、邀请、四次星灯放飞、活动回执、工资、离岛与刷新；折纸岛则在采矿后转采蜂蜡时失败。保留失败存档的隔离副本，复现室内坐标覆盖主岛返回点的问题；修正后的双画风原生采矿、林地采集、锄地及刷新回归通过。该单项通过不等于完整双画风从零流程已经通过。

V202托管Intel住所检查另在折纸管家家中保存时出现实际版本冲突。客户端操作准备与定时保存之间的竞争可通过确定的调度回归重现；修正后操作准备先保留发送顺序，准备失败也能释放并保留本页修改。双画风实际管家住所完成解谜、保存、刷新、窄屏关闭以及管家和工作台入口回归。后续托管结果与冻结版长期稳定性分别核对，不以本机通过代替Mac实机或真人验收。详见[场景与保存顺序](scene-return-v203.md)。

## V204 · 保存等待者与制作版本

V203 Windows原生玩法停在折纸肥料制作入口，实际诊断为版本冲突。使用原不可变V203、真实浏览器与独立HTTP服务，两画风都能按确定顺序复现；修正后排队保存、制作与取消依次完成，库存和金币保持原值，取消回执各只有一次。双画风20帧原生肥料制作、播种、浇水、施肥、约183秒自然生长、收获和刷新通过，唯一结算保留。追加默认调度回归和托管浏览器检查，原有温室种植测试增加保存版本时序诊断。后续平台结果分别核对，见[保存等待者说明](save-waiter-v204.md)。

## V205 · 恢复入口与游客出行

区分核对回执、继续未完成作业与明确取消后回岛，修正未完成作业反复刷新后又显示相同提示的路径。两画风隔离 LAN 页面覆盖取消、丢失回包重放、唯一回执、材料保留及连续三次刷新；仍保留真实冲突和未确认成果的保护。访客随行与 A2A 的推进范围见[恢复与联机说明](recovery-return-v205.md)，不会把同机测试记为物理多设备或真人验收。

## V206 · 核对完成后的旧页面隔离

保留 V205 Windows 任务的实际物资冲突，并用原不可变客户端和延迟导航、旧页面检查点复现同一错误。恢复成功后持续暂停旧页面直到退出，防止旧模拟重新写回过时记录；双画风浏览器回归及 Codex 内置浏览器独立测试岛的实点恢复通过。详见[核对后导航说明](recovery-navigation-v206.md)。新托管任务的结果与本机证据分别记录。

## V207 · 验收等待完整启动恢复

托管恢复用例过早检查尚未完成的控制器状态；隔离环境持有真实回执复现相同失败。用例等待完整启动后执行原有断言，并补齐检查点截图、启动阶段和布局诊断。两画风本机恢复及检查点用例通过；macOS 背包点击超时尚未本机复现，继续按实际托管结果核对，见[启动验收时序说明](validation-startup-v207.md)。

## V209 · 访客退出的有限回执重试

托管访客出行停在退出回会客厅。本机对退出注入服务忙碌可复现相同超时；为明确的访客退出增加同请求、同版本的有限重试。两画风覆盖先忙碌、再丢失实际退出回执后的恢复，保留所有原随行与存档断言，并补充网络诊断；托管现场的 HTTP 原因仍待新证据确认，详见[访客退出说明](guest-departure-v209.md)。

## V211 · 确认成功但首次回岛被取消

独立 Codex 内置浏览器测试复现首次 reload 被取消后停留在已封闭旧页。增加确认后的备用导航并保持旧页写档隔离，回岛后可正常打开背包。双画风原生用例追加取消首次 reload 的检查，保留既有取消、重放、物资和刷新断言，见[可靠回岛说明](recovery-fallback-v211.md)。


## V212 — Windows LAN identity publication

The Windows native gameplay job for V211 passed recovery-return, then failed creating an origami visit room with HTTP 503 / EPERM. The retained report has no syscall detail. Actual identity-store fault injection reproduces the missing retry at either current or previous document replacement. The store now uses the existing synced atomic publisher and its bounded Windows-only contention handling. Permanent denial and unrelated disk errors still fail without replacing the committed document. [Details and verification boundaries](lan-identity-publication-v212.md).


## V213 — Explicit manual resident task chains

Manual steward tools and saved planning transactions now accept a bounded, explicit same-resident dependency queue. Automatic cadence and one-job patrol behavior remain unchanged. Actual transaction checks cover order, quantities, durable reopen/replay and pause/cancel boundaries; the native two-theme check performs forest → shore → forest with a mid-chain reload and empty-browser recovery. Provider replies are deterministic in this native check, not fresh AI decisions. Python verifies the actual worker dispatch function and registered schema. [Scope and limitations](task-chains-v213.md).


## V214 — Queued work follows world identity and fixed shifts

Malformed identity-less saves are rejected before a manual request consumes an ID or records a running job. Task cards and model observations now explain fixed work hours; optional unleased visits can hand over to queued work when the shift begins, while actions, receipts, conversations and essential needs remain protected. Real Hermes/Flash plans completed both themes; the original off-shift origami queue resumed on its unchanged natural clock with no additional provider calls. Native CI checks now separate work-time budgets from bounded calendar waits, retaining the original quantity/replay assertions, commands and platforms. [Details and sanitized evidence](queued-work-schedules-v214.md).

Confirmed recovery also exposes an ordinary return link when an embedded browser cancels both automatic navigations. The old page stays sealed, its previous local snapshot remains, and both themes return with unchanged authoritative resources and usable controls. An isolated Codex in-app browser fixture also returned and opened the bag. [Reproduction and boundaries](recovery-return-link-v214.md).

## V215 — Original shared chain budget and actual crafting evidence

The V214 Windows resident-work artifact caught an unintended split of the original 240-second remaining-chain allowance. The native gate now shares that allowance across both jobs and records frame/save diagnostics, retaining its first-job and calendar bounds and original outcome assertions. Independent V214 checks additionally cover actual collect/craft/collect chains, lost committed replies, pause/reload/resume, and two fresh real Hermes/Flash manual sessions. This is a verification correction and broader evidence, with no game runtime change. [Failure, scope and evidence](task-chain-work-budget-v215.md).

## V216 - Resumable reconciliation and actionable resident planning

Recovery checkpoints are durable before waiting on old requests. An ordinary re-entry link resumes the existing confirmation in a fresh document before simulation starts, retaining the original backup and operation IDs. Nighttime residents with no legal purposes skip provider planning without consuming its budget. Both-theme native checks and an isolated Codex in-app-browser recovery path passed; the original user page was not inspected and the hosted slow-render work-chain issue remains open. [Details and sanitized evidence](recovery-reentry-v216.md).

## V217 - Consistent navigation and valid autonomous alternatives

Residents, visitors, recruitment transports and activity arrivals now receive the existing navigation-only frame budget; protected needs, work, service and settlement clocks retain their rule time. Confirmed dependent work skips an unrelated autonomous-purpose pause when shifts and needs allow it. Failed invitations select a valid personal alternative before falling back, preventing empty resident jobs. Actual delayed-RAF two-theme queues retained their original120/shared240-second working budgets, three unique receipts and reload/reopen assertions. Hosted confirmation and broader acceptance remain open. [Reproductions, evidence and boundaries](resident-travel-v217.md).

## V218 - Bounded Windows save-lock acquisition

The primary save store now uses its existing exclusive-open retry helper for transient Windows sharing denials. Business operations run only after ownership; persistent denial preserves canonical bytes. Actual store-level replay and two-theme native gathering under injected contention passed. The original hosted EPERM syscall/path was not captured, so this fixes a reproduced acquisition gap without claiming every filesystem origin resolved. Original queue budgets remain unchanged and subsequent diagnostics include actual error text. [Evidence and limitations](save-lock-sharing-v218.md).


## V219 - Useful components and reusable painting tools

三件原本没有后续配方的组件已接入画作、藏书整补和摄影架制作；竹木画笔成为可装备、预留后归还的耐用工具。两主题单支画笔使用对应素材与握点，关卡完成条件保持。[范围与证据](production-uses-v219.md)。

## V220 - Recovery input through native modal dialogs

小游戏原生暂停／结算弹窗可能让其外部的恢复按钮无法收到点击。恢复面板现暂时收起这些模态弹窗，退出后仅恢复仍有效的原弹窗。双画风隔离 LAN 原生点击核对、暂存副本和服务端资源保留，以及弹窗生命周期检查通过；用户原页面因浏览器权限设置未读取，仍需刷新后确认。[复现和边界](recovery-modal-v220.md)。

## V221 - Resident continuity and current catalog totals

居民短等待按有效游戏时间延续；旧经历还原剩余时长，避免刷新后误等旧页面的数千秒。双画风隔离页面实际赴约、完成本地规则交谈、保存和刷新后保持新等待；当前目录数量显示与初版成就定义分别保留。模型调用间隔不变，完整自然长期故事与真人验收继续。[范围与复现](resident-continuity-v221.md)。

## V222 - Recruitment errors survive unrelated status reads

招聘失败文案与状态查询错误分别保留；同申请继续确认与单笔预留保持，当前世界的同编号进行中聘约才能确认接收。双主题四个原生错误恢复案例和 37 项相关规则通过；V221 的真实像素零开局在原申请续作后完成主子交付、首场派对与离岛，首次超时仍保留。[范围与限制](recruitment-recovery-v222.md)。


## V223 · 核对反馈 / Recovery feedback

存档弹窗读取现在使用统一恢复面板，持续显示核对步骤、失败原因和暂存副本完成后的安全重入入口。双画风修复前有效夹具 2 例失败，修复后 2 例通过；原模态弹窗、等待重入、取消导航各 2 例及 13 条回执／导航规则通过。原用户页受已保存浏览器权限阻挡，未确认其刷新结果。详见 [专题说明](recovery-feedback-v223.md)。


## V224 · 正式物品共创 / Custom products

新增每岛独立的正式物品、加工配方与双画风 PNG；服务端审核发布、原材料单制作、组件复用、直接使用、陈列、导出附件与另一岛主导入制作。当前新增规则／HTTP 9 项和双画风原生流程 2 例通过；隔离预置物资与 PNG 图案夹具不代替零开局、真人授课或成品美术。早先只查 DOM 的图片通过结果已排除，现核对实际图片解码与截图。完整验证状态见 [证明摘要](verification/v224/custom-content.json)，边界见 [实现说明](custom-content-v224.md)。


## V225 · 恢复说明定位兼容

V224 独立安装回归停在旧恢复测试：V223 新增等待状态段落后，原说明选择器匹配两个节点。失败产物保留，V224 源码包未晋升为已验证交付。仅将原说明断言排除进度段落，未删除断言、增加预算或跳过平台。

修正后双画风原生测试通过：保留进行中作业的继续/取消选择、按原身份核对丢失回执、首次导航取消后的自动回岛、旧页面迟到暂存隔离、三次刷新稳定和材料预留释放。测试使用隔离虚拟账户，无用户浏览器或模型调用。原 Codex 标签页仍未直接观察，不能声称原现场已确认。


## V226 · 导入、历史恢复与进度接续

修复已确认替换后跳转被取消仍接受旧暂存的问题；新增持久不确定替换标记、回岛入口和旧请求收尾顺序。双画风四个有效失败基线，修复后六个原生场景通过；新增八项规则，完整规则 1240 项通过。隔离自动验证不代表原 Codex 标签页、实体 Mac 或真人验收。见 [行为边界](save-replacement-v226.md) 与 [证明摘要](verification/v226/save-replacement.json)。


## V227 · 共创作品进入居民与管家分工

共创物品可加入正式筹备与管家分工，前置制作逐项交付；停用等待、原账单结算、长编号与双画风图标接通。修复已发布物品零库存补齐引起的个人物资冲突。20 项新增规则、完整 1260 项规则、双画风居民实际制作入库与重开，以及双画风恢复反馈通过。一次真实 Hermes 共创调度完成服务端交付，另一次真实 Flash 规划选择了有效职业目的；不能把后者说成选择了共创目的。预置物资与 PNG 测试图案、实际模型与桩运行分别记录。原十八项仍为四项完成、十四项进行中。见 [实现与边界](custom-agent-v227.md) 及 [证明摘要](verification/v227/custom-agent.json)。


## V229 · 核对控件状态

恢复流程改为持有作业卡交互锁，避免新增按钮点击无反馈、旧 disabled 值覆盖控制器结果，以及卡片移除后核对提示提前消失。隔离双画风在修改前各复现一例失败，修改后均通过；不代表用户原 Codex 标签页已直接确认。见 [实现与范围](recovery-controls-v229.md)。


## V230 · 共创商品进入游客经营

物品用途接通货架，手动陈列共创作品并保留任务库存；符合喜好的游客按预算到店消费。已确认的价格、运营费和唯一回执保留，停用图纸后仍能出售已有成品。10 项新增规则、完整1270项规则、双画风货架流程与双画风居民实际制作到游客购买流程通过。原料与图片为隔离夹具，不代替从零采集、真人课堂及实体多设备验收。见 [实现与边界](custom-market-v230.md) 与 [证明摘要](verification/v230/custom-market.json)。

## V231 · 四岛联动与组合账目

四岛各自管家及两位居民同行、标准 A2A 本人授权、付费活动、重启／重放与返岛的整合流程及相关检查 33 项通过；独立真实 Hermes/Flash 双画风运行共 22 轮，原账户与轮次关联核对通过。同岛十日五活动／工资／游客／升级维护账目检查通过；不替代零开局全渠道经济、实体多设备或真人验收。课程补上实际销售与成本观察，新玩家任务卡已备好，结果仍待真人填写。见 [范围与复现](multi-island-economy-v231.md)。

## V232 · 居民农活阶段确认

居民选田和发送作业前核对服务端确认的农田，避免本地生长预测提前触发收获；服务端阶段、时长、预留与唯一交付约束保留。双画风失败基线、46 项相关规则、双画风浏览器组件及正常原生收获回归通过；不代表旧版一小时运行或长期农田验收已经通过。见 [复现与范围](farm-readiness-v232.md)。

## V233 · 组合核验提速与原图审核

保留账目断言和原预算，通过确定性关卡定义缓存与只读确认快照减少重复核验；96 组旧定义、完整1278项规则和双画风30日五活动／工资／游客／升级维护组合检查通过。书架物品计数、审核原图与按素材类型采样接通，双画风原生共创到跨账户导入制作及手机布局通过。零开局、真人课堂／新玩家、实体多设备与新包视频仍继续；V230实际一小时原有两次API异常不改判通过。见 [范围与证据](validation-performance-v233.md)。

## V237 · 从零商品成交与筹备时段提示

双画风零币零库存原生采料、组件加工、中途刷新续做、上架与游客实际成交通过，成交收入／费用／净额为7／3／4币；原首场活动失败档案在保留时钟的隔离副本中按原可工作时段预算续做、邀请、赴约、结算与空浏览器恢复通过。筹备手账补上既有作息提示，12项相关规则及双画风手机／桌面界面通过。原日历等待失败与一次过时浇水拒绝保留，未改判连续完整流程通过。见[范围与证据](project-continuation-v237.md)。

## V242 · 旧档恢复与多岛完整活动矩阵

联机旧档经济规则迁移现与独立入口共用，迁移前保留备份，续做任务及唯一结算不变。修复前 3 项迁移失败、修复后 4 项通过；同一份失败的虚构旧档已可正常进入、保存与刷新，完整规则 1282 项通过。双画风零开局商品实际成交、24 个四岛活动案例和两次真实 Flash 跨岛居民交流通过。原等待失败与候选安装失败保留，最终交付包、当前一小时与真人验收仍待完成。见[范围与复现](recovery-travel-v242.md)及[证据摘要](verification/v242/priority-closeout.json)。

## V243 · 零开局连续旅程与新视频

双画风从零采集、制作、种植、正常成熟、按作息筹备、邀请赴约、四幕派对、唯一奖励及空浏览器恢复通过；不补物资或快进时间。旧浏览器待存记录双画风核对也通过。新30秒视频已重新导出并检查画幅、真实记录来源、弹窗玩法、配乐和结尾；首次尺寸错误原件保留。便携工作时段入口及最终包独立安装另行核对，真人与当前一小时不计入本轮。见[范围及复现](zero-first-night-v243.md)。

## V245 · 暂停、真实交付与自动主持

双画风暂停后的刷新、实际服务重启、空浏览器续做及依赖顺序通过；真实历史主子聘约实际交付六份、按比例支付五币并自然离岛。五类活动共十个原生自动开场与道路赴约流程、两次真实 Flash 穿搭主持登记通过。早期选择器歧义和启动接口误拦截的失败保留，未改动产品任务规则或收益。便携暂停入口两套画风、主持入口烟花双画风另行直接执行通过。V243 独立包曾因玩家过时浇水请求被拒绝而失败，现补上排队和同步后的新农活检查；18 项农活规则、双画风并发回执及存档排队回归通过。码头缩放导致候船间距不足也已调整，原 32 间距断言保留，9 项道路／游客回归通过，导航重建后完整规则 1,291 项通过。首夜原生流程另发现跨日领取旧日期问题，现补上同步后读取确认日期；双画风临界日、丢响应原编号重放及原失败档案隔离续领／空浏览器恢复通过。原失败保留，最终包仍另行验收。见[范围与证据](task-continuation-v245.md)。

## V247 · 导入预览与自动保存

修复签名导入预览读取版本期间本窗口保存先行的竞争，并排空较早保存等待者启动的下一次写入；真实跨窗口冲突仍拒绝覆盖。新增4项检查、相关15项规则、双画风6个原生恢复／导入案例及完整必需规则通过。原 Windows 失败保留，最终包和一小时运行另行核对；未改动收益或用户存档。见[范围与复现](recovery-import-preview-v247.md)。

## V248 · 后台结算与用户操作排队

外部保存检查点等待已接受的作业回执，避免正常后台结算被误报为需要恢复；招聘、手动保存／备份、游客入港和管家等页面前置同步接入。双画风确定性2例取消失败已修复，4个招聘错误场景、3项新增队列检查、完整1298项规则、6个签名恢复及2个零开局游客成交案例通过。真正不确定的原编号仍保留，未更改收益或模型频率。见[范围与证据](recruitment-checkpoint-v248.md)。

## V249 · 农活与备份的排队边界

实际一小时发现一例 NPC 过期收获请求，原轮次保留为功能失败。新 NPC 农活在共享队列与保存后重新检查已确认阶段，过期但未提交的动作返回重新安排；整个备份请求串行完成，同时自动保存等待且保留新修改。4例原生农活失败与一例备份竞争已复现修复，原生玩家2例、成熟度组件2例、签名恢复6例、完整1300项规则通过。两个 macOS 隔离测试采用真实临时根路径，服务端目录保护保留；托管结果另行跟踪。新小时和真实从零活动续做另行验证。见[范围与证据](npc-farm-queue-v249.md)。

## V250 · 导入预览与低帧率分工

选择文件建立新的弹窗操作归属，防止旧保存回调覆盖导入预览；两套画风的确定性2例导入失败修复，原生6例全部通过。获准 NPC 动作使用有上限的可见时间与许可后单调计时，产出仍依赖原服务端回执；两组延迟下共4个三步分工流程通过，原120／240秒预算与世界时钟保留。完整1306项规则通过，新托管与真实完整流程另行跟踪。见[范围与证据](import-work-clock-v250.md)。

## V251 · 临时伙伴的工作间隙

临时伙伴等待前置材料或暂停分工时使用个人生活安排，明确分配且可执行的工作沿用原聘约。原12例中6例失败，修复后关联25例及完整1318项规则通过。此前真实流程的9笔拒绝保留为失败，修复后的真实筹备仍待验证。见[范围](recruited-work-gaps-v251.md)。

## V252 · 平衡居民会面路程

在原有语境地点中平衡两人路程，保留拥挤与重复惩罚，不增加逐次寻路或改时钟。关联19项、完整1321项规则及原生重进4例通过，原150秒预算保留。原托管失败与新验证的隔离夹具范围均保留，见[说明](social-meeting-distance-v252.md)。

## V253 · 临时伙伴缺粮自理

补给耗尽时以真实20秒采食补充自身饱足，再继续原分工；不增加公共食物库存、岛币、工资或聘约交付。关联41项、完整1326项规则与双画风原生组件2例通过，包含回执重放和无遗留许可。夹具与真实流程边界见[说明](partner-self-care-v253.md)。

## V254 · 短暂写入失败与原任务恢复

Windows短暂文件占用和游戏存档503使用同一原命令进行有限重试，防止作业长时间停在核对状态；持续失败保留原档和恢复记录，不重复发放。完整1335项规则、双画风原生组件2例及本机四季16例通过；Mac季节超时仍待定位，详见[说明](save-io-recovery-v254.md)。

## V255 · 活动写入和遗留锁恢复

实际Windows文件占用复现并修复活动档案／结算写入中断，以及三种已完成锁未清理造成的后续忙碌。有限重试与下一次原请求恢复均保留所有权和单次扣款。完整1350项规则通过，范围及夹具修正见[说明](owned-lock-recovery-v255.md)。真实集市的季节器具依赖仍需单独修复。

## V256 · 就绪工作清除闲暇等待

工作时段内，空闲且状态足够的居民可及时续做原分工，保留必需休息、暂停、交互和待回执边界。完整1357项规则与双画风低帧原生三步队列通过，原120／240秒工作预算保持。旧托管失败未改判，详见[说明](queued-idle-wakeup-v256.md)。

## V257 · 集市基础器具与暂停续办

新器具、明确旧草稿升级与已接受作业后的检查点等待；真实交付、赠物、历史证据和旧合同保持。完整1365项规则与双画风12订单原生案例通过，旧实得经营失败未改判，见[说明](market-equipment-and-pause-v257.md)。

## V258 · 已接受游客服务持续推进

已取得许可的游客服务可在其他作业回执等待期间继续可见动作，原许可、完整时长和服务端结算保持。完整1376项规则及双画风低帧／回复延迟下的原150秒游客购买流程通过，旧托管失败未改判，见[说明](visitor-service-v258.md)。

## V259 · 独立产物素材校验与农田回执诊断

修正旧检查对独立价签素材的硬编码例外，保留边界与图案探针；双画风616项原生渲染通过。农田仅增加只读回执证据，原MacIntel失败仍待定位。运行代码与1376项默认规则套件不变，见[范围](native-diagnostics-v259.md)。

## V260 · 恢复时先登记全部候船位

修复存档顺序导致的游客重复占位与409循环。双画风十项复现、相关23项及完整1386项规则通过；实际出错存档副本中的三位游客30467毫秒内各离岛一次，原奖励与付款不重放。原失败报告保留，见[说明](visitor-queue-recovery-v260.md)。

## V261 · 原回执核对后再恢复联机关卡

修复旧检查点回执清掉新输入，以及成绩未被接受却关闭结果的流程。双画风定向原生回归与1386项规则通过；实际输入回放、付费结算与重试保持唯一。完整四岛/A2A和真人验收仍未完成，见[说明](lan-activity-recovery-v261.md)。

## V262 — 回执等待期间的对白与四岛活动验证

已开始的居民对白在无关回执等待时继续演出，关系、记忆和完整记录仍等普通模拟恢复后落定一次。4个定向规则、双画风实际回执暂扣及原4例刷新验证通过；原150秒上限未变。全量1390规则通过。另已完成像素与折纸主岛的各4账号原机管家/随行居民/真实Flash筹备/付费活动/返岛验证，初始物资为声明的测试初值，每次仅渲染一个视图；不等同于物理多设备或真人验收。Mac托管修复结果、当前交付包、长时段、视频与真实参与者仍需分别核对，见[说明](social-receipts-and-visits-v262.md)。

## V263 — 原生准备与 HTTP 回执分段计时

修正对白验证把存档准备算进 HTTP 等待的问题，记录实际发出和接受时间；原10秒网络要求及对白/唯一结果/刷新断言保留，失败诊断前释放人为暂扣的回复。双画风定向原生验证通过；游戏、依赖与默认规则文件未改，继承V262的1390规则和15步独立安装证据。当前托管平台结果仍待确认，见[说明](native-request-timing-v263.md)。

## V264 — 原生物品像素核对与失败诊断

将616张物品截图的Python逐像素循环改为Pillow等价计算；完整像素范围、500/8/3阈值和180秒上限保留。72组边距对照、严格阈值反例、两张旧CI截图与本机双画风616张原生检查通过，1391必需规则通过；新Mac托管素材检查仍待确认。V263三平台岛屿模拟中的原对白连续性和回执暂扣检查均已成功。详见[说明](native-product-pixels-v264.md)。

## V265 — 居民规划的合法 JSON 示例

修正居民规划提示词中不合法的结构示例，禁止尾逗号，示例不能覆盖实际居民编号和可选目的。严格解析器、Flash、一次调用与300/600/950秒频率未改；原失败回复仍被拒绝并保留用量。受控分派修正前1失败/1通过、修正后与原策略检查9通过，完整1393规则通过。一次真实Flash为15位虚构居民返回各自合法目的；这不是新的自然一小时。原V262小时的性能与恢复通过、功能接口失败结果保留，新冻结版长时/最终包/视频与真人继续验收，见[说明](resident-json-prompt-v265.md)。

## V266 — 原生恢复输入的可追溯诊断

保留V265托管MacIntel恢复点击的4秒超时，根因仍待确认。本机原用例与增加诊断后的双画风检查通过，故意保留原生遮挡的反向对照仍按原限制失败。新增输入/长任务/弹窗轨迹与失败命中状态，原断言和游戏运行代码未改。精确V265候选的15步Windows部署、10日受保护账目及真实双画风自然一小时已通过；原V262失败保留，不等同于真人或完整交付，见[范围](recovery-input-diagnostics-v266.md)。

## V267 — 回执等待中的对白终点边界

真实延迟请求准备复现了原检查在对白末句剩余不足一秒时的误判。保留整个原生等待至少推进一秒、真实接收后有足够剩余时至少一秒及原取消/唯一落地/重开检查；末句必须完整播完且不能越界。正常与延迟双画风4例通过，冻结对白2例仍正确失败；游戏运行代码未改。外围任务容纳原游客轮转时限，另设原V220输入诊断入口，新托管结果与MacIntel输入问题继续追踪，见[范围](pending-dialogue-endpoint-v267.md)。

## V268 — 核对期间保留背景，优先响应恢复控件

追踪保留了MacIntel折纸版恢复按钮在4秒内未收到输入、原生弹窗已关闭且持续出现长任务的失败。修复已暂停模拟时仍每帧重画地图的问题；尺寸变化重画，解锁后恢复动画。原V220文件与4秒限制保留，新增原生绘制观察先在旧代码双画风失败、修复后通过，既有弹窗/恢复控件/会客馆及限速对照通过，1393条规则通过。新托管复验待完成，见[证据与范围](recovery-background-v268.md)。

## V269 — 对白原生输入的准备时序

原检查把输入准备耗时也当作对白仍在进行的前提；真实等待复现了正常结束后误判。提前用鼠标准备菜单，再通过可信原生Enter激活同一按钮，实际送达时必须正在说话且无结果；原请求/推进/终点/取消/唯一落档/重开门槛保留。正常、限速、延迟6例通过，冻结2例仍正确失败。游戏运行字节与V268一致，新三平台专项及完整检查待确认，见[范围](dialogue-native-setup-v269.md)。

## V270 — 住所点击与室内路径取证分支

macOS14原住所检查在打开来历笔记时超时，尚未切换画风。保留原断言、输入和预算，补充有界点击/路径/恢复快照和失败截图；正常两住所流程通过，故意忽略输入的反向对照仍在45秒失败。独立分支开展三平台取证，原失败尚未定位，详见[范围](home-journal-diagnostic-v270.md)。前一对白专项三平台6例及产物散列核验通过，不能代替完整检查。

## V271 — 弹窗回包丢失与有界原请求重放

原生路由异常在清理前留档；仅对已签名操作连接重置原样重试一次。真实提交后丢包的正反对照及原 12 项通过，连续丢两次仍明确失败。运行时不变，原 macOS 连接起因、住所超时和两项任务停滞未宣称解决。详见[范围](modal-transport-v271.md)。

## V272 — 码头接驳不再等待无关作业

修复上船／上岛到最后一个路径点后被全局待确认作业阻塞的问题，保留服务端时序、库存、收入与回执去重。原模块五项对照失败，修复后相关 41 项通过；双风格实际制作到游客购买在原 150 秒限制内完成。为独立的 macOS 任务停滞保留有界诊断，尚未宣称其根因解决。详见[范围](visitor-transfer-v272.md)。

## V273 — 居民出门与源码分卷

纯姿态出门回调不再等待无关回执；旧模块两项出门对照失败，修复后 28 项相关检查、双风格正常与跨夜原生任务链通过，原工作预算保持。新增标准库分卷校验合并，9 项完整性检查与真实 2.57 GB 候选包往返通过。部署指南更新并保留历史；宿主 macOS 帧循环停送仍单独调查，未宣称完整验收。见[范围](resident-exit-v273.md)。

## V274 — 可见页面帧回调恢复

主岛单一帧循环新增真实时间健康检查；隐藏页面、原工作时段、资源及回执约束保持。停送 RAF 的旧代码双画风对照失败，修复后双画风原生任务链与空浏览器恢复通过，默认 1,411 项规则通过。宿主 macOS 原失败原因及恢复验证仍待确认，不据此宣称完整交付。见[范围与限制](frame-recovery-v274.md)。

## V275 — 帧中断故障的状态观察

保留并核验 Windows 与 Intel macOS 原产物：三项任务已登记，而观察器依赖被主动切断的 RAF。仅该故障分支改用真实计时轮询，原条件、输入与时限保留，游戏运行代码不变。双画风延迟输入负对照仍正确失败，修复后的同流程完成三项唯一任务与空浏览器恢复。新托管结果及原 Mac 根因仍待确认，见[范围](raf-observation-v275.md)。

## V276 — 完整日账与收支保护

修复交易明细超过 300 条后日账漏计，以及普通保存可改写收支展示的缺口。独立 60 日汇总、旧账完整性提示、日常与建设分列已接入；价格公式保留。原始 5 项对照保留 1 通过/4 失败，修复后 1,429 项默认检查及双画风原生购买/升级/切换/保存重开通过。V274 双画风 30 日规则账目已通过，但不作为新源码长线验收；原一小时因记录路径在启动前失败，尚未完成。新托管、Mac 原问题及真人验收继续，见[范围](cash-book-v276.md)。

## V277 — 游客接待等待与场景内存

旧逻辑接待对照保留 1 通过/3 失败，相关 22 项及更新后 1,436 项默认检查通过（原 1,429 项结果保留）。慢帧与后台响应延迟下，双画风实际制作、陈列、购买、重开通过原 150 秒预算，库存 1→0、营业 7/成本 3；新增进程观测仅限测试自有浏览器。移除未使用旧场景的提前加载，每页实测少解码 18 MiB；ARM 整体冻结根因、最终交付包及当前版本一小时仍未完成。见[范围](visitor-admission-v277.md)。

## V278 — 到港时钟排队与失败诊断

到港请求会先等待已有作业与时钟检查点，避免并发时过早提交。实际双画风制作、陈列、购买和重开在原 150 秒预算及慢帧/延迟条件下通过，无到港拒绝；6 项 DOM 协议检查、40 项关联规则通过。Mac 三项失败仍保留，补齐绘画/珍珠杯报告与测试自有进程诊断；取样介入不能视作验收通过。见[范围](visitor-clock-v278.md)。

## V279 — 当前课程检查与隔离卡死诊断

课前检查改为核对界面实际链接的 V2 课程和练习册，保留旧 V1 的兼容导航；23 项只读检查通过，真实学员数仍为 0。新增仅手动启用的 ARM 居民卡死诊断，保留原断言与时限，采样只能保存失败证据，不能计为验收通过；8 组既有调度选择和 6 项诊断保护检查通过。游戏规则、渲染、服务与 PNG 未变，Mac 根因仍待定位。见[范围](diagnostic-course-v279.md)。

## V280 — 主模块下载失败后的恢复入口

Intel Mac 旧失败的报告与截图显示主模块未能载入，页面只有静态壳。原 LAN 引导在显式 503 下同样不再进入小岛；修复后双画风首次失败重载、永久失败后手动恢复、运行期错误不自动重放及会话存储不可写共 5 项轻量 DOM 检查通过。保留原 URL、账户与恢复意图，不清除进度。完整岛屿与托管复核仍待，ARM 整体卡死根因没有被宣称修复。见[范围](module-bootstrap-v280.md)。

## V281 — 并发回执中的玩家动作收尾

修复已授权玩家动作等待其他响应时无法结束的路径，原控制器仍按原编号确认结算。旧代码的实际游戏失败保留，修复后双画风证明动画先结束、物资等待回执、只结算一次并可刷新恢复；采矿／农田返回与 1,451 项默认检查通过。V280 完整双画风重新进入通过；Mac 原失败及当前版本一小时尚未完成，V278 在第 50 分钟因测试报告文件替换冲突中断。见[范围](player-action-clock-v281.md)。

## V282 — 登船验证顺序与 Mac 栈诊断

复现并修正测试适配器绕过实际客户端队列造成的并发版本冲突，原断言保留并等待所有游客请求；延迟对照五项、关联九项及符号工具六项检查通过。补齐管家立绘失败产物，新增只手动运行的匹配符号解析诊断。游戏、服务端与美术未变，冻结 V281 的交付／一小时继续保留原来源；Mac 冻结根因仍待。见[范围](mac-stack-diagnostics-v282.md)。

## V283 — 动作测试请求准备同步

修正 Intel Mac 失败中两秒探测先于保存准备完成的同步问题。共享原十五秒准备窗口，五秒完成／三十秒回执与唯一结算断言保留；真实保存响应延迟三秒时，旧失败被复现，新版双画风通过且无提前／重复物资。游戏和资源未改，托管 Mac 仍待确认。见[范围](player-action-preparation-v283.md)。


## V284 · 正常退出时保留管家后台成果

正常关闭服务现在等待本机执行端已接受的管家作业及结果记录收尾，再停止执行端；关闭期间不再接收新委托，记录失败会保留退出失败及数据锁。原代码三例复现，修复后五例及其余47项关联检查通过。均使用隔离虚构数据；V281冻结包及一小时运行不包含本次后端改动。见[说明](agent-shutdown-v284.md)。


## V285 · 游客到店排队与实际消费

游客到达门口及室内工位后可排队提交自己的原入场请求，不再等待其他游客全部空闲；自己的回执、未就绪与锁定状态仍会阻止重复。35项关联检查、双画风原生居民制作至实际购买及1000毫秒响应延迟共四例通过，原150秒预算与账目断言保留。ARM浏览器GPU卡住及完整交付继续单独验证。见[说明](visitor-queue-v285.md)。
