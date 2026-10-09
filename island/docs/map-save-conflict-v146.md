# V146 · 地图点击与存档版本冲突 / Map clicks and save version conflicts

自动保存收到明确的版本拒绝时，按已确认的服务端基线合并互不重叠的修改，保留本页操作，再继续保存。网络超时、未确认作业、同一字段冲突不会被当作已结算。

无法安全合并的进度会显示可点击的恢复卡片；核对使用原请求编号，并保留暂存副本。地图暂停不再只表现为角色没有反应。

## 验证

- 双画风真实 HTTP 存档冲突：独立修改均保留；重叠修改可核对，副本保留。
- 双画风原生空地移动、居民详情关闭后的移动、房屋到达及进入。
- 高潮与恢复提示叠加释放、延迟会客准备、弹窗关闭恢复。
- 当前私有存档副本的像素地图通过；浏览器检查工具遇到宿主 ACL 错误，未能读取用户当前窗口。这些结果不等同于该窗口的直接验收。

[冲突证据](verification/v146/save-conflict.json) · [地图证据](verification/v146/map-navigation.json)

## English

A definite autosave version rejection now merges independent changes against the last acknowledged server baseline. Timeouts, unconfirmed actions and overlapping edits remain protected. A visible recovery card exposes the existing receipt-preserving recovery path whenever progress cannot be merged safely.

Native Edge checks passed for both appearances: independent and overlapping HTTP save conflicts, backup preservation, ground movement, resident dialog closure, building entry, overlapping locks and visitor pause/resume. An isolated copy of the existing pixel save also passed. Host ACL failures prevented inspection of the current user's browser window; automated checks are not physical macOS or human acceptance.
