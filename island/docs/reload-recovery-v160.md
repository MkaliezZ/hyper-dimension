# V160 · 刷新后的进度恢复 / Reload recovery

## 修改

刷新前同一客户端连续写入两个版本时，旧浏览器暂存只有版本号，没有已确认的状态基线。独立的位置更新因此也被判为冲突，恢复保护会锁住地图操作。

暂存、有效时间请求与离页应急记录现在保留对应版本的已确认文档。刷新后只自动合并同一存档、具有正确基线的独立修改；同一项内容冲突仍保留记录并要求选择。有效时间请求明确收到版本拒绝时，核对服务端后合并独立修改，不重新补发被拒绝的时间。超时、未确认作业和旧记录继续走回执核对。

保存循环复用 Worker 返回的 JSON 文本，追加基线无需再次全量编码。农田原生检查等待启动恢复结束、按钮解除 inert 和农田作业解除锁定；两主题分别完成后汇总错误。

## 实际检查范围

- 10 项合并规则：独立字段、权威钱物、真实冲突、作物数组、跨岛、旧记录、错误版本、唯一结果。
- 8 项真实浏览器 + IndexedDB + 隔离 LAN 接口检查：像素/折纸各覆盖普通暂存和未接受的 7 秒时间请求，两次服务端更新、刷新、合并后保存及第二次刷新；同字段冲突保持核对、暂存和服务端状态。
- 两套画风各实际温室制作、农田播种/浇水/施肥、完整成熟、收获、刷新。成熟实测超过 186 秒，产出小麦 3 与种子 1，剩余养分 2。给予配方原料、种子、资金和温室开放，合法解辅助输入，自动模型关闭；不等于零起点或真人验收。

补充保存渲染检查：两主题约 1.97 MB 合成历史档，模拟 300 ms 请求延迟和手动动画路径，未降速的本机浏览器测得最长帧间隔 18.2 / 36.3 ms。该夹具检查渲染，不代替全岛经济时钟、弱设备或长期性能验收；旧性能脚本的两次不兼容失败保留在私有记录。

这些检查复现并修复一种确定的刷新冲突。V159 的 Intel 云端失败记录保留，是否解决该次平台失败以同源新版 CI 为准。完整目标仍为 18R/28F/30T，4 完成、14 进行中。

## English

A durable acknowledged baseline allows independent edits to merge after multiple server versions and a reload. Conflicting fields, legacy journals, mismatched islands, uncertain requests and unsettled actions retain explicit recovery. A definitely rejected clock request never grants its rejected time again.

Ten rules and eight native browser fault cases passed. Both styles also completed actual compost crafting, full-length crop growth, harvesting and reload with declared input fixtures. This does not establish physical Mac, human, zero-start or full product acceptance. The earlier Intel failure remains recorded; same-source platform CI is reported separately.
