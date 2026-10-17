# 居民规划的 JSON 输出示例

## 实际发现

V262 冻结候选的双画风自然一小时已完整运行，性能、末段帧采样与空浏览器恢复通过。折纸岛期间一次居民规划返回 `503 model_response_format`，因此整轮功能接口检查未通过，原报告保持失败。

这次实际 Flash 响应的 HTTP 状态为 200、结束原因为 `stop`，但十五条决策中有十四条在对象最后一个字段后带多余逗号。原始响应及摘要校验保留在私有验证目录，未公开游戏记忆或提示词内容。

## 调整

居民规划提示词原来用 JavaScript 简写展示结构，例如未加引号的字段名。现在改成完整、合法的 JSON 示例，明确要求双引号、禁止末尾逗号，且示例值不能替代当前居民编号和该居民的可选目的。这与 [DeepSeek JSON 输出说明](https://api-docs.deepseek.com/zh-cn/guides/json_mode/) 中提供合法格式示例的要求一致。

严格解析器保留原样。截断、重复字段、非有限数值、混入说明文字或非法 JSON 仍被拒绝；不修补模型行为，不额外发起格式纠正请求。DeepSeek Flash、300/600/950 秒频率、一次规划调用与实际用量记账保持原样。

## 验证范围

- 通过真实 Node → Python → 本地供应商协议捕获实际发出的提示词：修正前格式检查失败，修正后通过。合法回复仍须从指定居民自己的目的中选取。
- 同协议下，模拟原故障的完整但含末尾逗号回复仍失败，实际一次调用的用量仍完整记账。V116 原有严格拒绝检查未改。
- 将本次实际失败的原始回复交给当前解析器，仍按 `model_response_format` 拒绝；没有增加模型调用。
- 修正后的工作源码实际调用一次 Flash，十五位居民全部返回合法且属于各自可选项的目的，用量与原始供应商响应对应。

最后一项使用既有虚构小时存档的内存副本，并关闭视觉作息样本来单独核对输出格式；未执行资源动作、未改原档，也不等同于新版本的自然一小时或真人游玩。全部必需规则通过，详见[摘要](verification/v265/resident-json-prompt.json)。后续冻结源码的长时检查、最终包、新视频和实际参与者验收继续分别执行。

## English summary

A real frozen-hour NPC response contained trailing commas and correctly failed strict parsing. The resident planning prompt now supplies valid JSON rather than JavaScript shorthand. Parsing safeguards, model, cadence, one-call budget and usage accounting remain unchanged. Controlled dispatch checks reproduce the old failure and verify the new prompt; the original malformed response remains rejected. One real Flash call returned valid allowed purposes for all fifteen fictional residents. This is output-format evidence, not a replacement for a subsequent natural-hour or human acceptance run.
