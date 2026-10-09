# Validation / 验收说明

以下按版本保留历史证据；当前 V138 结果见本文末尾。 / Historical evidence is retained by version; current V138 results are at the end.

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
