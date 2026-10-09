# V144 · 附近居民的空间声音 / Nearby resident sound

## 场景规则

- 以当前场景内的玩家位置为听音位置。室外使用地图坐标；屋内只听到同一房间的室内人物坐标，避免把地图与房间混用。
- 近处正常响度，随距离平方衰减；左右位置对应独立声道。只保留最近四名可听居民，超出范围不发声。
- 脚步跟随真实步态半周；工具声跟随现有动作触碰（工作1.4秒循环，休闲整理4秒）。只有当前说话者的新台词发出交谈声，听者和站立居民保持安静。
- 场景切换、小游戏、暂停与后台会清理旧声音；恢复不会补播已经错过的动作。48个声音节点上限和静音／分频道偏好保持。
- 使用原创程序音效及浏览器原生 StereoPanner；无此节点的设备保留居中播放。全局偏好仅存本设备，不写入小岛经济存档。

## 本次证据

16项声音专项通过（包括原有音量兼容）。原生Edge在像素／折纸新岛实际产生居民声；两声道实际样本验证左／右分离、居中一致、距离静音及总静音归零，设置刷新保留。页面与素材错误为零。[脱敏结果](verification/v144/verification.json)。

最终的慢速整理周期由最后新增专项验证；原生场景验证覆盖居民脚步和声道路由。此项不宣称真人试听、全部动画／声效质量或完整产品验收。完整默认回归通过895项（881领域／14维护）；最后添加的整理周期专项和房间场景名修正另测通过，集合重叠，跨平台CI结果另记发布记录。

## V143真实零起点协作追加证据

V143两个画风均从零库存、零币开始，以原生输入和正常时钟完成斧头／矿洞采集、制作、183–185秒实际作物成熟、两笔赚取订单、真实DeepSeek Flash/Hermes主子招聘、乘船到岛、3项真实子交付、本人邀请、四幕夜集、协作成就、工资、离岛与刷新。各约529–536秒。[脱敏证据](verification/v143/zero-agent-real.json)。这是V143的实录，完整五模板、真人与实体设备验收继续。

## English

Nearby residents have distance attenuation and screen-direction stereo, using current-scene coordinates and at most four sources. Footsteps follow actual gait crossings, tool sounds follow visual contact, and only new spoken lines produce conversation cues. Pausing, changing scenes or entering a minigame clears pending resident history. Existing global mute, category levels, voice limits and device preferences remain.

Sixteen focused sound checks and native Edge verification in both styles pass. Actual two-channel sample rendering confirms direction, centered equality and silence beyond range or when muted. This is neither human listening nor whole-product acceptance. The separate linked V143 zero-start journey uses real Flash/Hermes, normal clocks and earned materials; its version and limited scope remain explicit.
