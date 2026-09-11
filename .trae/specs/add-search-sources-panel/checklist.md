# Checklist

- [x] web_search details 含结构化 results（title/url/description），与文本 content 同源
- [x] ToolCard.sources 在 live（tool_execution_end）与历史恢复（session-rebuild）两路径都被填充
- [x] URL 安全校验：仅公网 http(s)，凭据/localhost/内网 IP 剔除；缺 title/url 的项剔除
- [x] site 缺省时按 host 去 www. 前缀推导
- [x] 聚合纯函数：只取 web_search 卡（web_fetch 不计入），URL 去重、保留首次出现顺序
- [x] 「来源」按钮：与查看所有产物/变更同一行，无来源不渲染；头像组 ≤3 且按站点去重，favicon 加载失败回退 Globe 图标
- [x] 按钮 tooltip/aria-label 含来源计数
- [x] 面板头「引用来源 (N)」+ 关闭按钮；与 ArtifactPanel 同位互斥，面板未展开时点击先展开
- [x] 列表项：favicon 16px 圆形 + 站点名 + 标题单行截断 + 摘要两行截断（无摘要不渲染摘要行）
- [x] 点击列表项经 window.open → 主进程 openExternal 外部打开，应用内不导航
- [x] 切换会话时来源面板自动关闭
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
- [x] 对齐清单新增 L26 行并更新顶部计数
