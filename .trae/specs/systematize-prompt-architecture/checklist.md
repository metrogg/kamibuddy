# Checklist

- [x] `{{> fragment}}` include 引擎：递归展开/环检测/缺失抛错/深度上限 8，
      展开先于槽位替换；14 个引擎测试覆盖
- [x] `composePromptWithMeta` 产出 segments 且拼接与 text 字节一致（按段压平
      方案，含空 skills 场景）；现有 composePrompt 薄封装零破坏
- [x] `resources/prompts/fragments/` 共享片段落位（交付/工具纪律/Windows/地域），
      产品名「嘉立创Work」与工具名适配完成，腾讯生态引用删除，README 注明来源
- [x] work 场景骨架引用片段后语义等价（31 个非空行除产品名外逐字保留，
      实证对照）
- [x] `resources/scenes/code/` 落位且首页「代码开发」页签可用（frontmatter
      ready: true，加目录即生效零 src 改动）；code × 四模式组装验证
- [x] `resources/styles/` 7 个风格原样搬用（SHA256 一致）；preferences.styleId
      三态持久化；风格段注入主会话（带 HOW-not-WHAT 元规则）、子代理不注入
      （编译期无字段 + 运行期测试）
- [x] 设置页「回复风格」选择器（7 选 1 + 关闭，默认专业）
- [x] 设置页「提示词预览」：三选择器 + 分段视图（8 类来源配色/字数/折叠）+
      完整文本；与真实组装共用同一 composePromptWithMeta 链路（预览如实标注
      pi-context 与专家人格不出现）
- [x] 对齐清单 F1/F3/F8 行与表头统计更新（F1 ✅ 含预览可视化 / F3 🟡 2×4 /
      F8 ✅；193 条 ✅42/🟡41/❌85/⛔25）
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
      （200 文件，1236 用例；本变更新增 60+ 测试）
