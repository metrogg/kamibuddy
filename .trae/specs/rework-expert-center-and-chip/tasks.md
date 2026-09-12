# Tasks

- [x] Task 1: 专家定义补 tags（数据层）
  - [x] SubTask 1.1: 9 员 frontmatter 各加 `tags`（恰好 3 个关键词，卡片 chip 与分类行数据源）
  - [x] SubTask 1.2: `src/core/experts.ts` 校验同步（必须恰好 3 个字符串）+ 测试；
        listExperts 链路（shared/daemon）透传 tags
- [x] Task 2: 专家市场页（experts-view + skills-view 页架）
  - [x] SubTask 2.1: skills-view 加「专家」首 tab 并默认选中（专家/技能/连接器 三 tab）
  - [x] SubTask 2.2: 新增 `experts-view.tsx`：顶栏（搜索框 + 我的专家按钮）、
        「专家|专家团（占位）」子 tab、tags 聚合分类 chips 行（全部+过滤、横滑）、
        卡片网格（首字符彩色头像/displayName/profession/两行描述/3 tags/hover 使用按钮）
  - [x] SubTask 2.3: 详情弹窗（遮罩+卡片：大头像/名称职称/完整描述/tags/quickPrompts/
        「使用专家」；启用=选中+进新任务对话页，quickPrompt 路径填入输入框）
  - [x] SubTask 2.4: 「我的专家」子页（页内切换、顶栏「< 全部专家」、空态学士帽+
        创建按钮、有用户专家时网格+创建卡片）；创建专家→跳主页预填引导语
  - [x] SubTask 2.5: CSS（对齐 WorkBuddy ec-* 浅色规格：卡片 16px 圆角 padding 16/20、
        头像 36 圆、描述 2 行截断、tag chip 灰底、弹窗 520px 圆角 16）
- [x] Task 3: 对话页入口归一
  - [x] SubTask 3.1: composer-bar 左区加当前专家 chip（首字符头像+名称、静态、
        hover 变 × 取消选中回落 craft）+ CSS
  - [x] SubTask 3.2: 移除 chat-header「专家：xxx」chip、移除 ModeSwitch 专家子菜单；
        「+」菜单专家子菜单底部加「更多专家…」跳专家页
- [x] Task 4: 收尾验证
  - [x] SubTask 4.1: `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] SubTask 4.2: 对齐清单 E5/L13 行更新

# Task Dependencies

- Task 2 依赖 Task 1（页面消费 tags）
- Task 3 与 Task 1/2 无强依赖（chip 用 displayName），可并行
- Task 4 依赖全部
