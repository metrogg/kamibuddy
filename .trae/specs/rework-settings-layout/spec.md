# 设置页重构（WB 式左 nav 布局 + 个性化功能 + 添加模型弹层）Spec

## Why

设置项全平铺在一页（9 个分区纵列），随功能增加已不可用。WorkBuddy 的设置是
模态卡 + 左 nav 分组 + 右内容面板，且其「个性化」页有一组我们没做的功能
（自定义指令/称呼与身份/人设描述/欢迎语/变更详情）——底层已实证：
自定义指令是独立 prompt 段（`always_applied_user_rules`，tar.js:72212，
first_turn 用户段），人设是 SOUL.md 文件体系（我们做轻量字段版）。
自定义模型目前平铺全部服务商，应改为「添加模型」弹层里先选供应商（或自定义）。

## What Changes

- **布局重构**：设置页改为模态卡（居中 ~880px + 背板 + 关闭 X/Esc），左 nav
  （通用 / 个性化 / 记忆与进化 / 模型 / 提示词预览 / 关于）+ 右滚动内容；
  现有 9 个分区归位：通用（默认推理强度、联网搜索、默认存储路径、权限）、
  记忆与进化（现有记忆分区 + 长期记忆编辑）、模型（当前模型、自定义模型、
  服务商 Key）、提示词预览、关于（版本 + 诊断入口）。settings-view.tsx 拆为
  per-section 组件文件（settings/ 目录），消除单文件竞态
- **个性化页**（新功能，preferences 持久化 + compose 注入）：
  - 回复风格（现有挪入）
  - **自定义指令**：textarea ≤1500 字，注入为独立「用户规则」段
    （对齐 WB always_applied_user_rules 语义：用户设定、酌情遵循），空不注
  - **称呼与身份**：对你的称呼（userNickname）、AI 的名字（assistantName，
    默认品牌名）、人设/人格描述（personaDescription，默认空）——
    有值才注入对应行；人设是 WB SOUL.md 的轻量字段版（明确不建文件体系）
  - **加载欢迎语** toggle：会话载入/首轮等待慢时显示一句问候（自创若干条轮换），
    默认开
  - **展示文件变更过程详情** toggle：write/edit 卡「生成中」是否实时展示
    增删计数与详情（现状行为=开，默认开）
- **记忆与进化页**：现有记忆分区（生成对话记忆 toggle + 画像 重置/编辑/导入）
  + **长期记忆记录**编辑（直接编辑 ~/.kamibuddy/MEMORY.md，复用画像编辑的
  IPC 模式，新增 getMemory/setMemory 通道）
- **添加模型弹层**：模型页不再平铺全部服务商；已配置 Key 的服务商保留管理
  （编辑/删 Key）；「添加模型」按钮开弹层——第一步选供应商（下拉/列表：
  全部预置服务商 + 「自定义（OpenAI 兼容）」），选预置→填 Key（若该服务商
  未配）+ 模型 ID/显示名/上下文/输出上限；选自定义→填 baseUrl + Key + 模型
  字段全套。保存即入库并可选中

**明确不做**：WB 的套餐积分/个人主页/快捷键/外观/数据管理/应用管理/安全中心
（无对应功能）；SOUL/BOOTSTRAP 身份文件体系（人设只做字段注入）；
快捷键系统；外观主题（深色）。

## Impact

- Affected specs：补全 add-reply-styles（风格挪位）、add-memory-system（记忆页扩容）
- Affected code：`src/renderer/settings-view.tsx`（拆分为 settings/ 目录）、
  `src/core/preferences.ts`（6 个新字段）、`src/core/prompt-composer.ts`
  （个性化注入段）、`src/daemon/index.ts`（personalization + memory IPC）、
  `src/shared/ipc.ts`、`src/renderer/chat-view.tsx`（欢迎语、变更详情 toggle）

## ADDED Requirements

### Requirement: 设置页左 nav 布局

设置 SHALL 以模态卡呈现：左 nav 分组（通用/个性化/记忆与进化/模型/提示词预览/
关于），右侧只显示当前分组内容；Esc/背板/X 关闭回到来源页。

#### Scenario: 分组导航
- **WHEN** 用户打开设置并点击左 nav「模型」
- **THEN** 右侧只显示模型相关分区（当前模型、自定义模型、服务商 Key），
  其他分区分文不见

### Requirement: 个性化注入

preferences 的 customInstructions/userNickname/assistantName/personaDescription
SHALL 经 prompt-composer 注入系统提示（用户规则独立成段、称呼/名字/人设成行），
全空零 token；自定义指令上限 1500 字。

#### Scenario: 自定义指令生效
- **WHEN** 用户在个性化页写「回答先给结论再展开」并保存，开启新会话提问
- **THEN** 系统提示含用户规则段且模型遵循该指令

### Requirement: 添加模型弹层

模型页 SHALL 只列已配置内容；「添加模型」开弹层：先选供应商（预置列表 +
自定义 OpenAI 兼容），再按选择呈现对应字段（预置=Key+模型字段；
自定义=baseUrl+Key+模型字段），保存入库。

#### Scenario: 自定义供应商接入
- **WHEN** 用户在弹层选「自定义」并填入 baseUrl/Key/模型 ID 保存
- **THEN** 模型出现在清单且可被切换使用

## MODIFIED Requirements

### Requirement: 记忆管理

原「记忆」分区从平铺页挪入「记忆与进化」分组，并增加长期记忆记录
（~/.kamibuddy/MEMORY.md）的查看与编辑（复用画像 IPC 模式新增 get/setMemory 通道）。

## REMOVED Requirements

### Requirement: 服务商平铺

**Reason**：全部服务商连 Key 输入框平铺在设置页，信息密度过高且绝大多数用户
只用 1-2 家。
**Migration**：已配置 Key 的服务商保留在模型页管理；未配置的只在添加模型弹层的
供应商列表中出现；已存 preferences 的 Key 数据不受影响。
