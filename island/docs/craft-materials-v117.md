# V117 · Materials that match the object / 物件与材料单

## 中文

55 项工具、陶艺、渔具、家居、露营物件及相关组合配方改为显式材料单，物品详情新增“制作构造”。成品 ID、贴图、数量和解锁层级保留；已有制作任务继续使用开工时接受的材料单。

| 物件 | 新材料逻辑 |
| --- | --- |
| 浇水壶 | 铜质壶身与壶嘴、铁提梁及握把，不再仅用木材和树脂制造容器 |
| 茶杯、花瓶、陶灯罩 | 每条完整材料链都包含陶土，不再用随机矿物和植物直接拼成陶器 |
| 暖手茶炉 | 改制陶炉，配置茶壶与三只杯子；茶叶和燃料在布置后另行补给 |
| 远投钓竿 | 升级已有渔竿，配线、钩和加固杆材；不消耗鱼饵制作杆体 |
| 壁炉木箱 | 木板、金属连接件、保护蜡；不再拆解靠垫 |
| 帐篷、睡袋、餐盒 | 按支架、织物、保温内层或容器构造投入，食物与工具分别准备 |

25 座建筑仍都提供和使用其他建筑的产物。材料图无循环，初始派对所需基础配方保持原有成本与可达解锁条件。V32 历史材料定义保持不变，当前新开工任务记录新材料契约；升级不会用新材料单替换旧任务的扣料。

### 验证

- 730 项完整默认检查在候选中通过；随后按茶炉图片把铁提架改为陶土改制，再通过 20 项最终针对性回归。
- 两套画风均检查水壶、茶杯、远投竿、木箱及茶炉的物品详情、材料数量、图片加载和横向溢出。
- 两套画风均以真实按钮、拼图操作和正常速度完成水壶制作及领取：实际服务端回执扣铜矿 2、铁矿 1、木材 1，发放水壶 1；装备接口确认成功，刷新后仍为自有工具。
- 实机制作使用预先备好原料的隔离测试岛，未注入完成状态、结果、时间或运行中库存，模型调用被阻断；这不是从零采集全过程或真人难度验收。

材料成本变化会影响经营投入，完整长期经济复核仍需推进。本次修订覆盖 55 项；其余 245 项仍需逐项校正和完善。小游戏继续作为待优化演示，不代表独立发布品质。

## English

This revision replaces generated material costs with explicit bills for 55 tools, ceramic pieces, fishing supplies, home/camping objects and related bundles. Item detail cards explain how each object is assembled. Stable item/artwork IDs and unlock tiers are retained. All 25 workshops still participate in an acyclic supply network.

A watering can now requires its metal container and handle materials; all ceramic chains require clay; a long-cast rod upgrades an existing rod instead of consuming bait. A tea station is built with its three cups and receives tea/fuel separately. Accepted work retains its original cost contract, including frozen historical V32 definitions.

The candidate passed 730 default checks. After a final tea-station material adjustment, 20 focused checks passed again. Both themes also passed native detail-card checks and an actual watering-can crafting sequence: normal UI inputs, completed puzzle, output animation, one server settlement, equipment confirmation and reload. The verified receipt spent copper 2, iron 1 and wood 1 for exactly one watering can. These stocked, isolated fixtures made no model calls and are not zero-start, human or complete economy acceptance.

The remaining 245 definitions and full product acceptance still require work. Minigames remain demonstrations under continued improvement.

## Checks

```sh
npm test
npm run test:craft-materials
npm run test:craft-materials:browser
npm run test:craft-materials:production
```

Browser checks require the browser test dependencies and an installed supported browser. They create isolated test data; they do not open user saves.
