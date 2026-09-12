# Checklist

- [x] 「专家·技能·连接器」页含专家/技能/连接器三 tab，专家为默认 tab
- [x] 专家 tab：搜索框本地过滤（name/displayName/profession/description/displayDescription），debounce + IME 守卫；搜索时分类行隐藏
- [x] 「专家 | 专家团」子 tab，专家团显示占位空态
- [x] 分类 chips 行：「全部」+ tags 聚合，选中过滤卡片，可横向滚动
- [x] 9 员 frontmatter 含 tags（恰好 3 个）；加载器数量不符抛错；listExperts 透传
- [x] 卡片：首字符彩色头像 + displayName + profession + 描述 2 行截断 + 3 个 tag chip；hover 浮现「使用」按钮
- [x] 点击卡片开详情弹窗（遮罩点击关闭）：大头像/名称/职称/完整描述/tags/quickPrompts/「使用专家」
- [x] 「使用专家」→ 选中并进新任务对话页（composer-bar chip 出现）；quickPrompt 路径把问题填入输入框
- [x] 我的专家：页内整页切换、顶栏「< 全部专家」；空态=图标+「还没有创建任何专家」+「创建专家」按钮；有用户级专家时显示网格+创建卡片
- [x] 「创建专家」→ 跳回主页，输入框已填引导语（不发送）
- [x] composer-bar 左区显示当前专家 chip（静态不可点），hover/focus 变 ×，点击取消选中回落 craft
- [x] chat-header 无专家 chip；ModeSwitch 无专家子菜单；「+」菜单专家子菜单底部有「更多专家…」
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
- [x] 对齐清单 E5/L13 行更新
