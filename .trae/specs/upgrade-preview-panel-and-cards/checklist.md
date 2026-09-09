# Checklist

- [x] 预览面板左缘有 4px 拖拽手柄，可拖拽调宽（clamp [340, 800]px），拖拽时 body cursor=col-resize
- [x] 预览面板头部有全屏按钮，点击后 absolute 覆盖主内容区；再次点击/Esc 退出；240ms ease 过渡；prefers-reduced-motion 禁用过渡
- [x] 产物卡区为两列网格（单产物独占一行）；HTML 卡右上角有 🌐 预览按钮，点击开面板不触发整卡点击
- [x] 卡区下方有「查看所有产物 (N)」「查看所有变更 (N)」文字按钮，点击开面板并展开概览菜单对应分组
- [x] 用户气泡 padding 8px 12px、字号 13px、行高 19px、max-width calc(100% - 32px)
- [x] assistant 消息无气泡（确认现状，不改动）
- [x] `npm run typecheck && npm run check:deps && npm test` 通过
- [ ] 冒烟：产物卡网格、🌐 按钮、聚合入口、面板拖拽、全屏切换、Esc 退出均正常（需人工 dev 验证）
