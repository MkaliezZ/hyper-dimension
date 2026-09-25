# 集群共享英语教材库与向量索引：存储、检索与版本引用 v0.1

状态：架构设计。现有本地原书仅作研究和核验来源；本文不授权将原书上传生产集群或纳入公开仓库。

## 为什么采用共享教材库

2026-09-26 核对本地“英语教育/原书”：258 份 PDF、25,584,336,094 字节（约 25.58 GB / 23.83 GiB）；全部可打开，44 份的抽样页没有可提取文本。它们尚未与第三方目录逐册对齐，也未完成全文 E3 审阅或 E4 二人复核。因此“文件齐全”“文字可检索”“教材版本核准”“可在商业服务中复用”是四个独立状态。

同一部署区域内，每个集群使用一个逻辑教材目录、共享对象存储和共享检索索引。它是供已认证教师 Agent 共用的集群级资料服务，而非向互联网匿名开放的“公共数据库”。多个教师 Agent 通过服务端教材引用访问；教师、班级和学生记录只保存选用版本、授课进度与许可范围，不保存 PDF 副本。对象存储可以为可用性保留多个副本，不能把“共享一份逻辑资料”理解为只保留一份物理数据。现有静态站点机器不承担这套对象存储或 OCR 任务。

## 对象与引用

- textbook_edition：稳定 edition_ref，出版社、系列、六三/五四学制、年级、册次、修订年、印次、ISBN、封面或版权页核验状态。书名或出版社单独不能确定版本。
- textbook_asset：edition_ref、内容 SHA-256、字节数、页数、受控对象键、来源证明、权利状态、可执行操作范围。原书对象只在服务器侧解析，Agent 不获得磁盘路径或整本 PDF。
- textbook_section：section_ref、所属 edition_ref、章节层级、页码范围及内容核验状态。书本可有单元、课时、项目、复习和附录。
- textbook_evidence：section_ref、页码、OCR/人工复核状态、简短教学摘要、能力节点映射版本。无法准确读取正文时返回 unresolved，不编造题目或页码。
- textbook_chunk：chunk_ref、edition_ref、asset_hash、section_ref、页码范围、内容摘要或获准文本、text_hash、OCR 状态、权利范围、embedding_model/version。向量只是定位候选证据的索引，原书对象和版本元数据仍是权威来源。
- teacher_textbook_binding：teacher/tenant/class 与 edition_ref、当前学校授课 section_ref、教师确认时间。学生档案可引用此绑定并记录本人进度。
- assignment/report：固定 edition_ref、asset_hash、section_ref、mapping_version 与生成时的教材依据。教材更新只产生新版本，不静默改写旧报告。

每一册设独立的 catalog_status、content_review_status、rights_status。目录已核实不等于正文已审阅，PDF 可打开不等于 OCR 可信，研究持有不等于允许多租户云端使用。

## 查询与 Agent 工具

教师 Agent 通过同一受控业务服务上的 MCP 工具完成：

1. resolve_textbook_edition：根据学校、学制、出版社、系列、年级、册次、修订年/印次/ISBN 找候选；不唯一时返回 needs_teacher_confirmation。
2. list_textbook_sections：返回当前版本的章节和核验状态。
3. search_textbook_evidence：以 edition_ref、section_ref、教学任务、能力节点检索已授权的页码及摘要；返回引用、来源状态和置信原因。
4. bind_class_textbook：经教师确认将班级绑定到一个具体版本，并记录审计；Agent 不凭自然语言猜测后直接改绑定。

MCP 限定工具输入与输出，教材目录服务再核验权限、版本、权利范围和速率。检索先确定教师所选 edition_ref、rights_scope 与已核验 section_ref，再组合精确字段/关键词检索与向量相似度检索；最后回查原书哈希、页码和审核状态。语义相近不能跨版本替代课文。可在 PostgreSQL 使用全文检索 + [pgvector](https://github.com/pgvector/pgvector)；先比较按具体版本过滤后的精确检索质量，再决定是否增加 HNSW 近似索引。A2A 中教师 Agent 与学生 Agent 交换 edition_ref、section_ref、证据引用和任务状态，不发送 PDF 路径或整本内容。每次出题仅取必要、已核验且允许该用途的教材证据；模型不接收 25 GB 原书，也不直接访问共享桶。

## 集群与失败处理

集群内使用对象存储或受控共享文件系统保存一次逻辑原书对象，按 SHA-256 去重；PostgreSQL 管理版本、章节、全文索引、向量、权限、审阅状态和审计，独立 worker 完成 OCR、分段、向量生成、索引与校验。热点页可以做只读缓存。备份、跨可用区副本和必要时跨集群复制按恢复目标确定，成本不能仅按原始 25.58 GB 估算，还包括 OCR 文本、索引、备份及副本。

写入流程：确认来源与权利 → 校验文件哈希/页数 → 识别版次 → OCR 与质量抽检 → 人工核对关键页 → 建索引 → 经权利和内容门槛发布可检索版本。检索时再次固定 edition_ref 和 asset_hash；文件缺失、哈希不符、错误版次或正文未核实时，返回明确状态并请求教师核对，不能让 Agent 猜测课文。全量覆盖率应按每册逐页和权利状态统计，而非仅按文件数统计。

## 权利边界

公开可浏览或用户已下载的 PDF，不自动带来平台向多个教师、学生或 Agent 提供整本教材的授权。生产共享库在 rights_status 未核准时只能使用许可明确的元数据、原创摘要或获准引用；原书全文访问和多租户复用需依据具体来源及权利许可另行核实。课堂教学中的有限使用与向平台用户持续提供数字教材是不同使用场景。参见[国家版权局《著作权法》](https://www.ncac.gov.cn/xxfb/flfg/flfg_532/202103/t20210309_50530.html)和[教育部数字教育资源入库出库规范](https://www.moe.gov.cn/srcsite/A16/s3342/202407/t20240703_1139249.html)。

## 当前开发落点

现有 AssessmentService 已保存 book_id 与 school_progress，但 book_id 仍是自由字符串，尚无共享教材目录或强制版次绑定。下一切片先做不含 PDF 的 edition/section/chunk/rights Schema、元数据导入和教师确认流程；再在取得可用权利范围后接入共享对象存储、OCR、全文与向量混合检索、MCP 证据工具。向量模型版本须固定，换模型重建索引不改变 edition_ref、页码或历史报告引用。该顺序允许先开发多教材逻辑，同时避免把本地研究用 PDF 误当可公开分发的产品资产。
