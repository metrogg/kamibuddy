# Tasks

## 批一 · 契约与核心（有依赖顺序）

- [x] Task 1: 契约层（session:export 通道）
  - [x] 1.1 `src/shared/ipc.ts`：INVOKE 加 `sessionExport: "session:export"`，args: [path: string]，result: `{ outputPath: string }`；InvokeMap 同步
  - [x] 1.2 `src/shared/bridge.ts` + `src/preload/index.ts`：`exportSession(path)` 方法加入桥接口与白名单（照现有四个会话方法的样式）
- [x] Task 2: core 导出能力（依赖 Task 1 的类型）
  - [x] 2.1 `src/core/session-export.ts`（新）：纯函数 `buildExportPath(exportsDir, title, now)` → 输出绝对路径（mkdir 由调用方做；标题清洗：非法字符 `<>:"/\|?*` 与控制字符替换为 `-`、压单行、保留前 40 字符、空标题回退 `session`；时间戳 `yyyyMMdd-HHmmss`）；`exportFileName` 规则写注释（为什么固定默认根 exports 目录——playground 无工作区、用户总能在一个地方找到）
  - [x] 2.2 `src/core/session-host.ts`：加 `exportHtml(outputPath: string): Promise<string>` 包装（调 pi 的 `session.exportToHtml(outputPath)`，pi 类型止步于此）；空会话时 pi 抛 "Nothing to export yet"——捕获并改抛「该会话还没有内容可导出」（用户语言，判断依据 message 匹配，注释写明与 pi 文案的耦合）
  - [x] 2.3 `src/core/session-export.test.ts`（新）：标题清洗（非法字符/超长/空/中文保留）、时间戳格式、路径拼接 ≥6 用例

## 批二 · 编排与界面

- [x] Task 3: daemon sessionExport handler（依赖 Task 1、2）
  - [x] 3.1 `validateSessionFilePath(path, getSessionsDir())` 守卫（与其他会话操作同一防线）
  - [x] 3.2 目标 = 当前活动会话（path 与 host sessionFilePath 相同）→ mkdirSync(exportsDir, recursive) + `host.exportHtml(buildExportPath(...))`；无活动会话（hostPromise undefined）→ 抛「还没有会话，没有可导出的内容」
  - [x] 3.3 目标 ≠ 当前会话 → 先 `await resumeSession(path)`（复用现有函数全部守卫与原子性，**不重写**）→ 再按 3.2 导出；标题取 listSessions 里对应项的 title（找不到就用会话 id）
  - [x] 3.4 返回 `{ outputPath }`
- [x] Task 4: renderer 导出交互（依赖 Task 1、3）
  - [x] 4.1 sidebar.tsx：任务行 hover 操作区加「导出」按钮（图标按 icons.tsx 现有风格，无合适则补 IconExport/IconDownload）；当前会话行 title="导出为 HTML"；历史行 title="恢复此会话并导出 HTML"（上下文切换语义必须可见）
  - [x] 4.2 App.tsx：`exportTask(path)`：调 exportSession → 成功 toast「已导出：<outputPath>」+ `openArtifact(outputPath)` 自动打开 + 若发生会话切换（非当前行导出）则 resyncSnapshot + refreshTasks + setView("chat")；失败 toast 留在原视图；传给 Sidebar

## 批三 · 收尾

- [x] Task 5: 验证与文档
  - [x] 5.1 `npm run check && npm test` 全绿；`npm run smoke:session` / `npm run smoke:permission` 不回退
  - [x] 5.2 docs/STATUS.md 补「会话导出 HTML（2026-09-09）」小节（含 pi 包根导出面的实测结论）与「等你验证」条目

# Task Dependencies

- Task 2、3 依赖 Task 1（契约类型）；Task 3 依赖 Task 2（core 能力）
- Task 4 依赖 Task 1、Task 3
- Task 5 依赖全部
- Task 1 与 Task 2 的 2.2 可并行（不同文件）

# 实现注意事项（写代码前必读）

- **pi 包根导出面（已实测，勿绕）**：`exportFromFile`/`exportSessionToHtml` 不在包根
  （深路径 import 实测 ERR_PACKAGE_PATH_NOT_EXPORTED）；只有 `AgentSession.exportToHtml()`
  实例方法可用。历史会话「先恢复再导出」是唯一正路。
- 历史会话导出 = resume + 导出，**resume 必须复用 daemon 现有函数**（含流式守卫、
  路径校验、失败原子性），不要在 handler 里复制一份恢复逻辑。
- resume 后 renderer 需要 resyncSnapshot（对话内容变了）——App 侧已有现成流。
- `openArtifact` 无路径边界是已知问题：本链路 outputPath 由 daemon 构造、renderer 不回传，
  不接受用户输入路径，不受影响；不要顺手「修」openArtifact（另有排期）。
- 遵守 AGENTS.md：daemon 不 import electron；pi 类型只在 core/extensions；注释写「为什么」。
