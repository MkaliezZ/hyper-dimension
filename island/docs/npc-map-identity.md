# 地图居民身份与点击修复 / Map resident identity

## 修复

地图原先通过“距离脚底25坐标单位、取数组第一项”选择NPC。姓名牌与头部位于脚底上方，点击黎音的姓名时可能命中附近小墨的脚底；角色与姓名重叠时也未考虑绘制顺序。

现在每个实际绘制的角色登记身体、姓名牌及气泡边界，按画面的绘制顺序选择目标，并将其稳定npcId用于姓名、贴图和档案。点击直接查看对应档案，避免附近热点和另一居民的脚底抢占。悬停身体时显示对应姓名；离岛、进入室内和下一帧重新绘制都会更新目标集合。游客与居民的贴图编号不再作为同一个身份域处理。

黎音为编号12、音乐人；小墨为编号1、工匠。检查未发现两者档案和贴图编号互换；本次修复的是地图选择逻辑。

## 验证

- 8项直接回归：黎音姓名／小墨脚底复现、全部16个固定身份、重叠绘制顺序、游客身份、气泡、过期目标和八向移动。
- 两种画风各18次真实鼠标点击：15名AI居民的身体、管家、黎音姓名，以及缩放／拖拽后的黎音姓名。居民详情的编号、姓名、立绘标签一致，管家打开原有对话入口。
- 测试通过原生地图拖拽避开HUD遮挡，在125%设备缩放下执行；未出现页面脚本异常或缺失美术请求。
- 使用隔离虚构小岛、正常游戏时钟；没有调用外部模型或改动实际用户存档。证据为[公开摘要](npc-map-identity-verification.json)。

复现命令：

    node --test tests/map-character-picker.test.mjs tests/facing.test.mjs
    node tests/map-character-identity-browser.mjs

## English

The old map picker checked only a 25-unit radius around actor feet and selected the first array entry. Clicking Li Yin’s visible name could therefore open Xiao Mo’s card. Rendered bodies, nameplates and speech bubbles now retain their stable identity and use paint order for overlapping targets. Hover reveals the corresponding name. Both art styles pass 18 native mouse checks each, including all 15 AI residents, the steward and Li Yin’s label after zooming and panning. Eight focused picking and movement tests also pass. Tests use isolated fictional saves and no external model calls.
