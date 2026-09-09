# Checklist

## 契约与依赖方向
- [x] `ImagePart` 定义在 shared 层，无任何 pi import（`npm run check:deps` 通过）
- [x] `PromptRequest.images` / `UserMessage.images` / `pickImageFiles` 通道均集中在 shared/ipc.ts 或 session-events.ts，无双侧字面量重复
- [x] pi 类型未流出到 renderer

## 链路功能
- [x] 粘贴（Ctrl+V）图片进入缩略图条
- [x] 拖拽图片文件进入缩略图条（含悬停反馈）
- [x] 附件按钮弹出系统文件选择对话框（png/jpeg/gif/webp 过滤，多选）
- [x] 格式/大小校验生效：非支持格式或 >5MB 时 toast 报错且不入列（三入口口径一致；dialog 入口的大小守门在 main 的 readImageFile，经 invoke reject → onError toast，Task 7 修复）
- [x] 缩略图可单张删除；提交后清空（提交成功才清，失败保留可重试）
- [x] 提交链路 `renderer → IPC → daemon → session-host → pi prompt(text, { images })` 全通（pi 0.85.1 签名已实证核对）
- [x] 流式期间带图提交走 steer/followUp 且图片透传
- [x] 用户消息气泡显示图片缩略图（在线路径，含点击放大）
- [x] 重启恢复会话后用户消息图片同样显示（重建路径，与在线口径一致，不再只有 `[图片]` 占位）
- [x] 非视觉模型 + 已附加图片时显示降级提示；实际发送由 pi-ai 降级为占位文本，不报错

## 质量门
- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过
- [x] `npm test` 通过（含新增单测：session-host 翻译、session-rebuild 图片块）
- [ ] 手测 smoke 全过（发送/显示/恢复/流式追加）——GUI 交互需用户手测，自动化替代证据：smoke:session 13/13、smoke:sdk 3/3、build 三段通过；手测步骤见 tasks.md 6.3
- [x] 未触碰 documents/ 与无关文件；注释写「为什么」
