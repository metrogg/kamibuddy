# Checklist

## 记录更正（Task 0）

- [x] `add-skill-management/tasks.md` 里关于技能发现的表述已改为「pi 递归下探、目录自带 SKILL.md 即止」，
      并附四家证据路径（pi 测试 `:97-118` 精确到两个用例、codex 测试名与行号、opencode 文档、WB plugin.json）
- [x] 该段不再暗示「发现只一层是缺陷」，而是写明「docx/SKILL.md 是技能边界，边界内是按需资源 —— 四家共同设计」
- [x] 「上一轮 checklist 那条空过」的表述已改准确（三个子技能本就不被加载，断言是**真空成立**）；
      同段数字错误已修（13 → 14）

## 待填业务文档（Task 1）

- [x] `resources/skills/docx/generate-fillable-contract-html/SKILL.md` 存在，正文与 WB 原文一致
      （只改了工具名与来源注释）
- [x] frontmatter 有 `name` / `description` / `version`；`user-invocable: false` +
      `disable-model-invocation: true` 与 WB 一致（内部技能）
- [x] 来源注释注明了出处、搬入日期与「内部阶段原样搬用、上线前风险置换」
- [x] 兼容性已用**真实转换**验证：5 个字段产出配对书签、书签名是中文、
      表格 `&nbsp;` 被取为可见范围；重复中文书签名时出现 `Duplicate docx bookmark name` 告警（不静默）
- [x] orchestrator 里有一条明确判据：「合同/报价单/授权委托书 + 待填/空白/可填空」→ 本技能产出 HTML
      （不走 typeset 的 legal-contract 模板）
- [x] 只说「来份合同」（无待填诉求）仍走常规 legal-contract 通道（判据明写了不误伤）

## docx→HTML 引擎（Task 2）

- [x] `resources/docx-engine/docx_to_html/` 存在，`python -m docx_to_html extract …` 可跑
- [x] CLI 契约与正向同形：exit 0 → stdout 单行 JSON；exit 1 → stderr 单行 JSON（实测两条都贴过）
- [x] `requirements.txt` **没有新增依赖**（python-docx + stdlib zipfile）
- [x] 提取覆盖：标题 1-6 / 段落（缩进·对齐·字号·字体·粗斜体·颜色）/ 列表（含层级）/ 表格 / 图片导出 / 空段落结构
- [x] 输出根元素是 `article.docx-content`，样式走 inline style
- [x] 图片落在 `<assets-dir>/images/`，HTML 里以**相对 HTML 目录**的路径引用（缺陷已修，见漏项记录）
- [x] 返回里带 `not_restorable`，且与技能正文里写的清单一致或更全（技能列 9 项 + 4 条降级）
- [x] 坏输入（非 docx / 损坏 zip / 缺 document.xml / 缺 -o / assets 不可写）→ exit 1 且**不产出 HTML**
- [x] `resources/docx-engine/README.md` 已补反向模块说明（目录 / 契约 / 共用 venv / 自研声明）
- [x] pytest `docx_to_html/tests` 35 passed（含正反向往返用例）

## TS 接线（Task 3）

- [x] `src/documents/docx-extract.ts` 是纯函数层（可单测，无 electron/pi 依赖，复用 docx-convert 的 RunFn）
- [x] 工具 `docx_extract` 在场，label「提取文档版式」，参数 `docxPath` + `outputPath`（+ 可选 `assetsDir`）
- [x] 写侧参数名是 `outputPath`；`permission-policy.ts` 的 MUTATING 表已含 `docx_extract`；
      gate 的锚定用例已补（policy 3 例 + gate 2 例）
- [x] `resources/modes/craft.md` 白名单含 `docx_extract`；ask / plan **不含**
- [x] `TOOL_RUNNING_LABELS`「提取文档版式」/ `TOOL_DONE_LABELS`「已提取」有 `docx_extract`；
      未进 `STREAM_CARD_TOOLS`（附理由）
- [x] 用户会话 / 子代理 / 定时 run 三处扩展集都注册了它
- [x] 工具描述写清了与 `read_document` 的区别，且含「不承诺 1:1 还原」「失败不要反复重试」
- [x] `docx-extract.test.ts` / `docx-extract-tool.test.ts` 覆盖参数形状、错误分类、错误上抛

## format-extract 技能与编排（Task 4）

- [x] `resources/skills/docx/format-extract/SKILL.md` 存在，frontmatter 为内部技能口径且带 `version`
- [x] 正文写明：职责边界三条、调用契约表、产物形状、不可复原清单（9 项 + 4 条降级）、失败处理三类
- [x] `docx/SKILL.md` 目录地图含新增两条（现 11 条，与目录实际 11 个子目录一致）
- [x] orchestrator 的「整篇美化/重排」已升级为「.docx 先 `docx_extract` 再重排」；纯文本/Markdown 路径不变；
      深度工作流 reference 表新增 P1 行指向 format-extract
- [x] `resources/skills/docx/README.md` 已建，搬用 / 自研分开标注，且是**逐文件比对 MD5** 后的结论
      （并纠正了「三个 agents 与 design-token 是搬用」的说法 —— 它们与 WB 差异 92-152 行，归为已改写）

## 冒烟与校验（Task 5）

- [x] 反向往返冒烟通过：`npm run smoke:docx-roundtrip` **11/11 通过（1 SKIP：样张无图）**，
      覆盖 h1/h2 文案、表格表头与单元格、3 个中英混排关键串、`not_restorable` 形态
- [x] 环境缺失路径实测：FAIL + 准备引导 + 非零退出（不静默跳过）
- [x] `npm run typecheck` 通过（exit 0）
- [x] `npm run check:deps` 通过（321 个文件，依赖方向通过）
- [x] `npm test` 全绿（`2206 passed | 10 skipped`；唯一失败是既有的环境性 sandbox 探测用例）
- [x] `npm run check:tokens` 真违例 0 处
- [x] `npm run smoke:session` 通过（14/14），技能发现**没有新增顶层技能**
- [x] 本 spec 未删除任何既有 spec 文档
- [ ] **真实界面**人工确认（待用户执行，见 tasks.md SubTask 5.6）

## 实施中修掉的漏项（记录）

- [x] 图片 `src` 由「相对 assets_dir」改成「**相对 HTML 文件所在目录**」（原实现与缺省 assets 布局不自洽，
      下游按 HTML 目录解析会找不到图）；README 里被当特性写的 4 处描述一并改对
- [x] pi 的技能发现证据行号由 `97-115` 精确到 `97-118`（并标出两个用例各自的行段）
