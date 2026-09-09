# Checklist

- [x] 已安装 `pdfjs-dist@6.3.289` 与 `officeparser@4.2.0`（版本钉死）；原生依赖检查：基线 23 个 `.node` → 24，唯一新增是 pdfjs v6 自带的 optional 配套 `@napi-rs/canvas`（Node 下补 DOMMatrix 的官方 prebuilt，Cherry Studio 同样随包携带），officeparser 零原生依赖——记录为例外并说明理由
- [x] `read_document` 对 pdf/docx/xlsx/pptx/odt 提取出非空文本，中文无乱码（spike 6/6 + 单测 23 个，含 CID 字体不嵌中文版——真实中文 PDF 主流形态；负面对照实证 cMapUrl 必要性）
- [x] PDF 分页：offset/limit 以页为单位，越界与默认值行为有测试；长文档 24k 截断并附「继续读 offset=N」引导（页边界截断不截半页，首页豁免防续读死循环——均有测试）
- [x] 四类错误文案符合 spec：无文本层 PDF（扫描件提示）、老格式 .doc（引导另存 .docx）、加密/损坏（明示原因，vi.mock 补测 encrypted/corrupt 两分支）、不支持扩展名（列支持清单）；均有单测
- [x] 权限门：`read_document` 工作区内放行、区外低风险询问、凭据目录禁读——三个分支有新测试（permission-policy 60 个），`npm run smoke:permission` 10/10
- [x] craft/ask 两个模式 frontmatter 白名单含 `read_document`；建会话工具集为 frontmatter 驱动（同源生效，已核对 session-host 组装逻辑）
- [x] 工具卡 label 有中文映射：live「阅读文档/已阅读」（session-host.ts），restored 走通用分支与 read 同构（ok→已阅读，非 ok→失败）
- [x] 场景提示词已声明文档读取能力（resources/scenes/work/prompt.md：可读 PDF/Word/Excel/PPT/ODF，与 read 分工写明）
- [x] playground 工具集未变（安全模型未动；原 PLAYGROUND_TOOLS 已随临时任务模型 spec 退役，无从误动）
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（582 个测试，独立复跑确认），`npm run smoke:permission` 通过
- [ ] 冒烟（用户重启后）：真实中文 PDF 与 docx 问答正常，工具卡显示正确
