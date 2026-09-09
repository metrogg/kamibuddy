# Checklist

- [x] craft.md 与 ask.md 的 frontmatter `tools` 均包含 `present_files`，且存在回归测试断言
- [x] `classifyPresentedFiles` 的 `sizeOf` 为三态（outside/missing/number），missing 只在工作区内 stat 失败时产生
- [x] playground 会话交付本地真实文件时 `warnings` 为空；工作区内不存在文件时 `warnings` 含"不存在或不可读，请核对"；区外真实文件 `warnings` 为空
- [x] `present_files` 结果 JSON：`message` 为中性"已交付"表述；`previewed` 只回真实 focusFile（无则空数组）；无"已在预览面板打开"等不可兑现承诺
- [x] 产物清单/预览面板中 URL 产物点击走外部打开（系统浏览器），不发起 readArtifact，不显示"暂不支持预览此类型"
- [x] 工作区内交付的 HTML 在右侧预览面板 iframe 中能加载并执行 JS（main 窗口 CSP 放行 `http://127.0.0.1:*`）
- [x] 非绝对路径 / `file://` / `javascript:` / `data:` 仍整单报错、不交付任何一项（测试断言存在）
- [x] `npm test` 全绿；`npm run typecheck && npm run check:deps` 通过
- [ ] 冒烟：craft 模式任务完成 → present_files 被调用 → 产物卡出现 → 首个本地 HTML 自动在右侧面板打开且可运行（需真实 LLM 会话，人工验证）
