# V177 · 联机旧存档目录升级 / LAN catalog upgrade

## 中文

V176 的服装店连续输入修复和新作物已合并。实际更新旧联机存档时，发现另一条升级路径遗漏：单机入口会更新物品目录，联机入口直接打开旧档，随后浏览器补入新目录字段，触发服务端的物资一致性保护。表现为刚进入游戏就出现存档冲突，读取服务端进度后仍反复出现。

V177 将同一目录升级步骤放到存档层供两个受保护的入口共用。升级前保留备份，只补缺失物品的零库存字段，并同步已确认的校验快照；已有数量、活动票据和结算记录保留。恢复按钮和服务端校验仍然有效。

验证：相关回归 32 项通过，其中包含像素、折纸两条真实 LAN HTTP 的升级、保存、操作、重复回执和重开流程。隔离的旧档副本从 350 个库存字段扩至 366 个，仅新增零值；既有作业、游客行程和资源记录保留。公开测试使用虚构存档，私人存档和日志不进入仓库。

本版本接续 [V176 小游戏及布局修复](minigame-input-v176.md) 与 [时令作物和配方](seasonal-content-v176.md)。历史失败保留在验证记录中，V176 的旧联机存档更新不能视为通过，使用 V177 或之后版本。

## English

V176 includes continuous wardrobe input and seasonal crops. Updating an existing LAN island exposed a separate migration gap: the standalone entry upgraded its item catalog, while the LAN entry opened the old document directly. The browser then added new catalog fields, correctly triggering the server's inventory consistency guard. Reading the server save repeated the same conflict.

V177 shares the catalog upgrade in the save layer across both protected entry paths. It backs up the old document, adds only missing zero-stock fields and refreshes the acknowledged consistency snapshots. Existing quantities, activity tickets and settlement records are preserved. Recovery controls and server validation remain enabled.

Validation: 32 related checks passed, including real LAN HTTP upgrade, save, action, receipt replay and reopen flows in both themes. An isolated legacy-save copy grew from 350 inventory fields to 366 by adding zero values only, preserving existing work, visitor journeys and resource records. Public tests use fictional data; private saves and logs are excluded.

This patch follows the [V176 minigame and layout changes](minigame-input-v176.md) and [seasonal content](seasonal-content-v176.md). The failed upgrade is retained in the validation history; existing LAN islands should use V177 or newer.
