# 原生物品图检查的像素计算

本次调整素材验证的计算方法与失败诊断。游戏规则、模型、人物动画和现有素材未改。

## 失败记录与定位

V263 的 macOS Intel `Native recipe product art` 已渲染完双画风 616 张物品图，在 Python 像素核对阶段失败。对应产物已下载并通过 ZIP CRC 与 SHA-256 核对。`probe-input.json` 与失败报告的归档时间相隔 180 秒，与原有 `180000ms` 子进程截止时间一致；旧报告未记录退出信号，不能由此确定操作系统终止原因。

原实现对每张 200 × 200 截图用 Python 遍历全部像素，616 张共有 24,640,000 次循环。现在由 Pillow 的差值、通道最大值、直方图和矩形裁切执行相同计算，仍覆盖每个像素。

## 保留的要求

- 仍检查每种画风的 300 种原有制品与 8 种季节食品，以及 SVG、场景与手持渲染。
- 前景像素仍须大于 500，前景判定仍是通道差值大于 8。
- 留白边缘和六个已知串图探针的最大差值仍不得超过 3；小数边距的取整与排除范围保持原样。
- 原 `180000ms` 上限保持。失败时额外保存退出码、信号、标准错误、准确的物品编号与对应截图。

72 组随机图片及整数、小数、越界边距逐像素对照原实现一致；前景、边缘和探针的边界反例仍须被拒绝。旧 CI 实际留存的两张截图也与原算法一致。本机双画风 616 张原生渲染及全部必需规则已通过。新 macOS 托管结果须等对应运行确认，不能以本机结果代替。

证据范围见[验证摘要](verification/v264/native-product-pixels.json)。真实 OPC 学员、5–8 位新玩家、新视频和最终整体验收仍按各自要求执行。

## English summary

The native artwork checker now uses Pillow operations equivalent to its previous per-pixel loops. All pixels, 616 dual-style product renders, foreground and neighboring-art thresholds, fractional margin rules and the 180-second child deadline remain unchanged. New boundary comparisons and retained CI screenshots match the original algorithm. Failures retain their exact product image and process diagnostics. Local verification does not establish hosted macOS recovery or human acceptance.
