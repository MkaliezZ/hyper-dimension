# V220 · 可点击的进度核对 / Recovery through native dialogs

## 修复

小游戏暂停和结算使用浏览器原生模态弹窗。它会让弹窗之外的元素隐式失去输入能力；恢复按钮即使显示正常、CSS 层级更高，也可能无法收到点击。双画风隔离页面均复现了按钮可见、可用但被弹窗拦截的情况。

恢复面板现统一暂时收起这些原生模态弹窗，并观察恢复期间新打开的弹窗。最后一个恢复面板退出时，仅重新打开仍存在且内容未被替换的原弹窗。普通非模态弹窗保持原状；作业回执、暂存副本、资源校验和原有返回流程保持原规则。

## 验证范围

- 真实隔离 LAN `/play`、虚构账户和服务端进度冲突；通过原生鼠标点击核对并重新进入两套画风。
- 服务端存档身份、岛币、库存及回执数量保持；核对前的浏览器暂存副本保留。
- 恢复期间再次打开模态弹窗、多恢复面板交接、恢复原弹窗及丢弃已替换弹窗的浏览器行为检查。
- 测试中的模态弹窗是结构夹具，复现小游戏使用的浏览器输入机制，不代表完成了一局小游戏。

当前用户的 Codex 页面因浏览器权限设置未被读取；这项修复不能代替该页面刷新后的确认。若刷新后仍卡住，应按按钮是否变为“正在核对”、是否报错或是否已核对未返回继续定位。

## 同批美术检查修正

V219 Windows 美术检查在 `c24_2` 处失败：旧检查识别图集裁切与原有工具例外，没有识别新画笔的独立贴图。本批对所有声明独立文件的工具核对文件、裁切、声明尺寸与实际解码尺寸，并保留原有图集裁切、非空像素、邻图污染及 SVG 留白检查。诊断摘要和画笔截图进入失败产物；这不是降低断言或盲目重跑。

## English

Native workshop pause/result dialogs implicitly block input outside their top layer. A recovery button can therefore look enabled while receiving no pointer events. Recovery now suspends native modal dialogs and restores only unchanged, connected dialogs when the final recovery owner exits. Save reconciliation, receipts and backups retain their existing rules.

The regression uses fictional LAN accounts, actual canonical reconciliation and a structural native-dialog fixture in both themes. It checks retained resources/backups, usable controls and dialog lifecycle. The original user tab was inaccessible under its browser permission settings and remains unconfirmed after refresh. Automated checks are not human or physical multi-device acceptance.

The product-art gate also validates dedicated tool files, trims and decoded dimensions, including the new reusable brush, while retaining its foreground, clipping, neighboring-art and letterbox checks.
