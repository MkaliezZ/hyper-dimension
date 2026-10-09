# V156 · 珍珠茶盏与结算检查

## 物品与配方对应

珍珠茶盏 `recipe_c1_11` 消耗一只茶杯、两颗珍珠和一份石英。旧图附带托碟，并将多颗珍珠散放在托碟上；与“杯壁镶两颗珍珠”的制作说明不一致。

两套新图均为一只茶盏、两颗杯壁珍珠、右侧单把手、一个杯足，没有托碟和散落珍珠。像素版保持块状描边，折纸版保持纸面折角；两套使用同样朝向。整张透明 PNG 直接接入背包 SVG、场景与手持 Canvas，不再从旧图集裁取。原图集保留。

<img src="../public/assets/item-pearl-cup-pixel-v156.png" width="240" alt="像素珍珠茶盏"><img src="../public/assets/item-pearl-cup-origami-v156.png" width="240" alt="折纸珍珠茶盏">

[像素茶盏](../public/assets/item-pearl-cup-pixel-v156.png) · [折纸茶盏](../public/assets/item-pearl-cup-origami-v156.png)

[生成提示、原文件哈希与复核记录](verification/v156/pearl-cup-provenance.json)。此前 V155 文档中的“双把手”描述有误，实际旧图是不同朝向的单把手；此次修正的是托碟、珍珠数量/位置与朝向一致性。

[实际制作记录](verification/v156/native-pearl-cup-craft.json) 使用保护存档、原生鼠标与正常动画时间，分别完成两套小游戏，扣除上述材料、领取一只成品并刷新；没有重复奖励。夹具预先提供材料和解锁，不是从零收集或真人难度验收。

[全部产物渲染记录](verification/v156/native-product-renders.json) 继续检查每套 300 个配方产物，共 600 个图标 / 1,800 个显示面及六处已知邻图探针。只证明所列渲染检查，本次两个新造型由开发 Agent 目视复核，不能据此宣称全部造型、用途和动画已经完成验收。

## CI 失败与检查方式

V155 的第一次三平台运行在 Mac Intel 达到 25 分钟任务上限；任务预算调整为 35 分钟后，Windows、Mac Intel 通过，但 Mac ARM 在折纸结算按钮恢复的 15 秒等待处超时。[实际记录](verification/v156/previous-ci-failure.json)。旧测试没有记录当时的服务端状态，本机快、慢两组相同延迟夹具均通过，原超时原因仍未确认。V155 下载包继续保留草稿，没有作为合格发行发布。

当前[原生检查](verification/v156/native-checkpoint-release.json) 精确拦住结算页显示后的一次真实保存响应：服务器先生成回包，测试在控制按钮和同一作业编号的断言后才放行该回包。随后按钮须在原有 15 秒等待内恢复，实际点击重开产生新编号；旧局只保留一份无扣料/无奖励的取消回执。此前保存正常通行，仍使用正常游戏时间与真实服务端校验。失败会记录回包状态、按钮与恢复提示。

这是检查夹具与诊断的改进，未声称修复一个尚未复现的运行时恢复原因。此提交仍须经 Windows、Mac ARM 和 Mac Intel CI。CI 不是实体 Mac 或真人验收。

## 验收范围

28F / 18R / 30T 范围不变；仍为 4 项完成、14 项进行中。最近完成的真实一小时是 V152，双画风 25 馆原生制作闭环来自 V153，真实 Hermes 主子协作复核来自 V155 两套各一次的进阶夹具。未冒充零起点或十次协作。宣传片仍录自 V145，小游戏继续标明占位演示。

## English

The pearl-cup recipe consumes one fired cup, two pearls and one quartz. New pixel and origami PNGs each show one cup, two pearls embedded in its front wall, one right handle and one foot, with no saucer or loose pearls. Whole generated transparent PNGs are used unchanged in inventory SVG and scene/held Canvas. The earlier “two handles” note was inaccurate: old assets had single handles facing different directions.

Both native crafting fixtures consume the exact ingredients, produce one cup and preserve it after refresh. All 600 product icons / 1,800 render surfaces still pass. Fixtures grant ingredients and unlocks; this is not zero-start, human-quality or whole-product acceptance.

V155 remains draft after Mac ARM timed out on result-control recovery; Windows and Mac Intel passed. The original underlying cause is unconfirmed. The current native test holds one real result-phase checkpoint response, then releases that same response after asserting disabled controls and unchanged ticket identity; controls recover within the original 15-second limit and native restart creates one new ticket. Failure diagnostics now retain response codes and recovery UI state. This refines the fixture and does not claim an unconfirmed runtime fix. Three-platform CI for this commit is still required.
