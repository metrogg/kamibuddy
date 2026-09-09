# Tasks

- [x] Task 1: shared 契约扩展
  - [x] 1.1 在 `src/shared/ipc.ts` 定义 `ImagePart` 类型（type/data/mimeType，注释说明与 pi `ImageContent` 结构对齐、shared 不许 import pi）；`PromptRequest` 增加 `images?: readonly ImagePart[]`
  - [x] 1.2 在 `src/shared/session-events.ts` 的 `UserMessage` 增加 `images?: readonly ImagePart[]`
  - [x] 1.3 新增 `pickImageFiles` invoke 通道定义（请求/响应 payload，参考现有 pickSkillDirectory 的写法）
- [x] Task 2: daemon 与适配层透传
  - [x] 2.1 `src/daemon/index.ts` prompt handler 解构 `images` 并传给 `host.prompt`；实现 `pickImageFiles` handler（main 侧 dialog.showOpenDialog，图片过滤器 png/jpeg/gif/webp，多选）
  - [x] 2.2 `src/core/session-host.ts` `prompt(text, whileStreaming?, images?)`：非流式走 `session.prompt(text, { images })`；流式走 `session.steer(text, images)` / `session.followUp(text, images)`（核对 pi SDK 实际签名：prompt 用 options 对象，steer/followUp 是第二参数）
  - [x] 2.3 用户消息翻译：从 pi 会话事件提取 user message 时同时取出 image 块（现 `textOf` 丢弃非 text 块——新增 `userContentOf` 之类同时产出 text 与 images），UserMessage 事件下发带 `images`
  - [x] 2.4 验证 pi SDK prompt 路径是否自动缩放图片（CLI 有 2000×2000/4.5MB 管线）；若不缩放，评估在 daemon 侧限制 payload 或接受现状（5MB 上限已兜底），记录结论
    - 结论：prompt 路径不做缩放（只发生在 read 工具/CLI @file/工具结果归一化三条路径）；SDK 根包已导出 resizeImage，将来需要时可在 main 读文件处调用。当前以 5MB 上限兜底。
- [x] Task 3: 历史重建一致性
  - [x] 3.1 `src/core/session-rebuild.ts`：user message 的 image 块转 `images` 字段（缩略图展示），文本部分口径与在线一致；更新相关测试（session-rebuild.test.ts 现有 image 块用例）
- [x] Task 4: renderer 输入 UI
  - [x] 4.1 chat-view 与 home-view 输入框接 `onPaste`（clipboardData 图片项）、`onDrop`/`onDragOver`（拖拽悬停反馈）；复用/抽取公共附件状态逻辑（注意与 useImeGuard 不冲突——paste/drop 独立于 keydown）
  - [x] 4.2 附件按钮从 toast 占位改为调 `pickImageFiles`；替换 App.tsx 中对应 onTodo 接线
  - [x] 4.3 附件校验：格式 png/jpeg/gif/webp、单张 ≤5MB，超限 toast 报错；缩略图条渲染 + 单张删除
  - [x] 4.4 提交链路：`submit` 带 images（空数组不传字段）；发送成功后清空缩略图条
- [x] Task 5: 消息展示
  - [x] 5.1 用户消息气泡渲染 `images` 缩略图（点击可选放大预览，MVP 可先用原生 title/简单放大）
  - [x] 5.2 非视觉模型提示：当前模型 `vision` 为 false 且缩略图条非空时，输入区显示提示条（模型目录已有 vision 标识）
- [x] Task 7: 修复 dialog 入口缺失的 5MB 校验（验证发现：pickImageFiles 返回的 ImagePart 直接并入，粘贴/拖拽有校验但按钮入口没有，三入口口径不一致）
  - [x] 7.1 在 `src/main/index.ts` 的 readImageFile（或 dialog handler）读文件前检查大小，>5MB 拒绝并报错（响亮失败，走现有错误通道让 renderer toast）
  - [x] 7.2 复跑 `npm run typecheck && npm run check:deps`，重验 checklist「格式/大小校验」项
- [x] Task 6: 验证
  - [x] 6.1 单测：session-host 用户消息翻译（含 images）、session-rebuild 图片块、IPC 契约类型
  - [x] 6.2 `npm run typecheck && npm run check:deps && npm test` 全绿（typecheck ✓、check:deps 99 文件 ✓、428 用例 ✓、smoke:session 13/13 ✓、smoke:sdk 3/3 ✓、build ✓）
  - [ ] 6.3 手测 smoke：粘贴截图/拖拽/按钮选择 → 发送 → 气泡显示 → 重启恢复显示；流式期间带图追加（steer 路径）——GUI 交互需用户手测，步骤清单见最终报告

# Task Dependencies
- Task 2、Task 4 依赖 Task 1（契约先行）
- Task 3 依赖 Task 1；可与 Task 2 并行
- Task 5 依赖 Task 1、Task 4
- Task 6 最后执行
