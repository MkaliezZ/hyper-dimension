# V141 · 地图操作恢复 / Map interaction recovery

- 会客入口准备存档时不再提前暂停小岛；弹窗真正打开后才暂停，关闭或准备失败会释放状态。
- 高潮提示和作业恢复提示叠加时，提示关闭会更新恢复系统记住的基础 inert 状态，解除恢复锁不再重新锁住地图。

保留服务端结果核对与存档冲突保护，不清空用户进度。

Windows 本机 Edge 原生验证通过：像素和折纸的空地移动、居民卡片关闭后移动、建筑到达及进入房间；叠加锁释放、延迟会客准备、打开及关闭会客。私有隔离副本也复核了当前地图与权威存档，未改动生产数据、未调用模型。

## English

Visitor preparation keeps the island playable until its dialog opens. Closing a scene overlay updates the recovery system's remembered base inert value, preventing a stale input lock. Native Edge checks passed for ground movement, resident dialog closure, building arrival and entry in both appearances, overlapping lock release and visitor pause/resume. Existing save progress and recovery safeguards remain intact.

```sh
node tests/map-navigation-browser.mjs
node tests/map-interaction-locks-browser.mjs
node tests/map-character-identity-browser.mjs
```

These are local automated checks, not physical macOS or human acceptance.
