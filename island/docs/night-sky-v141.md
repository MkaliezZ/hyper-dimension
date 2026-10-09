# V141 · 星图夜集 / Starlight gathering

## 玩法与入口

广场 → 星灯夜集 → 准备方案、用品和邀请 → 等伙伴沿道路实际到场 → 共绘星图。小游戏保留在小岛的活动弹窗中。

四幕依次放飞星灯，每幕由服务端随机种子确定星点、横风与云带。玩家拖动天空或使用角度、升力控件选择路线；放飞后观察偏航，用一次空中修正靠近星点。路线预览只显示前一段，下一幕会换目标与风况。偏航仍可继续完成聚会，精准到达会点亮星图并增加表现奖励。

| 操作 | 鼠标／触屏 | 键盘 |
| --- | --- | --- |
| 瞄准 | 拖动天空，或调整角度和升力 | 方向键 |
| 放飞 | 放飞星灯 | 空格 |
| 空中修正一次 | 左／右修正 | A／D |
| 继续下一幕 | 准备下一幕 | 按钮 |
| 结算 | 四幕完成后一起庆祝、领取奖励 | 按钮 |

像素版使用像素星光、云层与海面；折纸版使用折面天空、纸云和星光。舞台使用对应风格的星灯素材与实际参与居民形象；多人采用分开的站位。舞台、操作、结果与固定关闭按钮继续使用小岛弹窗布局，390像素宽时纵向排列。

## 经营与恢复

基础夜集保持原有经济规则：8币承办费用，完成奖励20币，加上每颗精准星点2币（基础完成总奖励20–28币）。自定义方案继续按主题计算额外奖励与用品；邀请礼物、制作、好感、纪念品和贡献来源遵守已有服务端规则。没有通过新玩法放大经营收入。

飞行时正常进度提交可在后台进行；暂时延迟不会暂停飞行。暂停、收起与刷新保留原种子、飞行状态、已使用修正及请求编号。领取前先提交全部输入，再由服务端重放规则确认结果；收到回复前显示“正在完成”，真正失败才展示恢复操作。重试丢失回复的结算读取原回执，不能重复发放奖励。

旧版进行中的四次节奏点击夜集继续使用原规则；新开场明确声明玩法版本2。同一个请求编号不能更换规则，不支持的版本在扣费和释放准备计划前拒绝。

## 验证

默认回归门通过878项（864项领域检查与14项维护检查），无失败。

- 两种画风的鼠标瞄准、键盘放飞与一次修正、390像素触控、飞行中暂停／刷新、延迟进度提交和丢失结算回复恢复通过；正常准备和结算不误报待恢复。
- 两种画风的自定义三居民活动通过实际送礼、关键方案变更撤销同意、重新邀请不重复送礼、三人沿路到场、分开站位与同编号领取恢复。
- 两种画风的连连看和三消通过最终进度延迟、结算明确拒绝或回复丢失后的恢复，四个场景均只有一份成品与一次制作记录。
- 两种画风真正零币、零库存开局通过定向采石英、蜂蜡与纤维、星灯正式制作、锄地／播种／浇水、约181秒实际成熟等待、两笔订单、居民准备物资、亲自邀请、四幕夜集、纪念品及空浏览器恢复。未注入材料、金币、关卡品质或游戏时间；两次矿洞占用冲突按规则拒绝，没有重复采集或页面异常。

[公开验证摘要](night-sky-v141-verification.json)。命令：

    node --test tests/v141-night-sky.test.mjs tests/v53-party-hire-actions.test.mjs tests/v86-night-planning.test.mjs
    node tests/v141-night-sky-browser.mjs
    node tests/v86-night-planning-browser.mjs
    node tests/v110-classic-recovery-browser.mjs
    node tests/v100-zero-first-night-browser.mjs

小游戏的真人手感、美术和动画仍在继续打磨；本次夜集迭代不关闭原有完整产品验收项。

## English

The gathering remains inside the island activity modal. Four server-seeded flights vary star positions, wind and clouds. Aim with drag/sliders or arrow keys, launch with Space and use one A/D correction per lantern. A short guide leaves later gusts to observation. Misses can still finish the gathering; accurate flights illuminate the constellation.

Both themes use their own sky treatment, lantern art and actual participating residents with separate positions. Base hosting and reward rules remain 8 coins and 20–28 coins respectively. Continuous checkpoints keep normal flight active; pause/reload retains the seed, correction and original transaction. The server verifies inputs before one authoritative payout. Existing rhythm-game tickets retain version1; new sessions explicitly request version2.

Focused automated and native-browser evidence does not establish human, physical Mac, long-term or full-product acceptance.
