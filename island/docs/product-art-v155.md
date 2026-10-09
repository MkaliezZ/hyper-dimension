# V155 · 配方产物裁切与结算重开

两套配方产物图集沿原图透明间隔校准 600 个取样区域。背包 SVG、场景 Canvas 与手持 Canvas 共用横纵边界，去除相邻物品碎片；原 PNG、取样大小、比例和物品身份保留。已有管家与基础材料裁切继续使用各自校准。专用工具与功能设施仍按原素材显示。

## 原生渲染检查

[脱敏记录](verification/v155/native-product-clips.json) 覆盖每套 300 个配方产物：600 个图标、1,800 个显示面。图标均非空，SVG 留白中没有漏图；六处已知相邻碎片探针在 SVG 和两种 Canvas 中回到背景色，RGB 容差维持 3。开发 Agent 查看了修复前后全部十张实际加载的图集展示，未修改原 PNG。

这证明本次边界修复及所列渲染检查，不代表所有物品造型语义、完整轮廓、工具动画或全部 300 个配方用途均已验收。部分原取样范围与物品造型仍需单独美术审查。此前“珍珠茶盏双把手”的描述有误，旧图为不同朝向的单把手；托碟与珍珠数量/位置的语义修正见 [V156](pearl-cup-v156.md)。

## 保存核对时的重开

结果进度等待服务端确认时，“再来一局”、难度与领取按钮同步显示等待状态；确认后恢复操作，避免按钮可点击但实际请求被忽略。第一帧结果弹窗也立即更新状态。

[原生检查](verification/v155/native-checkpoint-restart.json) 使用两套画风的独立物资夹具，在建筑弹窗内实际操作。真实保护存档的结算响应先由服务器生成，再延迟交付 2.2 秒；等待期间点击不替换本局编号，确认后实际点击生成新编号，旧局唯一取消回执无扣料和奖励。不是模型调用、零起点或真人难度验收。

## 版本范围

V153 的双画风 25 馆制作闭环、V154 的 100 个基础材料图标检查分别保留原版本。最近完成的真实一小时仍是 V152，不能改称 V155。宣传片仍录自 V145；小游戏仍为占位演示。完整 18R / 28F / 30T 范围与尚待完成事项不变。

## English

V155 calibrates product-atlas boundaries for both themes, sharing clipping across inventory SVG, scene and held-item Canvas. All 600 icons / 1,800 native surfaces and six known neighboring-art probes pass; original PNGs and proportions remain unchanged. This is a rendering fix, not acceptance of every silhouette, semantic design, animation or recipe use.

Result restart, difficulty and claim controls visibly wait for the real protected checkpoint acknowledgement, then recover. Native tests delay the delivery of actual server responses and verify a fresh ticket and a single cost-free cancellation. Fixtures grant resources and use solution-assisted inputs; no human quality acceptance is claimed. The latest completed real-hour run remains V152 and showcase footage remains V145.
