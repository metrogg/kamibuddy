# Tasks

- [x] Task 1: 模式白名单挂载 present_files（核心修复）
  - [x] 1.1 `resources/modes/craft.md` frontmatter `tools` 数组加入 `present_files`
  - [x] 1.2 `resources/modes/ask.md` frontmatter `tools` 数组加入 `present_files`
  - [x] 1.3 回归测试：craft 与 ask 的 frontmatter `tools` 必须含 `present_files`（防未来重构漏挂）

- [x] Task 2: 修复 present_files 结果误导（P1/P2）
  - [x] 2.1 `src/shared/artifacts.ts`：`classifyPresentedFiles` 的 `sizeOf` 入参改为三态返回（`"outside" | "missing" | number`），`missing` 只在工作区内 stat 失败时产生；`PresentedFile.size` 语义不变（number，不探测/URL 为 0）
  - [x] 2.2 `src/extensions/present-files.ts`：适配新签名；`warnings` 只在 `missing.length > 0` 时出现
  - [x] 2.3 `src/extensions/present-files.ts`：结果 JSON 的 `message` 改为"已交付"中性表述；`previewed` 只回真实 `focusFile`（无则 `[]`），不再写"已在预览面板打开"
  - [x] 2.4 测试：playground 交付本地文件不警告、工作区内不存在文件给警告、区外真实文件不警告、结果 message/previewed 口径

- [x] Task 3: URL 产物在预览面板外部打开（P3）
  - [x] 3.1 `src/renderer/artifact-panel.tsx`：URL 产物（`http(s)://`）点击时走 `onOpenExternal`，不走 `onOpen`/readArtifact
  - [x] 3.2 `src/renderer/chat-view.tsx`：产物卡 URL 项点击同样走外部打开；产物卡对 URL 与本地文件做区分（图标或提示）
  - [x] 3.3 测试/冒烟：点击 URL 产物不触发 readArtifact、不显示"暂不支持预览此类型"

- [x] Task 4: CSP 与 HTML 预览路径确认（P4）
  - [x] 4.1 检查 `src/main/index.ts` 的 CSP：`frame-src`/`child-src`（或 `default-src` 兜底）必须放行 `http://127.0.0.1:*`；静态服务绑定 127.0.0.1 随机端口（`preview-server.ts` 已满足）
  - [x] 4.2 若 CSP 已配置则只留回归断言；若未配置则补齐
  - [x] 4.3 冒烟：工作区内交付 HTML 自动在预览面板打开且 JS 可运行（iframe sandbox `allow-scripts allow-same-origin allow-forms`）

- [x] Task 5: 全链路回归验证
  - [x] 5.1 `npm test` 全绿（含新增用例）
  - [x] 5.2 `npm run typecheck && npm run check:deps` 通过
  - [ ] 5.3 冒烟：craft 模式完成任务 → 模型调用 present_files → 产物卡出现 → 首个本地 HTML 在右侧面板自动打开且可运行 → 交付区外/URL 不误导（需真实 LLM 会话，人工验证）

# Task Dependencies

- Task 2 的 2.2/2.3 依赖 2.1（签名变更先行）
- Task 3 的 3.2 依赖 3.1（同一链路两侧入口）
- Task 4 独立（只读确认或补配置），可与 Task 1-3 并行
- Task 5 依赖 Task 1-4 全部完成
