# V186 · Natural season boundaries / 自然换季边界

The local environment client now observes a season boundary during rendered samples, including a long hidden-window gap. Previously only an accepted server clock could start a transition; a normal thirtieth-day boundary changes neither clock ID nor revision, so the previous season was lost.

The transition starts once from the last observed season. Repeated frames and an unchanged clock refresh do not restart it. New central-clock revisions retain their existing transition behavior. The configured cycle remains thirty visual days per season and nine hundred seconds per visual day.

Eighteen focused clock/client/service assertions pass. This includes four new cases for a natural boundary, repeated frames plus refresh, hidden-window recovery, and a central revision followed by another natural boundary. Tests use isolated data; no actual user save or paid model was used.

V185's [cloud run](https://github.com/MkaliezZ/hyper-dimension/actions/runs/38551474760), commit 18ddeb7c4503378c2ea1fa0cae7c8598a77c3173, completed with nine successful Windows/macOS deployment, native-art and native-gameplay jobs.

## Artwork scope / 美术范围

This change fixes season observation, not the missing whole-island artwork. Native regional winter/spring/autumn variants are being painted from the calibrated original terrain. The current public release does not install those unfinished assets or enable a global seasonal tint. Full regional coverage, repair patches, seam review, runtime loading and actual seasonal visual acceptance remain pending.

本次修复自然跨过第30视觉日、切回隐藏窗口及中央时钟修订时的季节过渡记录。18项相关断言通过；上一版V185云端9项检查全部成功。春秋冬原生分块素材仍在制作和检查，未完成整岛换季验收，未将局部素材或滤镜当作四季完成。

