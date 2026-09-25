# 可交付记录契约

所有输出使用 UTF-8，版本号与引用 ID 不可省略。示例是字段形状，不表示已有标准化效度。

## 教材证据卡 book_evidence

- book_id、relative_pdf_path、publisher、series、editor、school_system、grade、volume、edition_or_revision、source_rights_note
- content_status：metadata_only / toc_reviewed / pages_reviewed / full_reviewed
- unit_label、unit_title、pdf_page_refs、printed_page_refs、observed_topics、observed_language_actions、reviewer、reviewed_at
- 页码是证据定位；在公开仓库只发布必要元数据，不导出受版权保护的页面、长段原文和图片。

## 测评蓝图 blueprint

- blueprint_id、version、purpose（placement/formative/weekly/term）、age_range、school_grade、book_ids、school_progress、target_cefr_descriptor_refs、capability_ids
- 题目数量与时长、四技能覆盖、教材熟悉情境与迁移情境的比例、难度梯度、允许支持、缺口、教师审批状态
- 若某技能未实际施测，coverage 明示 missing，不能默认为零分。

## 题目 item

- item_id、version、origin=original、task_family、modality、target_behaviour、capability_ids、cefr_descriptor_refs、book_evidence_refs
- knowledge_tags（交际功能/词汇/语法/语音拼读/篇章/策略，含教材页证据与英文级别参考来源）、prompt、stimulus_ref、options（如适用）、answer_key 或 analytic_rubric、evidence_for_answer、distractor_rationales、explanation、expected_minutes、support_allowed、review_status
- 听力还需 audio_ref、transcript_ref、speaker/accent 与播放条件；写作还需分析性量规；口语暂定，未来若启用则需互动角色、追问规则与观察量规；Agent 访谈另需 interviewer_version、interview_script、allowed_probes、hint_policy、stop_rule。图片需原创或授权记录。
- 参考题型时另存 public_format_source_url，不保存样题内容。每题必须说明“这题测什么”，并检查答案唯一性。

## 作答 response 与报告 report

- response：attempt_id、student_ref、item_id/version、interviewer_version、start/end、turn_events（角色、话语文本/音频引用、时间、提示、ASR置信、设备质量）、raw_answer_ref、hints、media_quality、scorer_draft、evidence_span_refs、teacher_decision、decision_reason、audit_refs
- report：report_id/version、student_ref、period、textbook_progress、coverage、capability_results、cefr_reference_only、evidence_refs、error_patterns_with_uncertainty、strengths、priority_goals、four_week_plan、retest_conditions、teacher_approval、visibility_scope、audit_refs
- 逐题解析和错题累计必须保留 item_id/version、原答、正确证据、错因候选、讲解和下一次迁移任务；不能只存一个“错题”标签。
- 报告状态 draft / pending_review / approved / retracted。学生或家长可见版本只由教师审批后生成。未来 Agent 间只交换授权的对象引用及状态，不直接夹带原始录音和教材页。
