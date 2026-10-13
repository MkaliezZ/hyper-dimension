# V175 · 时令玩法、居民作息与有效时间

## 已实现

- 共享时钟继续每 30 个视觉日换季，每视觉日 15 分钟；单机、画风切换和会客使用同一时令。
- 现有 11 种作物按季节播种，选择面板显示适种季；小麦与药草四季可种。旧作物不因换季消失，仍可照料、成熟、收获。
- 每日天气由共享时钟稳定产生，服务端自行计算，客户端不能伪造。雨天只在已确认的有效游戏区间浇透待浇水农田；不抢占正在执行的农活，不以离线时间赠送成长。
- 普通垂钓和钓鱼大会锁定开局天气。雨天提竿窗口增加 0.35 秒、落点容错增加 15、跟鱼范围增加 20，张力基础增长减少 15%；产量和奖励上限不增加。
- 地图与会客地图显示今日天气，晴天不降水，冬季仅雪天飘雪；雨线和海面小涟漪使用世界坐标，拖动地图不会重启动画。未添加全屏天气滤镜。
- 16 位常住角色固定班次、夜间走回各自住所、起床继续任务；已接受作业确认后才休息。参加已同意的夜间活动可离家赴约，散场后再次归家，未受邀者继续休息。详见 [作息说明](resident-schedule-v175.md)。
- 修复 8–15 FPS 下存档丢弃有效游戏秒数的问题。帧推进和存档使用一致上限，仍保持隐藏/离线/冲突时不计时、单次请求最多 15 秒与服务端真实时间约束。
- 在地图打开已缓存会客馆时，不再重复切场景和触发保存。

## 本地证据

| 范围 | 结果 |
| --- | --- |
| 默认回归 | 1020/1020 通过，0 跳过；其中 1006 项领域规则、14 项运行目录保护。 |
| 8 FPS 双风格真实耕种 | 实际 183.487 / 185.276 秒成熟并收获；各获得小麦×3、回收种子×1，施肥次数由 3 减到 2；刷新与回执去重正确。 |
| 天气浏览器 | 像素/折纸 × 晴/雨/雪，小岛与会客地图一致；时令和适种面板可见，雨水实际改变田地状态；页面错误与缺图为 0。 |
| 居民作息 | 两风格各 16 人逐步寻路归家、睡醒继续；路径和位移预算正确；五类活动等待未确认工作，夜集受邀签到后归家。 |
| 会客馆 | 原 1500 毫秒门槛保留；缓存点击到两帧可见分别 26.5 / 43.3 毫秒。 |
| 低帧导航 | 本机 8/15 FPS 双风格四组约 5.6–5.9 秒到达农田。Mac Intel 曾出现约 16.8 秒，已加实际帧间隔诊断，不能以本机结果替代云端验证。 |

上述浏览器使用隔离虚构存档，模型接口停用；不是本轮真实 AI 或实体 Mac 验收。

## 尚未包括

扩容地图的完整四季原生底图、新增作物与配方、对应植物生长美术、夜间局部灯光与月亮水面倒影仍在制作。季节候选图尚未通过全部接缝审核，不替换已校准的地形。没有将单角季节素材、全图色罩或新增数字宣称为已完成的全岛季节美术。

本次不修改 50 基础物品 / 300 配方目录、不增加自动模型频率。公开视频仍保留原录制版本。源更新、云端 CI、不可变发布包和完整产品验收分别记录。

## English

V175 adds server-authoritative daily weather, seasonal planting for the existing 11 crops, rain watering during accepted active intervals and easier rainy-weather fishing without additional yields. Existing crops survive season changes. Both art styles and reception maps share the same clock and weather.

All 16 permanent residents follow work and home schedules. Confirmed work finishes before rest; invited residents can walk from home to an accepted night event and return afterward. The steward's manual Hermes work remains available at night. Automated model cadence is unchanged.

The low-FPS save clock now retains valid 8–15 FPS simulation time, while hidden/offline/conflicted time and the 15-second request cap remain protected. Cached gallery opening avoids redundant scene reset and saving. The default local suite passed 1020 checks. Native weather, farming and navigation evidence is Windows-only with isolated fictional data and blocked model calls. Mac Intel navigation remains under investigation; full seasonal terrain, additional crops/recipes and physical night lighting are not claimed complete.
