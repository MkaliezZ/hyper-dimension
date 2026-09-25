# 英语能力主线与多教材适配 v0.1

状态：设计草案。范围：6—15 岁，教师版先行。当前等级和题目未经实证标定。

## 双轨模型

能力主线跨教材稳定，记录学生能否在真实情境中独立完成交流；教材进度记录出版社、系列、修订年、年级、册次、单元和学校进度。单元映射能力节点，但教材、年龄和学校成绩不能直接代替能力证据。换教材只换映射，不改学生既有证据。

“教师缺少完整教学体系”作为产品服务假设，不作为对教师群体的事实判断。每个单元包交付可直接执行的目标、逐课流程、开场话术、分层活动、观察点、错因标签、补救任务、评分量规和报告提示。教师保有内容与报告审批权。

## 稳定能力节点

- C01 识别与介绍：让对方知道人、物、地点和身份。
- C02 获取与确认：提问、回应、追问、复述关键条件。
- C03 描述与比较：提供特征、偏好、相同与不同。
- C04 请求与协作：邀请、计划、协调与回应。
- C05 叙述与排序：组织经历、步骤和故事。
- C06 解释与论证：表达观点、理由与例子。
- C07 解决问题：发现约束、比较方案、协商选择。
- C08 转述与整合：从听读材料提取信息，面向新受众表达。

每节点分别记录听、读、口语独白、口语互动、书写证据；词汇、语法、语音/拼读是支撑指标。沿用内部 L0—L3：L0 大量提示、L1 有支持完成、L2 熟悉情境独立完成、L3 新情境迁移。它们不是 CEFR 或国内年级的等值换算。

| 年龄 | 适龄输出 | 核心证据 |
| --- | --- | --- |
| 6—8 | 实物或图片辅助下介绍、请求、两轮问答 | 能否发起、回应切题、让对方理解 |
| 9—12 | 描述、邀请、步骤说明、短讯和信息差对话 | 信息完整、追问与修正、独立完成 |
| 13—15 | 解释选择、讨论方案、访谈、邮件和简短报告 | 理由、回应他人、受众适配与迁移 |

6—7 岁若当地尚未开设英语教材，使用适龄口语和图像任务起步，不虚构教材单元。

## 从教材到原创任务

每单元按以下顺序生产：核对教材元数据与来源 → 选能力节点 → 写原创大问题 → 定义独立终结任务及成功证据 → 逆向设计情境导入、听读获取、语言发现、有支持的输出、独立输出、新情境迁移 → 提供 L0—L3 分层脚手架 → 收集证据并让教师复核。日常 3—5 分钟形成性练习、周综合任务、月证据报告和学期目标调整均按学校规则和低龄负担调整。

方法借鉴：Power Up 的目标—任务—证据—反馈及阶段任务；Oxford Discover 的大问题与探究；Look 的真实世界观察；Think 的青少年议题、观点和反思。用户提到的 Thinking 暂按 Cambridge Think 第二版理解，若实际指另一套教材，替换该方法来源即可。只借教学组织方式，题目、对话、图片与音频自行创作或取得授权，不复制这四套教材正文和媒体。

## 多版本适配

- 人教 PEP 新版三年级上册：已核对本地原书：Unit 1 Making friends、Unit 2 Different families。原先将 Unit 2 标为 School things 的样板坐标错误，现以 Unit 1 做原创样板。
- 人教新版七年级上册：出版社公开资源列有 Unit 1 You and Me。先以此做初中样板。旧 2011 版目录不能混用。
- 教育科学出版社 2024 教科版：出版社证实采用任务导向、教—学—评一体化。具体单元题名在出版社公开页面尚未核实，映射状态为 pending_source；通用能力主线照常使用。

新增版本须登记出版社、系列、ISBN 或修订年、册次和官方来源。内容编辑提出候选映射，第二人核实后批准。书名相同或话题相近不构成等值证据。每条映射保存 source_url、verification_status、reviewed_at 和 mapper_version。

## 教材检索与版本核验

用户提供的电子课本网教科版英语目录（http://www.dzkbw.com/books/jkb/yingyu/）登记为**候选检索入口**，用于发现册次与目录。2026-09-25 复查：HTTPS 地址经访问工具返回 502，原始 HTTP 地址返回 200，已读到目录。该页将小学“广州版”和初中“五四制”分列；例如广州版三年级上册（2024 秋版）的目录页为 http://www.dzkbw.com/books/jkb/yingyu/3s_2024/，五四制六年级上册（2024 秋版）的目录页为 http://www.dzkbw.com/books/jkb/yingyu/ws6s_2024/。这些为第三方页面观察结果，具体单元映射仍须出版社或教师复核；不把站点的“最新”标签自动认定为版本事实，也不把第三方页面单独标为 publisher_verified。

教科版名下须分清具体系列/地域分支，不能只保存“教科版”三个字。适配记录至少包含出版社、编写单位或主编、系列名称、修订/启用年份、年级、册次、封面或版权页识别信息、单元题名、学校实际使用版本及来源链接。可用教育部教学用书目录确认教材系列是否列入，再用出版社公开目录或教师所持实物核对具体单元；若仍无法核实，保持 pending_source。第三方站点的课本图片、PDF、课文和音频不复制进公开仓库，原创教学任务只引用必要的教材元数据。

## 文件与 Protocol

单元包采用 curriculum-unit.schema.json，示例见 examples/curriculum。原始答卷、口语录音、评分修订和报告分别存储，单元包只引用能力节点和量规版本。教师报告须引用 unit_package_id、capability_id、item_version、evidence_ref、rubric_version 和 teacher_approval_ref。未来学生 Agent 使用现有 hd.education.evidence.submit.v1 提交受控证据引用；A2A 只负责传输和任务状态，教材映射、评分、授权归业务服务管理。

教师 Agent 起草题目、草评与计划。题目发布、口语关键评分和学生/家长可见报告须经教师审批。一次测试只能给证据支持的临时起点，证据不足则补测。版权与来源不明的课本扫描页、音视频不进入公库。

## 可核查的公开依据（检索于 2026-09-25）

- 教育部 2022 版课标通知：https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html
- 2022 英语课标公开 PDF：https://www.esph.com.cn/docs/2025-10/705da262a6e74b088ac658bfe2d757ba.pdf
- 人教小学新版介绍：https://www.pep.com.cn/xw/zt/hd/12/xjcjs/xx/202409/t20240920_1995564.html
- 人教三年级上册公开资源：https://www.pep.com.cn/zslth/yyptzy/xyjt/3s/
- 人教七年级上册公开资源：https://www.pep.com.cn/zslth/yyptzy/czyy/7s/
- 教科版 2024 介绍：https://www.esph.com.cn/zttj/4e753e04a6ba475396c138ff61e3ec9e.htm
- 教育部 2024 教学用书目录：https://www.moe.gov.cn/srcsite/A26/s8001/202408/W020250418502592948423.pdf
- 用户提供的第三方教材检索入口（待核验）：http://www.dzkbw.com/books/jkb/yingyu/
- 欧洲委员会 CEFR 描述符：https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors
- 欧洲委员会青少年描述符库：https://www.coe.int/en/web/common-european-framework-reference-languages/bank-of-supplementary-descriptors
- Cambridge Power Up 第二版：https://www.cambridge.es/en/catalogue/primary/courses/powerup2ed
- Oxford Discover：https://www.oup.com.cn/zh/english-learning/primary/oxford-discover
- NGL Look：https://www.eltngl.com/digital/global/2020-ylt-catalog/pdfs/younglearners_teens_catalog_look.pdf
- Cambridge Think 第二版：https://shop.cambridge.org/english/product/2700224614
