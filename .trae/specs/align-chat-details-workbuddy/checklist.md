# Checklist

## ① 助手回答底部操作条（仅复制）

- [x] 每条助手消息正文下方有操作条，未 hover 时不可见但占位（消息间距不跳动）
- [x] hover 浮现操作条，只有复制一个按钮；点击后该条 Markdown 源文入剪贴板
- [x] 复制成功图标变对勾约 2 秒后复原（与用户气泡同一节奏）

## ② 对话页输入区模型快捷切换

- [x] 对话页 composer-bar 左侧出现模型短名按钮（与首页同一 ModelMenu 组件）
- [x] 点击展开可用模型弹层（向上展开、左对齐、不溢出窗口右缘），选中即生效
- [x] 切换后按钮文案经 session_state 推送自动刷新，无本地回写

## ③ 代码块卡片化

- [x] 围栏代码块渲染为卡片：头部语言名（无语言显示「text」）+ 复制按钮，body 60vh 限高滚动
- [x] 复制内容为代码纯文本，成功对勾 2s；行内 code 样式不变
- [x] 语言名提取纯函数有 vitest 用例

## ④ 停止二次确认

- [x] 流式期间首次点停止/按 Esc：按钮变 Esc 徽章进入 3s 待确认态，不中断
- [x] 3s 内再次触发才真正调 onAbort；超时自动复原，生成不受影响
- [x] 非流式按 Esc 无任何效果；autocomplete 打开时 Esc 仍归补全消费
- [x] stop-confirm 状态机有 vitest 用例

## ⑤ 输入历史与草稿

- [x] Alt+↑/↓ 翻阅本进程已发送消息；首次上翻暂存草稿，到底再按 Alt+↓ 恢复草稿
- [x] 切到设置/首页再切回对话页，输入框草稿按 sessionId 还原
- [x] autocomplete 打开时方向键仍归补全消费；IME composition 期间不翻历史
- [x] input-history 纯函数有 vitest 用例（边界、暂存/恢复、空历史）

## ⑥ 字数限制与余量

- [x] 输入超过 99000 字符后 composer-bar 右侧显示剩余字数（等宽数字）
- [x] 超过 10 万字符：数字变红、发送按钮禁用、submit() 拦截发不出去
- [x] 显示判定纯函数有 vitest 用例

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
- [x] 未触碰 shared / daemon / core / 契约（纯 renderer 改动）
- [x] `docs/STATUS.md` 已更新（含人工冒烟项）
- [x] `align-chat-ui-workbuddy/tasks.md` 的 Task 10/11/12/14 已同步勾选，其余项保持未勾
