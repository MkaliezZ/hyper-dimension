# V171 · 会客移动与房屋地块校准

## 连续移动

- 连点时保留最新未发送目的地，首条确认后发送末条；使用原有持久请求编号和丢包恢复。
- 联机寻路使用显式画风的预计算静态通路，并继续检查人物避让和连续路段。
- 按已确认走过的路点插值，转弯不会切过建筑后突然跳位；NPC与随行管家共用同一运动逻辑。
- 普通移动回执更新地图，不重建整个会客页面。居民第一次参观前往第二个兴趣建筑；原地已达目标返回空路线。
- 未标记地图版本的旧开放会客房先保留完整校验原档，再适配落在水域、建筑内的站位与旧路径。已结束房间保留历史记录。

## 建筑中心

25座生产建筑与16座住所，以实际地块中心对应房屋的占地底座轴。两侧花盆、棕榈与船坞架子不计入居中轴。屋顶与底座使用相同比例；阴影、名称及点击矩形随实际绘制位置。

旧贴图按网格取alpha包围框，会混入隔壁屋顶尖及下一行碎片。现在从完整连通房屋取得裁切框，保留越过名义网格线的真实屋顶。原PNG校验与裁切范围可重建：

```sh
python tools/build-house-bounds.py --check
```

访问 `/play?align=1` 或会客房 `/?align=1` 可显示校准图层：黄点与黄框为地块中心／占地范围，蓝十字为房屋底座中心，白虚框为实际贴图与点击范围，粉色点线为入口。正常页面没有校准层。

## 验证

[实测记录](verification/v171/lobby-ground.json)：双画风快速改点、实际连续移动、至少三个自主NPC的运动、丢包原请求恢复及进入建筑／住所通过。实际受观察的移动NPC为每画风7位；其种类包含居民与随行伙伴。聚合样本最长帧12.2ms；这个样本不表示所有设备和场景永不卡顿。

旧开放会客房的适配分别通过像素与折纸真实磁盘测试，原身份、头像、聊天和校验备份保持可核对。最新大地图的全图四季、天气与住宅作息继续开发。

## English

Replaceable movement intent keeps only the newest unsent target while durable acknowledged commands retain nonce-based recovery. Theme-specific baked terrain edges keep crowd avoidance. Rendering follows confirmed waypoints through corners without predicting beyond accepted positions, and movement receipts no longer rebuild the lobby DOM.

Ground parcel centres align with calibrated building footprint axes. Complete sprite components avoid neighbouring atlas fragments; dimensions keep a single scale. Append `align=1` to inspect centres, footprints, sprite hit rectangles and entrances. Evidence is from isolated native Windows browsers; physical Mac and complete product acceptance remain separate.
