# Tasks

- [x] Task 1: 依赖安装与提取 spike
  - [x] 1.1 `npm i pdfjs-dist officeparser@^4.2.0`（钉死版本）；`npm ls` 全量检查未引入含 `.node` 的原生依赖
  - [x] 1.2 写 `scripts/probe-doc-extract.ts`：pdfjs 在 Node 22 ESM 下提取一份真实中文 PDF——CMap 与 standard_fonts 路径解析正确（中文乱码根因）、不配 worker、Uint8Array 喂数据；officeparser v4 提取 docx/xlsx/pptx/odt 各一份；运行并记录各格式提取质量（中文是否乱码、表格可读性、pptx 文本完整度），结论写进脚本头注释

- [x] Task 2: 提取纯函数层 core/doc-extract.ts
  - [x] 2.1 测试 fixtures（`src/core/test-fixtures/docs/`）：小体积中文 pdf（文字型，1-2 页）/docx/xlsx/pptx/odt 各一 + 无文本层 PDF 一 + 老格式 .doc 一；附可复现的生成方式说明（脚本或制作步骤注释）
  - [x] 2.2 `core/doc-extract.ts`：`detectDocKind(path)`（扩展名识别，老格式/不支持归类）→ `extractPdf(path, offset?, limit?)`（页级分页，无文本层检测）/ `extractOffice(path)`；统一返回 `{ text, pageInfo?, truncated, nextOffset? }`；24k 字符截断 + 续读引导文案；四类错误（扫描件/老格式/加密损坏/不支持）按 spec 文案
  - [x] 2.3 vitest：各格式提取非空且中文无乱码、PDF 分页边界（offset 越界/limit）、截断续读、四类错误分支

- [x] Task 3: 工具接线（read_document）
  - [x] 3.1 `src/extensions/doc-read-tool.ts`：仿 web-tools.ts 注册 `read_document`（path/offset?/limit?），工具描述写明与 read 的分工（read=文本与图片；read_document=PDF/Office）与支持格式清单
  - [x] 3.2 `permission-policy.ts`：`read_document` 同时进 `READ_ONLY` 与 `LOCAL_READ`；补测试：工作区内放行、区外低风险询问、凭据目录禁读
  - [x] 3.3 工具面同源：`resources/modes/{craft,ask}.md` frontmatter 白名单 + `session-host.ts` 建会话工具集同步加入（均为 frontmatter 驱动，加白名单即同源）；工具卡 label 映射（live「阅读文档/已阅读」；restored 走通用分支与 read 同构）

- [x] Task 4: 提示词与回归
  - [x] 4.1 `resources/scenes/work/prompt.md`（及涉及能力边界的其他场景）补「可读取 PDF/Office 文档（read_document）」（随 Task 3 完成）
  - [x] 4.2 `npm run typecheck && npm run check:deps && npm test` 全绿；权限相关改动加跑 `npm run smoke:permission`
  - [ ] 4.3 冒烟（用户重启后）：真实中文 PDF 与 docx 各问一次「总结一下这个文件」，确认提取质量与卡片显示

- [x] Task 5: 补 encrypted/corrupt 错误分支单测（checklist 验证发现的覆盖缺口）
  - [x] 5.1 doc-extract.test.ts：用 vi.mock 拦截 pdfjs 的 getDocument，分别模拟 PasswordException 类拒绝（→ code encrypted，文案明示已加密）与其他解析异常（→ code corrupt，带原始 message），断言错误码与文案
  - [x] 5.2 重跑 `npm run typecheck && npm test` 全绿（582 个测试）

# Task Dependencies

- Task 2 依赖 Task 1（库装好、pdfjs 中文路径姿势经 spike 确认）
- Task 3 依赖 Task 2（提取层先行）；3.1/3.2/3.3 相互文件交集小，同一 agent 顺序完成即可
- Task 4 依赖 Task 1-3 全部完成
