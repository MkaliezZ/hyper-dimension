# V139 · 风物绘卷 / Island drawing commissions

工艺学院的「风物绘卷」已从三道固定曲线升级为随机画作委托。小游戏继续在房屋的工作台弹窗内进行。

The art academy's drawing game now generates illustrated commissions instead of three nearly identical curves. Gameplay remains inside the building workbench modal.

## 运笔与成画 / Drawing and review

- 四种原创风物：潮汐归帆、风铃花枝、珍珠拾光、星灯晚风；种子决定图案与细微构图变化。
- 按住鼠标或触控笔沿轮廓连续绘制，松开后可从当前光点续画。原地按住、跳过轮廓和零时间输入不能完成画作。
- 三种配色对应三只颜料碟；用墨会减少，蘸墨有真实时间与润笔动作，底色需晾干后再叠画。
- 走偏与错色影响笔触评审；可重绘当前笔触。完成后经过装裱动画，再根据全部笔触的平均质量确认达标。
- 像素版使用清晰方边、折纸版使用纸纹和折角；活动笔尖精确对应指针，绘出的路径来自实际输入。窄屏扩大画板，配色和蘸墨仍在外侧操作区。

Four original motifs use reproducible seeded layouts. Continuous mouse/touch strokes, palette choice, ink depletion, timed dipping and layer drying form the commission. Incorrect color, skipped paths and off-guide movement affect review; the current stroke can be redrawn. A final framing sequence precedes the authoritative result. Both art styles use the actual input path and accurately positioned brush tip, with a larger responsive drawing surface.

| 难度 / Difficulty | 笔触 / Strokes | 轮廓容差 / Radius | 达标评分 / Minimum quality |
| --- | ---: | ---: | ---: |
| 轻松 / Relaxed | 5 | 19 | 65 |
| 标准 / Standard | 7 | 15 | 73 |
| 挑战 / Challenge | 9 | 12 | 80 |

## 存档与制作 / Persistence and production

规则状态使用版本 `139`，由浏览器和服务端输入回放共用。已保存的旧版三笔会话继续按原规则完成；恢复界面使用服务端保留的关卡，不重新生成另一套图案。材料预留、取消返还、配方成本与单次领取仍由既有服务端作业核算。

The versioned data-only state is shared by client and server replay. Existing three-stroke sessions retain their rules, and recovery uses the stored level. Reservation, cancellation, exact recipe costs and one-time reward claims remain server-owned.

## 本轮证据 / Evidence

- 92 项相关玩法、恢复与制作检查通过；随后 18 项绘画与全局声音检查通过，二者有重复，不相加成独立总数。
- 双画风原生浏览器通过真实房屋入口、鼠标运笔、服务端回放、一次材料扣除、一次产出、刷新保留与 390px 结算关闭按钮检查。两局有效时间约 46 秒与 39 秒。
- 新原生检查使用提前解锁、已有原料的隔离测试岛，初始无制作品；未调用模型，未修改用户存档。它不代表零开局全流程、真人难度评估或所有小游戏达到独立发布品质。

Focused mechanics/recovery/production checks pass 92/92; drawing/audio checks subsequently pass 18/18, with overlapping cases. Native pixel and origami sessions complete through mouse input in roughly 46 and 39 active seconds, accept one server-checked production receipt, retain it after reload and show usable compact result controls. Fixtures are isolated, pre-unlocked and supplied with raw materials before startup, with zero manufactured products. No model calls or user-save changes. Human feel and the remaining minigame collection still require review.
