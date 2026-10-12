# V167 · 启动核对期间暂停世界绘制 / Pause world drawing during recovery

V166 完整 CI 38260355812 最终 5/6。Intel Mac 原生农田的折纸刷新在原有 45 秒等待处失败，现场为 controller-6（游客恢复）、正在保存、无待确认命令/玩家作业、素材已激活，页面与素材错误为空。像素流程同一任务通过。未据此声称整个平台或实体 Mac 完成验收。

首次核对与画风事务已有逻辑暂停，但帧循环仍绘制水波、地图、人物并处理世界音效与设施表现。现在这两个阶段让出世界绘制，继续安排动画帧以服务浏览器存档回调，并更新 last 时间戳；核对结束后恢复正常绘制，无游戏时间补跳。每一项服务端核对、持久命令与回执保持原流程。

实际保护存档中创建 16 项居民休息作业后，原生 Edge 以 CPU 12 倍降速分别比较两风格：像素启动 32.232→9.877 秒，折纸 36.061→9.738 秒。原绘制占 13.712/16.206 秒；新版本核对阶段不做世界绘制。作业逐项取消并保留唯一回执，库存、金币、日数、岛屿身份与有效时钟未变，核对后可进入农田。该强制降速是定位用场景，不能视为 Mac 实机结果。

8 项原生刷新基线/冲突故障场景通过；双主题会客厅重试、画风保存与同存档、鼠标、布局、未保存草稿、600 帧 NPC 朝向检查通过。完整平台检查另行执行，原 45 秒等待与所有保护断言保留。test:startup 可复现当前源码 16 项作业恢复的原生检查；API 模型屏蔽，数据为声明的隔离夹具。

V166 独立包通过 945 项、1724 条目与 Git 一致，已在本机备份后恢复 4173/4174/4175，四份原存档身份、头像、库存与金币核对一致。该证据属于 V166；V167 独立包和全平台须另验。公开部署包仍 V158。

## 新宣传片

全部镜头从不可变 V166 源码包重新录制，2560×1440、60 fps、30 秒与原创 BGM。展示双风格、会客馆、居民交流、多形象管家、此前真实工具执行的保存文档与主子 Agent 结果，以及原生四次飞行、实际 28 岛币和奇观奖励；源素材以流畅区间剪辑，未插帧、未加速游戏。资料均为虚构示例，小游戏为占位演示的说明贯穿影片。原生播放、跳到片尾、双语与同源 MP4 下载哈希核对通过。旧片及旧记录保留。

## English

V166 full CI ended with five of six jobs passing. Intel Mac's origami farm reload exceeded the existing 45-second check during visitor recovery after artwork activation, with no pending command or page/asset errors. World rendering now yields during startup recovery and appearance transactions, while RAF callbacks and timestamp updates continue; normal drawing resumes without granting catch-up game time.

A native 12× CPU-throttled comparison with sixteen real protected orphan tickets reduced pixel startup from 32.232 to 9.877 seconds and origami from 36.061 to 9.738 seconds. Original rendering occupied 13.712/16.206 seconds. Unique receipts, stock, money, day, identity and accepted clocks were preserved, and farm entry worked afterward. Eight native reload-fault checks and both native lobby/theme checks passed. Full-platform and immutable V167 verification remain separate.

The new V166 film is a fresh native 1440p/60-fps capture with original music, actual completed minigame rewards and saved real Hermes/parent-child tool results. All briefs are fictional and prototype status is visible. Playback, end seeking, localization and hash-matching local download passed. Full 18R/28F/30T scope remains open.
