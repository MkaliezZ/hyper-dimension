# V110 · 经典小游戏结算恢复 / Classic game settlement recovery

## 修复

花坊、图书馆、集市、邮局使用的三消与连连看，现在等待结算控制器确认成功后才销毁棋盘。返回 false 或请求异常时保留成绩和领取按钮；正在提交时禁止重复领取、换关和切换难度。保存暂停与结果演出完成状态共同决定按钮是否可用，关闭房间后的迟到回应不会修改下一页。

## 验证范围

- 八组真实浏览器结果页夹具：四个建筑 × 两套画风，覆盖暂拒、同步异常、延迟回应、连续点击、提交中换关、保存暂停恢复、成功销毁与关闭后迟到回应。这些夹具不是实际通关证据。
- 四场房屋弹窗内实际通关：两套画风分别完成连连看与三消；通过正常格子点击、真实时间与服务器随机关卡完成，没有注入棋盘、种子、计时或结果。
- 验证延迟最后一批操作保存时领取按钮保持禁用；完成请求在提交前被拒绝，以及已提交但回应丢失后，均可通过恢复按钮或刷新继续。
- 磁盘记录确认每场只有一条成功回执、一份成品、一次制作履历，材料按配方扣取且预留释放。390px 恢复提示无横向溢出，页面异常为零。
- 21项相关玩法/制作规则测试通过。实际浏览器场景使用隔离库存夹具并屏蔽模型接口，不代表零资源完整成长、真人体验或全部小游戏品质已完成。

## Reproduction and checks

The link and match renderers retain their completed board until the controller acknowledges settlement. A refused or rejected attempt remains retryable. In-flight claims block duplicate submissions and game restarts. Transport pause, presentation readiness and disposal share the same button state. Late callbacks from a closed room are ignored.

Run from the island source directory, after installing dependencies and Chrome, Edge or Chromium:

    npm run test:classic-settlement

Set HD_QA_BROWSER to an absolute browser executable path if auto-detection cannot find it. The first script uses result fixtures for all four classic buildings in both styles. The second completes real link/match boards using native UI controls and authoritative save endpoints, then injects rejected or lost settlement responses. Its isolated inventory is stocked for test setup; it does not inject a completed board or game clock. Random match boards may require a genuine retry, which is recorded.

Tests write only to isolated qa directories. Keep these reports, saves and runtime files out of the public package. Automated results do not establish physical Mac or full human product acceptance. Minigames remain placeholder demonstrations under continued development.
