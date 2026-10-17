# V243 · 零开局连续流程与新演示

## 从零到首场派对

两套画风分别使用服务端零币、零库存新档，在正常时钟下实际完成：认识管家、采集与采矿、制作灯笼、两次订单、领取已达成里程碑、播种浇水、约三分钟自然成熟及收获、居民筹备、两次邀请、道路赴约、四幕放灯、奖励与纪念领取，最后在空浏览器中恢复同一进度。

两岛最后均为 48 岛币；没有修改原料、人物位置、需求、时间或游戏结果。接口检查没有未预期错误。共创商品从零制作、刷新续做与游客成交另见 V242，不能把两条独立旅程说成同一次完整游玩。

此前旧检查把筹备等待限制为 360 秒日历时间，居民下班后未能在该时间内完成，原失败保留。本轮单独核对正常作息：仍限 360 秒可工作时段，日历等待最多两个正常视觉日；实际等待约 613 秒，其中可工作时段约 92／94 秒。没有快进或跳过夜晚。

可复现入口：

```sh
npm run test:zero-first-night
```

该入口显式启用工作时段观察；原测试默认的 360 秒日历门槛保持不变。观察器只读取服务端世界时钟和任务，不操作角色或完成工作。新增便携入口会随最终源码包在独立安装环境再核对。

另核对了两套浏览器保留旧规则待存记录的情况：旧 policy105 基线与已水合的 policy202 本地状态能自动核对、正常保存、切换画风与刷新，未再次出现存档冲突。它们使用虚构账户和构造的历史记录，没有读取用户浏览器。

## 新的 30 秒展示

演示重新导出双画风海岛、四季夜景、真实跨岛居民交流记录、12 套管家形象、真实历史 Word 成果、管家与伙伴委派记录、会客馆，以及建筑弹窗内实际完成的小游戏和奖励。配原创 BGM，保留“小游戏为占位演示”的说明，以三秒品牌与开源地址结尾。

画面为原生 1440p、每秒 60 个等模拟时步导出，无旧视频片段或补帧；该帧率不代表实时性能。主岛、形象、会客馆、工作文档和小游戏来自保留的 V233 渲染版本，管家协作与跨岛记录由 V242 展示。本轮恢复修复未改变所展示的美术及小游戏规则。模型与工具结果是真实执行后保留的虚构演示资料，不冒充本轮重新调用。

首次合成发现一个镜头的画布尺寸回缩和留白，视觉检查记失败并保留原件；修正录制尺寸后再发布。证据分别见[零开局与待存记录](verification/v243/zero-first-night.json)及[视频来源](media/v243-showcase-verification.json)。

以上不代替全部活动的零开局长期经济、正式 OPC 学员课程、5–8 位新玩家、实体多设备、最终源码包安装或当前版本一小时验收。完整目标仍进行中。

## English summary

Both zero-resource native journeys completed real gathering, crafting, normal crop growth, scheduled resident preparation, invitations, four lantern launches, paid rewards and empty-browser recovery. The unchanged useful-work budget is observed separately from bounded normal calendar waiting; previous failures remain recorded. Two old-policy browser-journal cases also saved, switched appearance and reloaded correctly. The new 30-second showcase includes actual retained cross-island conversation, real tool results, native-popup gameplay, original music and a complete ending. It is an offline equal-step render, not a live frame-rate or human acceptance claim.
