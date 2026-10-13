# V176 · 连续操作与临海布局 / Continuous input and coastal layout

## 本次修复

- 船坞与烟花工坊交换完整地块。船坞位于东南码头旁，烟花工坊迁至内侧台地；两画风的门口、名称、点击范围和寻路坐标同步。已有居民和随行 NPC 的工作目标重新规划，保留当前位置、任务与进度。
- 服装店周期性不能选择的原因是每 5 秒的进度保存暂停了输入。所有房屋工作台与采矿、钓鱼、派对入口现允许正常保存期间继续操作。实际通信故障和最终结算仍会暂停，恢复前不继续产生未经确认的结果。
- 保存请求期间新增的操作单独保留；断线重试只确认原批次，不会误删之后的输入。领奖等待剩余输入确认；退出不会等待自身的请求。
- 硬暂停会释放按住的键与指针，恢复后不会继续蓄力、切菜或转舵。烟花真正故障时也禁止修改编排。
- 六竿钓鱼结束后停止记录无效计时帧，避免结果页持续生成输入而阻塞领奖。
- 陈列奇观等刚发生的编辑，以服务端最后确认的状态作为合并基准，避免被同时返回的居民作业旧状态覆盖。保存复用工作线程的已确认文本，不增加主线程整档解析；旧格式待确认作业仍可恢复。

## 验证方式与范围

服装店使用隔离的双画风岛屿，以实际鼠标操作比较修改前后。每种画风包含 20 秒正常保存、20 秒人为延迟 1.3 秒的保存，以及服务端已处理但浏览器未收到响应的恢复场景。修改前确实出现与保存重合的点击失效；修复后的正常与延迟阶段没有丢失选装点击。随后完成实际制作、核对材料、领取一次产物，并刷新核对没有重复发放。

公共控制器检查涵盖飞行请求尾部输入、丢回包重试、领奖等待、退出等待、其他作业待确认、刷新恢复及退出边界竞态。外场检查使用实际视图和控制器、规则回放及延迟传输；长按检查覆盖键盘、鼠标、绘画和厨房。原有实际服务端恢复回归保留。

陈列保存竞态使用真实存档服务、已获得的奇观及合法居民任务重现，分别检查工作线程与降级路径、丢回包后的重开、旧版待确认信封兼容。奖励与物资仍以服务端核算为准。

最终定向结果：服装双主题实际制作通过；厨房双主题鼠标、触屏、键盘及同请求恢复通过；烟花双主题三幕、丢回包、唯一奖励、陈列落盘与刷新通过。另有 7 条控制器恢复、18 条外场视图与 8 条长按检查。保存基线竞态 6 条回归已加入默认命令。首次烟花折纸末尾陈列失败的证据保留，由修复后的完整复测替代，不抹去原失败。

这些是特定交互与恢复路径的验证，不代表每个小游戏的所有关卡、全部难度或长期娱乐性已经完成验收。小游戏继续按演示玩法迭代；玩法难度和经济规则没有因本次输入修复而放宽。

## English

The boatyard and fireworks workshop exchange whole parcels. The boatyard now sits beside the southeastern harbor; fireworks production occupies the inner terrace. Both themes share updated entrances, labels, hit areas and navigation. Existing NPC work destinations are rerouted without teleporting people or discarding their work progress.

The wardrobe periodically rejected selections because routine five-second checkpoints paused its controls. Normal checkpoints now accept continued input across room games and field/party controllers. Actual transport failures and final settlement retain their pause and recovery protections. An immutable submitted prefix prevents retries from removing later inputs. Claims drain acknowledged events, and exit no longer waits on its own pending chain. Hard pauses neutralize held controls. Fishing results stop generating ineffective time events that could otherwise starve settlement.

The wardrobe comparison uses real mouse input in both themes: 20 seconds of normal transport, 20 seconds with 1.3-second checkpoint latency, then an acknowledged server action with a deliberately lost response. The fixed normal/delayed selection stages lose no clicks; actual completion, one output and reload checks pass. Separate controller and native-view checks cover recovery, held input and delayed field interaction. These are bounded engineering checks, not evidence that every level, difficulty or long-term play experience has been accepted.

A separate save race could revert a freshly chosen wonder display when a resident task replied. Operation replies now merge against the acknowledged server baseline, captured with its expected version, while preserving later local edits. The worker's existing encoded document is reused; the main thread does not parse another full save per checkpoint. Old pending-operation envelopes remain readable. Regression coverage uses the real save store, legally earned rewards and resident work, with both worker and fallback paths, lost replies and reloads.

Final targeted checks pass in both themes for wardrobe production; kitchen mouse, touch, keyboard and resume; and the complete fireworks flow through lost replies, unique rewards, durable display and reload. Separate suites pass 7 controller cases, 18 outdoor-view cases and 8 held-input cases. Six baseline-race regressions are included in the default command. The earlier origami display failure remains recorded alongside the successful post-fix rerun.

## Reproduction commands

```sh
node tests/v176-fashion-input-browser.mjs
node tests/v176-checkpoint-controller-browser.mjs
node tests/v176-workshop-transport-browser.mjs
node --test tests/v176-boatyard-relocation.test.mjs
```

These browser checks use isolated fictional saves and block model calls. They do not reset the installed player's island.
