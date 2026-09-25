# 听力音频制作（后续阶段）

当前首期优先阅读与写作。需要听力时，可让具备语音输出能力的模型或专门的文本转语音模型把原创脚本合成音频。普通仅输出文本的语言模型本身不产生可播放的声音。

官方能力参考：
- OpenAI 文本转语音：https://developers.openai.com/api/docs/guides/text-to-speech
- Google Gemini 文本转语音及双人配音：https://ai.google.dev/gemini-api/docs/speech-generation
- Cambridge A2 Key for Schools 听力题型与样题入口：https://www.cambridgeenglish.org/exams-and-tests/qualifications/key/preparation/
- Cambridge B1 Preliminary for Schools 听力题型与样题入口：https://www.cambridgeenglish.org/exams-and-tests/qualifications/preliminary/preparation/

制作流程：依据教材页证据与目标 can-do 写原创对话/独白 → 写答案和干扰项理由 → 选择语音模型、声音、语速与口音 → 一次生成固定文件 → 人工听审每个姓名、数字、重音、停顿和答案线索 → 保存脚本版本、音频哈希、时长、声音配置、审听记录、播放次数和权限 → 先做小样本试测。多人对话可分轨生成并混音，避免角色串音。发现发音、语速或信噪比问题时重新出一个版本，已答题记录仍引用旧版本。

正式诊断为同一题目使用同一经审听的音频，不按学生实时重生成，以维持可比较性并降低 API 成本。练习模式可以允许变体，但与诊断证据分开。网页不能在听力题前显示文字脚本；设备无声或播放失败时标记 invalid_attempt，不记学生错误。音频应明示为 AI 合成，并按使用平台条款和当地适用要求处理。合成音频可用于本项目教学诊断，不声称与剑桥官方录音或真实考试难度等值。
