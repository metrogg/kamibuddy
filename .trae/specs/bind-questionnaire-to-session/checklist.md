# Checklist

- [x] QuestionnaireRequest 与 PermissionRequest 契约含 sessionId（shared/ipc.ts），daemon 在两处接线闭包注入所属桶 id
- [x] 问卷只在「请求 sessionId === 当前可见会话」时上屏；查看其他会话时不弹出、请求保留
- [x] 「待确认」badge 画在请求归属的会话行（可多行），不再一律挂当前行
- [x] 审批弹窗维持全局模态（注释写明安全闸取舍）；审批的 badge 同样按 sessionId 归属
- [x] 问卷浮层内联在对话页 composer 位置，激活时 composer 不渲染，答完/跳过恢复
- [x] 浮层样式逐项对齐 v3 真值：卡片 24px radius + 指定阴影 + max-height min(60vh,520px) + 0.2s 上滑 8px 淡入；header padding 20/24/8 + 分页器 24×24 + X；选项行 40px 高 + radius 12px + 1px 分隔线 + 序号块 24×24 radius 8px（hover/选中反白）+ 行尾箭头淡入；「其他补充…」行 24×24 radius 7px 铅笔块 + 透明 input；footer padding 12/20/20 + min-height 52px + 跳过胶囊 32px/radius 24px + 32×32 圆形前进/发送按钮；light 五档文本色
- [x] 交互：单选点选项 120ms 自动前进；末题点选即提交（防重复提交）；分页器自由翻页改答；逐题跳过（末题=空答提交）；X 整卡跳过；其他…与选项互斥、回车确认（IME 守卫）
- [x] 作答链路不回归：提交/跳过后 daemon 应答、工具卡显示已回答/已跳过、run 继续
- [x] 切走再切回：浮层按队列原样呈现（作答态保留在该会话视图的渲染里）
- [x] 多请求排队：审批优先于问卷，同类型 FIFO
- [x] npm run typecheck && npm run check:deps && npm test 全绿；smoke:session 回归通过
- [x] docs/workbuddy对齐清单.md C7 行更新（注明会话绑定、v3 内联浮层、与 WorkBuddy 的取舍差异）
