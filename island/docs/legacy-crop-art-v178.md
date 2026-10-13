# V178 · 全作物生长美术 / Complete crop growth artwork

## 中文

原有 11 种作物补齐像素、折纸两套专用生长素材：小麦、稻米、玉米、亚麻、胡萝卜、土豆、南瓜、番茄、草莓、棉花、药草。每种有幼苗、成长、结果／未熟和成熟四个阶段，新增 **88 个生长形象**。与 V176 的八种作物合计，农田 **19 种作物、双画风 152 个生长阶段**均有对应原生素材。

六张透明原生图集按完整植株轮廓裁切，测量土壤接触点作为根部锚点。小麦和稻米具有不同穗形；成熟南瓜连着藤蔓落在地面，棉桃沿枝干生长；胡萝卜、土豆的地下部分不悬挂在叶片上。像素与折纸各用自己的素材，没有将一种画风的图片着色后充当另一种。

幼苗小、成熟植株大，根部始终落在同一田垄位置。风动只作用于上部叶片，茎基和土壤接触区保持稳定。宽株的玉米、棉花、草莓、土豆、南瓜与番茄使用六株展示；细株谷物、胡萝卜和药草使用十二株展示。这些是田垄的视觉密度，实际收获数量仍按原作物规则结算。

本次是生长美术与种植密度升级，沿用现有季节、成熟时长、种子消耗、收获量和服务端回执。V177 联机旧档目录修复继续保留；不会因换图赠送作物或重建进行中的农活。全部图像字节保持原生输出，几何参数见 `src/legacyCropArtFrames.js`，生成提示与摘要见 [美术来源记录](legacy-crop-art-provenance-v178.json)。

## English

All eleven original crops now have dedicated pixel and origami growth art: wheat, rice, corn, flax, carrot, potato, pumpkin, tomato, strawberry, cotton and herb. Four stages per crop add **88 native growth sprites**. Together with the eight V176 crops, all **19 crops have 152 growth-stage sprites across both styles**.

Six transparent native atlases retain their original image bytes. Complete silhouettes and basal soil contact points define their crop regions and anchors. Wheat and rice have different heads; pumpkins rest on the soil attached to vines; cotton bolls grow on branches; root vegetables do not hang from foliage. Both styles use independently generated artwork.

Plants increase in size while their soil contact remains fixed. Only upper foliage sways. Corn, cotton, strawberry, potato, pumpkin and tomato use six visible plants per bed; narrower crops use twelve. Visual density does not change the authoritative harvest quantity.

This update retains seasonal gates, growth times, seed costs, yields and server receipts, including V177 LAN catalog migration. Replacing artwork grants no stock or resets to ongoing work. Measured geometry lives in `src/legacyCropArtFrames.js`; [provenance](legacy-crop-art-provenance-v178.json) records the built-in imagegen prompts and SHA-256 values.

## 验证范围 / Evidence scope

自动检查覆盖 19 种作物的目录、原生 PNG 尺寸和摘要、完整非重叠裁切、每阶段田垄比例、根部稳定以及既有工具与结算。原生浏览器通过实际绘制模块展示两画风各 44 个旧作物阶段；实际农田使用明确标注的成熟作物夹具检查布局、麦穗割取和胡萝卜松土拔取、唯一收获与刷新保留。未加速真实用户存档，未注入胜利或调用模型。

Automated checks cover all crop definitions, native PNG dimensions and digests, isolated complete crops, bed proportions, fixed roots and existing harvesting tools/settlements. Native browser checks render 44 legacy growth stages per theme through the actual drawing module. Farm checks use explicitly mature fixtures to verify bed layout, wheat cutting and carrot pulling, unique harvests and persistence. These are isolated prepared-crop checks, without user save changes, win injection or model calls.

本次不构成全岛四季地形、实体夜灯与月影、长期经济或真人完整验收。这些仍在完整交付范围内。

This does not complete full-map seasonal terrain, physical night lighting and moon reflections, long-term economic or human acceptance. Those remain in the full delivery scope.

```sh
node --test tests/v178-legacy-crop-art.test.mjs
node tests/v178-crop-stages-browser.mjs
node tests/v178-legacy-farm-browser.mjs
```


最终默认检查 1078/1078 通过（1064 领域规则 + 14 运行目录保护），0 失败、0 跳过。两画风 88 个阶段实际绘制通过；两组农田共四次原生浏览器检查覆盖 11 个旧作物、19 个已加载作物资源，实际麦穗割取和胡萝卜拔取各获得作物2、种子1，刷新不重复。

The final default gate passed 1078/1078 (1064 domain checks and 14 runtime guards), without failures or skips. All 88 native legacy stages rendered; four native farm cases cover all eleven legacy crops and all nineteen loaded crop resources. Wheat cutting and carrot pulling each received two crops and one seed, without duplicate gains after reload.
