# 专家市场页与对话页专家入口对齐 WorkBuddy Spec

## Why

专家功能的使用体验不对味：① 侧栏「专家·技能·连接器」打开的只有技能/连接器两个 tab，
**没有专家页**——WorkBuddy 是专家/技能/连接器三 tab，专家为首tab，含搜索、分类、
卡片网格、详情弹窗、我的专家（创建跳转主页预填引导语）；② 对话页选中专家后，
我们把「专家：xxx」chip 放在了头部右上角——WorkBuddy 是在**输入框底栏**
（默认权限旁）放一个静态 chip（hover 变 × 取消），选择入口统一在「+」菜单，
两套逻辑混着会乱。

## What Changes

- **专家页**（skills-view 加「专家」首 tab 并设为默认，WorkBuddy 的 ExpertCenterPage 同构）：
  - 顶栏：搜索框「搜索专家职称或描述」（本地过滤 name/displayName/profession/
    description/displayDescription，200ms debounce + IME 守卫；搜索时分类行隐藏）+
    右侧「我的专家」按钮；**不做精选场景**（用户明确不要）
  - 「专家 | 专家团」子 tab：专家团为占位空态（「专家团即将上线」）
  - 分类 chips 行：「全部」+ 从专家 tags 聚合的分类（WorkBuddy 分类是服务端下发，
    本地等价物就是 tags 聚合），选中过滤卡片，可横向滚动
  - 专家卡片网格：首字符彩色头像（WorkBuddy 头像缺失时的首字母 fallback 同款）+
    displayName + profession 副标题 + displayDescription（2 行截断）+ 3 个 tag chips；
    hover 右上浮现「使用」按钮；点击卡片开**详情弹窗**
  - 详情弹窗：大头像 + displayName/profession + 完整描述 + tags + quickPrompts
    「专家帮你做」（点击=带该问题开始使用）+「使用专家」主按钮
    （选中该专家并进入新任务对话页）
  - 「我的专家」子页（页内整页切换，顶栏变「< 全部专家」）：空态 = 学士帽图标 +
    「还没有创建任何专家」+「创建专家」按钮；有用户级专家（~/.kamibuddy/experts/）
    时显示卡片网格 + 末尾「创建专家」卡片；「创建专家」点击 → 跳回主页并把
    引导语填入输入框（自写：「帮我创建一个 XXX 专家，擅长 XXXXX。我的经验是：
    [请补充你的行业背景、相关经验]」）
- **专家定义补 tags**：9 员 frontmatter 各加 `tags`（恰好 3 个关键词），
  加载器校验同步（必须 3 个），listExperts 链路透传
- **对话页入口归一**：
  - composer-bar 左区（默认权限旁）新增当前专家 chip：首字符头像 + 名称；
    静态不可点（role=status），hover/focus 时头像原位变 ×，点击取消选中
    （setExpert 清空，回落 craft）
  - **移除** chat-header 的「专家：xxx」chip（右上角那套）
  - **移除** ModeSwitch 里的专家子菜单——选择入口统一为「+」菜单
  - 「+」菜单专家子菜单底部加「更多专家…」→ 跳转专家页
- **明确不做**：专家团（占位 tab 之外的一切）、精选场景、运营排序（综合/最热/最新，
  无使用计数数据）、expert-manager 技能 chip（创建只用预填文本引导）、
  专家头像图片（用首字符彩色 fallback）、卡片入场阶梯动画

## Impact

- Affected specs: 对齐清单 E5、L13（技能与专家页）
- Affected code:
  - `resources/experts/*.md`（9 员补 tags）、`src/core/experts.ts`（校验）+ 测试
  - `src/shared/ipc.ts` / `src/daemon/index.ts`（tags 透传）
  - `src/renderer/skills-view.tsx`（专家 tab 默认 + 页架）、
    新增 `src/renderer/experts-view.tsx`（市场页 + 详情弹窗 + 我的专家子页）
  - `src/renderer/chat-view.tsx`（composer-bar chip、移除头部 chip 与 ModeSwitch 子菜单）
  - `src/renderer/composer.tsx`（chip 放置位）、`src/renderer/plus-menu.tsx`（更多专家入口）
  - `src/renderer/App.tsx`（创建专家跳主页预填、专家页与选择专家的状态接线）
  - `src/renderer/index.css`

## ADDED Requirements

### Requirement: 专家市场页

侧栏「专家·技能·连接器」打开的页面 SHALL 含 专家/技能/连接器 三个 tab，
**专家为默认 tab**。专家 tab SHALL 提供：搜索框（本地五字段过滤、debounce、
IME 守卫、搜索时隐藏分类行）、「我的专家」入口、「专家|专家团（占位）」子 tab、
tags 聚合的分类 chips 行（全部 + 各 tag，选中过滤）、专家卡片网格
（首字符彩色头像 + displayName + profession + 两行描述 + 3 个 tag chip）。

#### Scenario: 打开专家页

- **WHEN** 用户点击侧栏「专家·技能·连接器」
- **THEN** 默认进入专家 tab，看到 9 张内置专家卡片与分类行

#### Scenario: 搜索过滤

- **WHEN** 在搜索框输入「合同」
- **THEN** 分类行隐藏，卡片过滤为命中的专家（legal-contract）

### Requirement: 专家详情弹窗与启用

点击专家卡片 SHALL 打开详情弹窗（遮罩 + 520px 内卡片）：大头像、名称/职称、
完整描述、tags、quickPrompts 列表、「使用专家」主按钮；点「使用专家」或某个
quickPrompt 后选中该专家并进入新任务对话页（quickPrompt 路径把该问题填入输入框）。

#### Scenario: 从弹窗启用

- **WHEN** 在详情弹窗点「使用专家」
- **THEN** 进入新任务对话页，composer-bar 显示该专家 chip

### Requirement: 我的专家与创建引导

「我的专家」子页 SHALL 在整页内切换（顶栏「< 全部专家」返回）：无用户级专家时
显示空态（图标 + 「还没有创建任何专家」+「创建专家」按钮）；有时显示卡片网格
+ 末尾创建卡片。「创建专家」点击 SHALL 跳回主页并把引导语填入输入框（不发送）。

#### Scenario: 创建专家

- **WHEN** 在我的专家页点「创建专家」
- **THEN** 回到主页，输入框已填引导语文本待编辑发送

### Requirement: 对话页专家 chip 归位

选中专家后，当前专家 chip SHALL 显示在 composer-bar 左区（默认权限旁）：
首字符头像 + 名称；chip 静态不可点，hover/focus 时头像原位变 ×，点击取消选中
（回落 craft）。chat-header 的专家 chip 与 ModeSwitch 的专家子菜单 SHALL 移除；
「+」菜单专家子菜单保留并在底部加「更多专家…」入口跳转专家页。

#### Scenario: 取消专家

- **WHEN** hover 底栏专家 chip 并点击 ×
- **THEN** chip 消失，会话回落 craft 模式

#### Scenario: 入口唯一性

- **WHEN** 查看对话页头部与 ModeSwitch
- **THEN** 头部无专家 chip，ModeSwitch 无专家子菜单；选择入口仅「+」菜单与专家页

## MODIFIED Requirements

### Requirement: 专家·技能·连接器页结构

原「技能/连接器两 tab、默认技能」改为「专家/技能/连接器三 tab、默认专家」。

## REMOVED Requirements

### Requirement: 头部专家 chip 与 ModeSwitch 专家子菜单

**Reason**: 与 WorkBuddy 入口逻辑不一致（选择只走「+」菜单，当前专家只在底栏
静态 chip），两套并存会乱（用户明确要求移除）。
**Migration**: 选择入口保留「+」菜单专家子菜单与专家页；当前专家显示移至 composer-bar。
