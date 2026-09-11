# Tasks

- [x] Task 1: 片段引擎 + 来源追踪（`src/core/prompt-composer.ts`）
  - [x] SubTask 1.1: `{{> name}}` include 指令：递归展开（片段可含 include 与
        {{slot}}），环检测 + 缺失抛错 + 深度上限 8；展开在槽位替换之前
  - [x] SubTask 1.2: provenance 版组装：`composePromptWithMeta(input) →
        { text, segments[] }`；按段压平方案保证「拼接 == text」严格成立
  - [x] SubTask 1.3: 现有 `composePrompt` 薄封装零破坏；+14 引擎测试

- [x] Task 2: fragments 内容 + work 场景骨架重构
  - [x] SubTask 2.1: `resources/prompts/fragments/`（delivery-rules /
        tool-discipline / windows-notes / regional-conventions + README 来源）；
        identity-boundary 保留自写（现版更好）
  - [x] SubTask 2.2: work/prompt.md 重构为骨架 + {{> }} 引用；语义等价实证
        （31 个非空行除产品名改名外逐字保留，分段拼接==text）

- [x] Task 3: code 场景（F3 矩阵第二轴）
  - [x] SubTask 3.1: `resources/scenes/code/prompt.md`（搬 welcomemode/code 适配：
        腾讯生态引用删除、工具名映射、槽位对齐；骨架自含未引片段）
  - [x] SubTask 3.2: 场景发现「加目录即生效」成立（零 src 改动）；frontmatter
        ready: true 开通；code × 四模式组装验证；design 维持占位

- [x] Task 4: F8 风格系统
  - [x] SubTask 4.1: `resources/styles/` 7 个 style-*.md 原样（SHA256 一致）+ README
  - [x] SubTask 4.2: resources 加载 styles；preferences.styleId 三态
        （undefined=默认 professional / 空串=关闭 / 指定 id）；IPC get/set-style
  - [x] SubTask 4.3: composer 注入（交互段后，HOW-not-WHAT 元规则，style:<id>
        溯源）；漂移降级默认 + style_drift 日志；子代理编译期无 style 字段
  - [x] SubTask 4.4: 设置页「回复风格」选择器（7 选 1 + 关闭）

- [x] Task 5: 提示词预览页（设置内）
  - [x] SubTask 5.1: `prompt:preview` IPC + daemon/prompt-preview.ts 纯逻辑
        （12 测试）；非法输入响亮报错；expert 预览不注人格（注释+页脚说明）
  - [x] SubTask 5.2: settings-view「提示词预览」：三选择器 + 分段卡（8 类来源
        配色/字数/折叠）+ 完整文本切换 + 总字数 + 重新生成

- [x] Task 6: 收尾
  - [x] SubTask 6.1: 对齐清单 F1 ✅（含预览可视化）/ F3 🟡 2×4 / F8 ✅ + 表头统计
  - [x] SubTask 6.2: 全量验证（见 checklist 末行）

# Task Dependencies

- Task 1 是 Task 2/3/4.3/5 的共同前置（引擎与 provenance）
- Task 2 与 Task 3 可并行（同一引擎不同内容）；Task 4 的 4.1/4.2/4.4 与 Task 1 并行
- Task 5 依赖 Task 1（provenance）；Task 6 最后
