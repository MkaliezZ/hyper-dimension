# V176 · 时令作物与食品 / Seasonal crops and food

## 中文

### 内容范围

目录由 50 种基础素材、300 个配方扩展为 **58 种基础素材、308 个配方**，合计 366 个物品；农田可种作物由 11 种扩展为 **19 种**。新增内容追加在原目录之后，旧 50 种素材和 300 个制品的图集索引不变。V1 收集和配方成就仍使用原来的 50 / 300 集合；本次没有增加成就门槛，也不因更新追发奖励。

两画风使用同一份玩法规则与共享存档。每 **30 个视觉日**轮换季节；岛务、委托和赠礼仍按 **900 秒有效游戏时间**推进经营日。视觉时钟与有效游戏时间不是同一个计时器，离线时间不会直接变成农作物成长或经营收入。天气与时钟规则见 [V175 说明](weather-life-v175.md)。

### 新增作物

以下时间为浇水后累计的有效成长秒数，不包括走路、松土、播种和收获动作。可以进入农田、拥有通用种子且处于适种季即可播种；这八种作物没有额外研究等级门槛。

| 作物 / ID | 可播种季节 | 成熟秒数 | 每次基础收获 |
| --- | --- | ---: | ---: |
| 甘蓝 `cabbage` | 春、秋 | 480 | 2 |
| 豌豆 `pea` | 春、秋 | 420 | 2 |
| 黄瓜 `cucumber` | 夏 | 600 | 3 |
| 茄子 `eggplant` | 夏、秋 | 720 | 2 |
| 蓝莓 `blueberry` | 夏 | 900 | 3 |
| 红薯 `sweet_potato` | 秋 | 780 | 2 |
| 白萝卜 `daikon` | 秋、冬 | 540 | 2 |
| 羽衣甘蓝 `kale` | 秋、冬 | 480 | 2 |

- 每次播种消耗通用种子 ×1，收获回收种子 ×1；没有新建八种独立种子物品，也不会自动发放种子或成熟作物。既有种子补给包仍为 18 币 / 5 粒。
- 肥料 `c14_8` 每袋支持三次收获，每次增产 1 份，不缩短成熟时间。施肥需实际持有并消耗该物品。
- 季节限制新播种。已种下的跨季作物可以继续照料和收获，库存中的收获物也可跨季制作。
- 雨水仅作用于服务端接受的有效成长区间；读取存档、刷新或重开不凭空浇水，不抢占已接受的农活。雨天钓鱼容错沿用 V175，收获及现金上限不增加。
- 当前包括蓝莓在内均为单次收获，收获后田垄回到空地，再松土播种；没有多年生果树或自动连续结果规则。
- 原材料可以赠礼或制作，不能直接作为食品享用；游客货架销售本馆制成品，不直接出售这八种生鲜作物。

### 新增食品与解锁

每个配方消耗表中完整材料单，成功结算产出 **1 份食品**。材料不足的练习不产出物品。基础图纸需要对应建筑开放；进阶图纸另需本馆熟练度至少 2、设施品质至少 50。熟练度按现有规则取本馆小游戏完成数与制作次数的较大值，再加研究等级。食品没有额外的制作季节限制。

| 食品 / 物品 ID | 建筑 | 解锁 | 一份材料 | 售价 | 扣营业费后入账 |
| --- | --- | --- | --- | ---: | ---: |
| 甘蓝饭卷 `season_cabbage_wrap` | 海边食堂 | 基础 | 甘蓝 ×2、稻米 ×1、药草 ×1 | 8 | 5 |
| 豌豆浓汤 `season_pea_soup` | 海边食堂 | 基础 | 豌豆 ×2、土豆 ×1、海盐 ×1 | 9 | 6 |
| 黄瓜薄荷饮 `season_cucumber_cooler` | 风铃茶屋 | 基础 | 黄瓜 ×2、薄荷 ×1、蜂蜜 ×1 | 9 | 6 |
| 番茄焗茄 `season_roasted_eggplant` | 海边食堂 | 进阶 | 茄子 ×2、番茄 ×1、药草 ×1 | 12 | 8 |
| 蓝莓小挞 `season_blueberry_tart` | 烘焙屋 | 进阶 | 蓝莓 ×2、小麦 ×2、蜂蜜 ×1 | 12 | 8 |
| 红薯面包 `season_sweet_potato_bread` | 烘焙屋 | 进阶 | 红薯 ×2、小麦 ×1、蜂蜜 ×1 | 12 | 8 |
| 萝卜海鱼汤 `season_daikon_soup` | 海边食堂 | 基础 | 白萝卜 ×2、海鱼 ×1、海藻 ×1 | 10 | 7 |
| 冬叶沙拉 `season_kale_salad` | 海边食堂 | 基础 | 羽衣甘蓝 ×2、胡萝卜 ×1、海盐 ×1 | 9 | 6 |

配方 ID 为物品 ID 前加 `recipe_`。清水、共用炉具、杯盘由建筑提供，不额外扣除背包中的工具或餐具；原材料名称中的稻米、小麦包含配方说明中的煮制、磨粉等准备流程。

### 成品用途与经济边界

- **自己享用：**每次消耗 1 份。基础食品补饱足 20、体力 10；进阶食品补饱足 27、体力 15，均不超过 100。接下来三次制作获得既有营养品质加成；再次进食刷新三次额度，不无限叠加。
- **赠送居民：**消耗 1 份，按品类喜好与等级增加好感，记录收礼记忆；同款第二次收益降低，第三次不再消耗，每位居民每日赠礼好感总增量上限为 8。食品同时按既有规则补充居民需求。
- **居民用餐：**居民从可用库存选择食品并真实消耗；已预留给其他工作的材料不能被吃掉。同一作业重复确认不会重复扣除。
- **补货与售卖：**自动货架从背包实际库存出售食品，默认保留量为 0；可手动配置保留数量或暂停销售。已手动配置的旧货架保持原样，需要自行加入新食品。茶屋、食堂、烘焙屋的可配置目录分别为 13、17、14 种，不再统一截断到 12 种。
- 每笔销售扣除向上取整的 30% 营业费；上表入账为 5–8 币，**尚未扣除种植、补给与每日岛务成本**，不等于全链路利润。售罄、预留或未上架时不凭空产生商品销售收益。
- 既有每日三份普通委托、奖励和 900 秒经营日不变。专精委托可以选到符合解锁条件的新食品，仍须当日接单后真实制作、质量达标、消耗成品，并使用唯一回执结算；新增配方不增加每日接单次数。

### 存档、制作与美术兼容

服务端读取旧档时，先验证库存与预留关系，再备份并给缺失的目录键补 **0**。原有非零库存、发现记录和未知的扩展字段保留；空背包不会获赠物品，缺失已预留物资的损坏存档不会被补成可结算状态。目录版本升级只执行一次，保留在制配方的已接受材料单、小游戏状态与历史回执。

新增制作在服务端开工时记录本次配方及实际食材，浏览器不能指定结果、品质、免费材料或重复领取。取消、继续与结算仍使用已接受材料单。厨房切配跳过海盐、蜂蜜、稻米和小麦等不应切割的食材；旧 300 配方和旧在制小游戏不因本次追加内容而重建。

新增八种作物分别使用像素 / 折纸四阶段生长贴图，收获物和食品使用独立裁切的对应图像，合计 **64 个生长阶段 + 32 个物品形象**。定义在 `src/cropArtFrames.js` 与 `src/individualItemArt.js`，旧图集仍用于原目录。**原有 11 种作物尚未全部具备这种专用四阶段生长素材**；本版不能据此宣称 19 种作物全部完成同等美术升级。种子仍使用既有通用种子图像。

### 本地验证与未完成边界

| 范围 | 已记录结果 |
| --- | --- |
| 新内容及相关领域回归 | 150 / 150 通过，0 跳过；包含目录、季节播种、实际制作与消耗、在制恢复、回执去重、货架和原成就集合。 |
| 迁移与经济风险回归 | 78 / 78 通过，0 跳过；覆盖双画风、单机 / 联机外部经济模式、缺失零值、非零保留、历史回执哈希、旧请求重放、预留保护及每日收入边界。 |
| 默认回归的规则快照 | 1006 项领域规则 + 14 项运行目录保护通过，失败和跳过均为 0；该次运行发生在后续美术及原生小游戏验证之前，当时新 V176 测试尚未加入默认命令。 |
| 三类原生制作流程 | 豌豆浓汤、黄瓜薄荷饮、蓝莓小挞 × 两画风，6 / 6 通过；在房屋工作台内用真实鼠标 / 键盘操作、正常时钟通关，服务端按材料单扣料，各领取一份并刷新验证不重复领取。页面错误和缺图均为 0。 |

以上套件有交集，不能相加作为独立覆盖数量。新增测试见 `tests/v176-season-content.test.mjs`、`tests/v176-catalog-risk.test.mjs` 与 `tests/v176-season-recipes-browser.mjs`。规则证据来自隔离的虚构存档与合法重放；浏览器使用预先解锁、备齐材料的隔离存档，依据合法解法自动操作，没有注入胜利结果，没有使用真实玩家数据或调用付费模型。

原生证据覆盖三个代表配方，不能扩展为八个配方的全部难度、从零经营或真人趣味性验收。小游戏仍是继续打磨的演示玩法。完整四季地形、旧作物生长美术、夜间灯光与长期经营平衡也不由本次内容扩展宣称完成。

## English

### Scope and growth

V176 appends eight raw crops and eight food recipes: **58 raw materials, 308 recipes, 366 catalog items and 19 plantable crops**. Original atlas indices stay unchanged, and the V1 achievement sets still contain the original 50 materials / 300 recipes. Existing islands receive no stock or retroactive rewards from the update. Both visual styles share the same rules and save.

Seasons rotate every **30 visual days**. The economic day still requires **900 accepted active seconds**. These clocks are distinct; offline time does not award crop growth or town income.

| Crop / ID | Sowing seasons | Active growth seconds | Base harvest |
| --- | --- | ---: | ---: |
| Cabbage `cabbage` | Spring, autumn | 480 | 2 |
| Pea `pea` | Spring, autumn | 420 | 2 |
| Cucumber `cucumber` | Summer | 600 | 3 |
| Eggplant `eggplant` | Summer, autumn | 720 | 2 |
| Blueberry `blueberry` | Summer | 900 | 3 |
| Sweet potato `sweet_potato` | Autumn | 780 | 2 |
| Daikon `daikon` | Autumn, winter | 540 | 2 |
| Kale `kale` | Autumn, winter | 480 | 2 |

Growth starts after watering. Each sowing consumes one generic seed, and harvesting returns one seed. No separate crop seed items or research gate were added. Existing fertilizer consumes one item for three harvest charges, each granting one additional crop without accelerating growth. All crops, including blueberry, currently reset the plot after one harvest.

Sowing is season-limited; planted crops survive a season change and stored produce can be cooked later. Rain waters only during server-accepted active intervals, respects ongoing work and grants nothing on a read or reload. V175 rainy-fishing assistance and reward caps are unchanged. Raw crops support crafting and gifts; direct eating and visitor sales require prepared food.

### Recipes and uses

The following bills each produce one item. A basic recipe requires its venue to be open. An advanced recipe also requires venue proficiency 2 and quality 50. Proficiency retains the existing maximum of completed room games and craft count, plus research. Recipe IDs use the `recipe_` prefix before the item ID.

| Food item | Venue / gate | Ingredients for one item | Price / proceeds after fee |
| --- | --- | --- | ---: |
| `season_cabbage_wrap` | Diner / basic | Cabbage 2, rice 1, herb 1 | 8 / 5 |
| `season_pea_soup` | Diner / basic | Pea 2, potato 1, sea salt 1 | 9 / 6 |
| `season_cucumber_cooler` | Tea house / basic | Cucumber 2, mint 1, honey 1 | 9 / 6 |
| `season_roasted_eggplant` | Diner / advanced | Eggplant 2, tomato 1, herb 1 | 12 / 8 |
| `season_blueberry_tart` | Bakery / advanced | Blueberry 2, wheat 2, honey 1 | 12 / 8 |
| `season_sweet_potato_bread` | Bakery / advanced | Sweet potato 2, wheat 1, honey 1 | 12 / 8 |
| `season_daikon_soup` | Diner / basic | Daikon 2, fish 1, seaweed 1 | 10 / 7 |
| `season_kale_salad` | Diner / basic | Kale 2, carrot 1, sea salt 1 | 9 / 6 |

The venue supplies water and shared cookware. Practice without sufficient ingredients produces no stock. Accepted material contracts control actual deduction, cancellation and resume; the client cannot submit a free recipe or a completed result.

- Eating consumes one food: basic items restore hunger 20 / energy 10, advanced items 27 / 15, capped at 100. The existing nutrition bonus applies to the next three crafts; repeated eating refreshes this allowance rather than stacking it indefinitely.
- Gifts consume one item, respect preferences and diminishing repeat rewards, and cap daily gift affinity at 8 per resident. Residents also consume real available food stock for meals. Reserved items remain protected.
- Visitor shelves sell available inventory and deduct a rounded-up 30% operating fee. The listed proceeds exclude growing, supply and daily town costs. Automatic food shelves keep zero by default; existing manual shelves are preserved. Tea house, diner and bakery capacity now follows their actual 13, 17 and 14 recipes.
- The three ordinary daily orders and economic clock are unchanged. A specialization commission may select a new eligible recipe, but still requires accepted, fresh, quality-qualified production and a unique daily settlement receipt.

### Compatibility, artwork and evidence

Canonical save migration validates existing inventory and reservations, backs up the save and fills only missing catalog keys with zero. It preserves nonzero inventory, accepted craft state, historical receipt hashes and existing request replay behavior. Missing reserved material is an error, not a reason to grant stock.

The new crop definitions reference 64 dedicated growth-stage frames across the two styles; the eight harvest items and eight foods provide another 32 style-specific item images. The original 11 crops **do not yet all have dedicated four-stage growth art**. Generic seed art remains unchanged. Art definitions live in `src/cropArtFrames.js` and `src/individualItemArt.js` without replacing the original atlas order.

Recorded local evidence: 150 related content checks and 78 migration/economy checks passed with zero skips. These suites overlap. A separate default-rule snapshot passed 1006 domain checks plus 14 runtime-scope checks before later art/native-game acceptance work; the V176-specific tests had not yet been registered in that default command. Tests use isolated fictional data and legal rule replay, without real player data or paid models.

Native browser checks passed **6 / 6**: pea soup, cucumber cooler and blueberry tart in both styles. Real mouse/keyboard controls completed embedded room workbenches at the normal clock rate, with authoritative material deductions, one output per craft and no second claim after reload. Page errors and missing assets were zero. These checks use pre-unlocked, prepared-material fixtures and automated legal solutions, without injecting a win. They do not establish all eight recipes at all difficulties, zero-start progression or human enjoyment. Minigames remain demonstration gameplay under refinement. This content update does not claim completed full-island seasonal terrain, all legacy crop art, physical night lighting or long-duration economy balance.

## Commands

```sh
node --test tests/v176-season-content.test.mjs tests/v176-catalog-risk.test.mjs
npm test
```

Update frontend and backend together after backing up data. Browser acceptance and release records should be updated from their own final evidence, not inferred from these rule-test counts.


## Final local gate / 最终本地检查

七个 V176 新规则文件已加入默认命令，最终 npm test 为 **1071/1071**（1057 领域规则与 14 运行目录保护），0 失败、0 跳过。美术检查 116 个素材与 616 个制作品条目，覆盖两画风 SVG、场景与手持。前文 1006+14 是较早快照，保留为历史记录。两画风农田最终以实际绘制模块同步状态验证，16/16 图像加载且自然尺寸1254×1254，实际采收通过；早期异步等待过早采样的报告已被最终同步验证替代。

The seven V176 test files are included in the default command. The final gate passed **1071/1071**, without failures or skips. Native art checks covered 116 material and 616 product entries across both styles. Final farm verification reads the actual renderer synchronously: all 16 sheets loaded at their native 1254×1254 dimensions, and real harvest receipts passed. Earlier premature asynchronous status samples are retained as historical evidence only.
