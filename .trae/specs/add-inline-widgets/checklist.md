# Checklist

- [x] resources/visualizer/ 五个指南模块为独立撰写（机制对齐、无 WorkBuddy 原文复制），read_me 按模块正确拼装（core+colors 恒含）
- [x] show_widget 硬校验五类全部实现且有测试：禁文档包裹标签 / 禁 *Storage / 禁 position:fixed / 禁 form / SVG 恰好一个且 viewBox 为 0 0 680 H
- [x] title 规范化（空格连字符转下划线、非法字符剔除、兜底 widget）与 loading_messages 1-4 条校验有测试
- [x] 工具结果结构：success 时含 title/widget_code/loading_messages/render_mode（svg|html 由内容推断），失败时 success:false + 中文原因
- [x] craft 与 ask 模式白名单含 read_me、show_widget（frontmatter 改动，零代码）；权限门登记只读
- [x] 用户会话与 run 会话注册真实工具；子代理会话不注册（注释写理由）
- [x] show_widget 在 STREAM_CARD_TOOLS：参数生成期卡片即上屏，loading_messages 轮播
- [x] widget 块以 sandbox="allow-scripts" iframe 渲染，srcDoc 带 CSP（default-src 'none' + CDN 白名单）；Chart.js 脚本在 finalize 后可执行
- [x] 高度自适应：iframe 内 ResizeObserver 上报、宿主 clamp 上限 2000px；主题切换 iframe 内跟随（至少媒体查询一路）
- [x] 流式期 update 剥 script、完成期 finalize 保留 script；部分 widget_code 可渐进渲染
- [x] 取数 result 优先、args 兜底；校验失败显示错误视图（红色标识 + 原因），内容缺失有提示
- [x] 标题栏含 title、复制代码、下载 {title}.html
- [x] 恢复历史会话后 widget 原位完整重放（同一转换管线，无独立存储）
- [x] npm run typecheck && npm run check:deps && npm test 全绿；smoke:session 回归通过
- [x] docs/workbuddy对齐清单.md C6 行更新状态并注明 v1 范围
