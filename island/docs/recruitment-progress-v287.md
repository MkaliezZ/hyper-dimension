# Recruitment progress / 招聘处理进度

The recruitment panel distinguishes preparation, durable-save/checkpoint waiting and a transmitted invitation. Retry is disabled while the current attempt is processing, then re-enabled with its original request identity after a definite failure. Errors render before a subsequent status refresh finishes.

An acknowledged `hire_prepare` already captured the input and reserved the salary. Its following serialized checkpoint remains mandatory and drains later accepted jobs, but no longer marks an identical state dirty just to save it again. Cancellation and the other editing operations retain their ordinary persistence paths. Server authorization, the one-seat policy, salary, world identity and result-replay rules are unchanged.

## Evidence and limits

- Both styles reproduced the prior enabled retry button that silently ignored input while an actual accepted response was withheld.
- Both styles now show the correct preparing/transmitted/error phases; the real external request waits for the original accepted receipt. One eight-coin hold remains and cancellation releases it once.
- Four original409/503recovery cases and four bounded low-frame-rate cases passed, retaining their original limits, request identities and inventory assertions. Twenty-seven related authority/recovery checks passed.
- In the declared low-frame-rate Windows comparison, the redundant post-preparation checkpoint had a median772.55ms across eight observations before the change and0ms after it. This measures only that redundant-save path, not total invitation latency or a Mac performance guarantee.

这次修改改善处理反馈并去除重复保存，未将托管 Intel Mac 的八秒请求准备失败宣称为已修复。该失败在单纯低帧率对照中未复现，仍需继续核对托管结果。ARM Mac 图形阻塞、实体设备和真人验收仍分别待验证。自动化使用虚构岛主、预置100岛币和明确的拒绝回复夹具，不计作实际招聘或新玩家验收。
