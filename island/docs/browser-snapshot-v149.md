# V149 · 按实际渲染快照检查 NPC

V148 的 CI 中，Windows 和 macOS ARM 的新检查偶尔把刚收到的网络状态与上一帧画面比较，严格朝向断言因此失败。原始失败在 [V148 提交的流水线](https://github.com/MkaliezZ/hyper-dimension/actions/runs/37973090777) 保留；该源码包保留为未发布草稿。

V149 等待两个实际 animation frame，并确认显示角色的 snapshotAt 等于被检查的服务器 updatedAt，再执行原来的严格朝向比较。没有放宽角度阈值、删除移动样本、改变速度或注入游戏时间。角色插值与行走规则沿用 V148。

[本机重跑](verification/v149/rendered-snapshot-native.json) 双画风各 600 次居民观察通过，同时复核临时 503、同档换画风、刷新、主题鼠标、会客馆草稿和桌面／窄屏布局。当前正式公开前仍以本提交三平台流水线为准。

[新宣传片的真实在线播放](verification/v149/public-player.json) 从开始播放到 30 秒结尾，不跳时间；2560 × 1440，1800 个视频帧，原生播放器报告 0 丢帧，音轨未静音。中英文与窄屏无横向溢出。影片来源 V145；当前代码 V149，两者版本分别记录。
