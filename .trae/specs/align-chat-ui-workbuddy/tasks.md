# Tasks

## 批一 · 视觉语言统一

- [x] Task 1: 扫光动画全局统一（shining text）
  - [x] 1.1 在 index.css 定义唯一扫光工具类（110° 渐变、background-clip: text、2.2s linear infinite、透明度 26%→55% 扫带），附「为什么」注释（对标 WorkBuddy cb-shining-text-sweep，全局唯一进行中语言）
  - [x] 1.2 底部状态行（stream-pending）文案套用扫光
  - [x] 1.3 工具卡执行中/生成中的 label 套用扫光（完成态回归静态）
  - [x] 1.4 ThinkingBlock 流式中的标题套用扫光（与 Task 2 同一组件，同一子代理完成避免冲突）
- [x] Task 2: 深度思考折叠升级（chat-view.tsx ThinkingBlock）
  - [x] 2.1 流式默认展开 + 标题扫光；assistant_done 后自动收起（用户手动干预过的不再自动）
  - [x] 2.2 展开态：200px 限高内部滚动 + 左侧 4px 竖条 + 上深下淡渐隐（background-attachment: local）
  - [x] 2.3 渲染逻辑下沉为纯函数/小组件并保持可测：折叠状态机（streaming→done→用户偏好）抽出，补 vitest 用例
- [x] Task 3: 等待 tips 轮播
  - [x] 3.1 自创 tips 文案池（≥20 条实用提示，放 resources/ 下数据文件，AGENTS.md §3 能力是数据；禁抄 WorkBuddy 文案）→ 实际落地 src/shared/waiting-tips.ts 常量（22 条，取舍理由见文件头注释）
  - [x] 3.2 等待首响应 4s 后出现首条，10s 轮换不重复，hover 暂停，× 关闭当条（会话内不再出现）
  - [x] 3.3 等待超时（8s）状态行切换安抚文案（自创）
- [x] Task 4: 中断终态可见（跨 daemon/shared/renderer）
  - [x] 4.1 契约：run 结束事件携带结束方式 completed/cancelled（session-events.ts + conversation.ts reducer 折叠进 TurnTiming）
  - [x] 4.2 session-host abort 路径发 cancelled 语义（pi 无独立取消事件，按 stopReason==="aborted" 判定）
  - [x] 4.3 消息流渲染「用户已取消」指示行 + TurnHeader 定格「已取消 Ns」
  - [x] 4.4 补 reducer 测试（cancelled 折叠、后续回合重置）→ 7 用例
- [x] Task 5: IME Enter 守卫
  - [x] 5.1 compositionstart/end 跟踪 + compositionend 后 100ms 宽限期吞 Enter（chat-view textarea keydown；注意不要打断 autocomplete 的 Enter 消费顺序）
  - [x] 5.2 抽纯函数（shouldSwallowEnter(composing, lastCompositionEndAt, now)），补单测 → 5 用例

## 批二 · 消息流结构

- [x] Task 6: MetaFold 过程折叠
  - [x] 6.1 shared 层纯函数：按 user 消息分组成「回合」，已完成回合内连续 tool 条目归为一个折叠单元；摘要生成（动作词映射 read→读取/write→写入/edit→修改/bash→运行命令…，归类计数「读取 3 个文件、写入 2 个文件」，兜底「N 个工具调用」）→ src/shared/metafold.ts，回合头部/取消占位一并纳入块流
  - [x] 6.2 补 vitest：分组、摘要、进行中不折叠、混合条目边界 → 19 用例
  - [x] 6.3 chat-view 渲染折叠行（摘要 + chevron，点击展开/收起，按折叠单元 id 记住展开状态）
- [x] Task 7: 用户消息气泡 + hover 工具条
  - [x] 7.1 气泡样式（右对齐、圆角 16/16/0/16、fit-content、max-width、超高滚动）
  - [x] 7.2 hover 工具条：智能时间戳（当天/昨天/当年/跨年四档，纯函数 + 单测 → src/shared/message-time.ts，8 用例）+ 复制（对勾 2s）
- [x] Task 8: 回到底部 + 滚动跟随
  - [x] 8.1 上滚停跟随、回底恢复；跟随逻辑替换现有「无条件贴底」useEffect（按测量位置判定，不区分事件来源，理由见 chat-view.tsx 注释）
  - [x] 8.2 「回到底部」圆形按钮（底部居中、阴影、入场动画）
- [x] Task 9: 错误卡与重试
  - [x] 9.1 run_error 渲染为内嵌错误卡（图标 + message + runId 复制 + 结构化报告复制）→ ErrorEntry 落 entries（契约由并行会话铺垫，本次接入块流）
  - [x] 9.2 重试按钮：重发最后一条 user 消息（无 user 消息隐藏）
  - [x] 9.3 替换现有 lastError 单行展示 → 同款卡片（无 runId 容错）

## 批三 · 输入区补齐

- [x] Task 10: 停止二次确认（随 align-chat-details-workbuddy 落地，2026-09-09）
  - [x] 10.1 首次点击/Esc 进 3s 待确认态（按钮变 Esc 徽章），再确认才调 onAbort，超时复原
  - [x] 10.2 状态机抽纯函数 + 单测
- [x] Task 11: 输入历史与草稿（随 align-chat-details-workbuddy 落地）
  - [x] 11.1 Alt+↑/↓ 翻本进程历史（发送成功时记录），到底再按恢复草稿
  - [x] 11.2 按 sessionId 存草稿，视图切换还原
- [x] Task 12: 字数限制与余量（随 align-chat-details-workbuddy 落地：10 万上限；<1000 显示余量；超限变红禁发）
- [ ] Task 13: 非默认交互模式 chip（输入区工具栏显示模式名，hover 变 × 回落 craft；复用现有 onInteractionChange）

## 批四 · 增强

- [x] Task 14: 代码块卡片化（随 align-chat-details-workbuddy 落地：markdown.tsx 自定义 pre 组件，圆角容器 + 头部语言名 + 复制按钮 + body 60vh 限高）
- [ ] Task 15: 用户消息编辑重发
  - [ ] 15.1 先核查 pi（开源项目/pi/packages/coding-agent/）的会话历史截断能力，记录结论到 tasks.md 本任务下
  - [ ] 15.2 可行：daemon IPC（截断 + 重发）；不可行：降级「文本回填输入框」
  - [ ] 15.3 气泡原位编辑器（Esc 取消 / Ctrl+Enter 保存 / hint 文案自创）
- [ ] Task 16: 产物卡网格 + 聚合入口
  - [ ] 16.1 两列网格（单产物独占行）+ HTML 卡右上 🌐 按钮（preview 而非外部打开）
  - [ ] 16.2 「查看所有产物(N)」「查看所有变更(N)」文字按钮 → 打开预览面板并展开概览菜单（App.tsx 联动）
- [ ] Task 17: 压缩分隔线（契约增 divider 条目 + daemon /compact 完成发事件 + reducer + 渲染细线分隔 + 测试）
- [ ] Task 18: toast 体系升级（堆叠上限 10、5s、五型、dedupKey；调用方兼容改造）
- [ ] Task 19: 消息流底部免责声明（自创文案，非流式时显示）

## 收尾

- [ ] Task 20: 全量验证 + 分批提交
  - [ ] 20.1 每批完成后跑 `npm run typecheck && npm run check:deps && npm test`
  - [ ] 20.2 每批独立 commit；提交前剥离并行会话 WIP（hunk 归属法：备份→checkout→重放→add→还原）

# Task Dependencies

- Task 2 依赖 Task 1（扫光类由 1.1 定义）；1.4 与 Task 2 同组件，建议同一子代理串行完成 1→2
- Task 3/4/5 与 1/2 文件交集小（3 碰 chat-view 状态行、4 碰 TurnHeader+契约、5 碰输入区），可并行；但都改 chat-view.tsx，并行子代理需按「各自负责独立组件/区块」划分，或串行
- 批二 Task 6/7/8/9 均主改 chat-view.tsx + index.css：6（工具卡区）、7（user 气泡）、8（滚动容器）、9（错误区）区块不重叠，可同一子代理串行或谨慎并行
- 批三 Task 10/11/12/13 都碰 composer 区块，串行为宜
- 批四 Task 14（markdown.tsx）独立，可与 15/16 并行；Task 17 依赖契约变更（勿与 Task 4 的契约改动并行）；Task 18（toast.tsx + App.tsx）独立
- Task 15 依赖 15.1 的核查结论决定路径
- Task 20 依赖全部前置任务
