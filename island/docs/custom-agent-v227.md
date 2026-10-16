# 共创作品与居民协作 / Custom products and resident work

已审核并在当前小岛启用的共创物品，可以作为筹备清单目标，也可以由管家安排给居民。筹备手账显示本岛物品名称、像素／折纸图标、实际完成数量和等待原因。

## 制作与分工

- 前置制作与原料依赖均展开为实际工序。前置物品即使不被最终配方消耗，也必须真正制作过；检查阶段不会发物品或增加熟练度。
- 同一前置既用于解锁又作为材料时，合并需求，避免重复生产。有效的十二道共创工序可以逐项推进。
- 已接单作业保存当时的配方与材料账单。改版、回退或停用后，已接受的作业仍按原账单交付；新作业需要当前有效图纸。
- 停用作品不会删除库存、物品资料、任务回执或已备物资。尚未完成的分工显示等待，重新启用后继续；缺失配方不表示任务已经完成。
- 长编号保留完整物品身份，并使用持久的步骤编号，刷新后对应关系不变。

## 自主生活与管家

居民可在本职业关联的工坊准备少量共创样品。通常每种成品保留一份，食物和组件保留两份；计入已预留库存和在制作业，每位居民每天最多两次自主共创工序。岛主明确登记的目标优先，其他居民不会再为同一任务目标额外打样。手动分工继续按清单数量执行。

管家的观察资料由本人小岛的服务端发布记录补齐，客户端不能指定别人的目录。共创物品的名字、说明与图纸均为游戏数据，不授予本机文件权限。现实工作仍根据岛主明确的委托处理。自动调用继续使用 DeepSeek Flash，规划／交谈／管家巡查间隔仍为 300／600／950 秒。

## 存档修复

发布目录与空库存条目一起写入权威账本，避免前端补充零库存后触发个人物资冲突。读取旧目录时也会补齐缺失的零库存条目；现有物资、币和已接单账单保持实际数值。

## Evidence and boundaries

Rule and browser evidence is recorded in [the verification record](verification/v227/custom-agent.json). Native scenarios use fictional islands, declared fixture materials and normal work clocks; their PNGs are test patterns. Model stubs are labeled separately from actual Hermes / Flash runs. These checks do not establish human, physical Mac or full multi-device acceptance.

This update connects approved custom content to canonical planning, bounded resident purposes and model observations. Visitor custom shelves and the broader remaining product, course and multiplayer acceptance work remain tracked separately.
