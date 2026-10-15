# V188 · Mac check timing and teardown / Mac检查时序与退出

V187 run [38712618043](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38712618043) reported two Intel Mac failures. These changes address the test harness findings; new cloud results must be checked on their own commit.

## Navigation interval

The old farm-navigation assertion started timing before Playwright waited for and clicked the button, but used the remaining route measured after the click. On the slow runner it compared 15.001 seconds with a 4.824-second remaining route plus the existing ten-second allowance. The fixture now records click/read overhead separately, then measures the interval corresponding to the remaining route. The route speed and original ten-second allowance remain unchanged. Frame diagnostics now use the actual navigation cap of 0.75 seconds rather than the 0.15-second economic clock cap.

Four local cases at 8/15 FPS in both styles reached the farm in 5.42–5.55 seconds after the matching route snapshot, versus 5.28–5.52 seconds of expected travel. Total click-to-arrival time is also retained in the report.

## Reward-route cleanup

The failed native gameplay job exited with an uncaught `route.fetch` ECONNRESET during a save action and did not write its full case report. The API interceptor now catches its asynchronous handler failures: failures during a live case are recorded as case errors; teardown-only rejections after the case enters cleanup are settled without crashing the Node process. This preserves the original failure and allows all six scenarios to finish independently. Fixture environment-clock storage is now isolated alongside its saves and run ledger.

All six local claim, cancel and explicit disconnected-response recovery cases pass in both styles. Exact inventory, cost, gain and single-receipt assertions are retained. A more informative harness does not establish that every original Mac timing issue is resolved; the next cloud run is required.

## 中文

导航计时修正为与“剩余路径快照”匹配的时间段，另外记录点击等待和总耗时；保留原速度及十秒余量。慢帧诊断按真实移动上限0.75秒计算，不再混用经济时钟0.15秒。双画风8/15 FPS四组本地检查通过。

领奖测试捕获异步请求拦截器错误：正常执行期间计入失败，退出清理期间正确收尾，保留原始错误及完整报告。6组领奖、取消、断线显式核对均在本地通过，库存、成本及单次回执的严格断言保留。V188云端结果待本提交复核。

新宣传片正在从V187当前游戏重新录制：所有画面重新采集，原视频画面不复用；两画风、四季、居民、管家工作与房屋内小游戏均使用当前运行代码。成片验证完成前仍保留已标注版本的旧视频。


## Cloud follow-up / 云端复核

On 2026-10-15, commit `3ecfc140e0794d849f4e8cc367620a6aaf8606db` passed all nine Windows, Apple Silicon Mac and Intel Mac deployment/art/gameplay jobs in [run 38719165846](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38719165846). Both previously failing Intel Mac jobs succeeded. This is hosted CI evidence, not a physical-device or human gameplay acceptance.

2026-10-15，本修复提交的三平台部署、美术、玩法9项云端检查全部成功；此前失败的Intel Mac部署和玩法项均通过。记录保留于专题文档，README仅展示功能与使用入口。
