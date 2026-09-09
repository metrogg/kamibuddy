# Checklist

- [x] assistant 消息无气泡背景、无圆角、padding 0、字号 14px、行高 20px
- [x] 用户消息保持右侧气泡（圆角 16/16/0/16、背景 --bg-raised）
- [x] chat-header 右侧有产物面板开关按钮（常态可见），点击切换面板展开/收起；收起时面板完全隐藏、消息流占满宽
- [x] chat-header 右侧有侧栏开关按钮（常态可见），点击切换左侧栏展开/收起；收起时左侧栏完全隐藏、消息流左移占满宽
- [x] 产物面板收起后再展开，之前的 tab 与激活项保持
- [x] `npm run typecheck && npm run check:deps && npm test` 通过
- [ ] 冒烟：assistant 无气泡、用户气泡保持、两个开关均正常（需人工 dev 验证）
