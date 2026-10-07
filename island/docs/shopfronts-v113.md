# V113 · 商铺货架与制作留用 / Shopfronts and crafting stock

## 玩法 / Gameplay

进入「经营 → 商铺货架」，或建筑详情中的「商品陈列」。25 座建筑各有 12 件对应制品；物品用途页也可直接打开本馆货架。使用现有两套物品美术，显示售价、扣除运营费后的收入、背包数量、任务预留和可售数量。

- 勾选可售商品，并设置需要留下的数量。游客仅购买实际可用库存中超过留用量的部分；留用本身不会占用任务预留，可用于后续制作、赠礼、分工或派对。
- 同馆未勾选的高价成品不会替代上架商品。游客仍按喜好、预算和既有价格选择；商品成交收取原有 30% 运营费，不增加额外货币。
- 全部下架可暂停商品销售。观星、阅读等原有体验服务仍按原规则开放；缺少可售商品和体验的场所不会吸引新的游客行程。
- 正在服务的游客保留已经确认的商品、价格和预留；改架影响之后的选择。每笔成交只扣一次库存。
- 旧档默认沿用原有自动陈列，不改库存、收入或筹备任务。可恢复自动陈列，配置保存在本机服务；跨窗口修改和过期页面须读取当前状态。

Open **Business → Shopfronts**, a venue's **Product display**, or an item's purpose page. All 25 venues and 300 crafted products are covered. Select sale items and a minimum quantity to keep for later crafting. Available sale stock excludes task/visitor holds and the keep quantity; the keep quantity remains usable by crafting, gifts and parties.

Visitors still use their tastes, budgets, real inventory and existing prices/fees. Unlisted premium goods cannot replace your selection. Pausing products leaves existing paid experiences available. Already confirmed sales finish under their original quote; later choices use the new shelf. Old saves retain automatic sales until configured, with no inventory or money migration. Settings persist in the local service and stale concurrent edits are rejected.

## 验证边界 / Verification scope

All 704 default local checks passed, including 11 new rule checks. Both final native browser cases passed with no page errors, one tea surplus sold, two retained, the unlisted stove retained, settings preserved after reload, and no horizontal overflow at 390px. The first browser attempt used an incorrect close-button selector; its failure was kept and the corrected workflow was rerun.

Targeted rules cover every product, cross-venue validation, production stock floors, task and buyer reservations, immutable accepted quotes, replay, disk reload, legacy snapshots and client tampering. Browser checks use isolated initial stock (tea ×3, tea stove ×1, boards ×5) and a tea venue quality of 55; settings, reload and actual visitor travel/service use native controls and normal time with model endpoints blocked. This is not evidence of a complete zero-start active economic journey or human acceptance.

The game still has demonstration minigames under development. Broader industrial facility differentiation, active long-term balance, full real-agent orchestration and physical-device/human acceptance remain open.

![Pixel shopfront](media/shopfront-pixel-v113.png)

![Origami shopfront](media/shopfront-origami-v113.png)
