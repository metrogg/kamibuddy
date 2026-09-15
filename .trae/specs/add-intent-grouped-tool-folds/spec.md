# 工具调用按意图成组并折叠 Spec

## Why

WorkBuddy 执行任务时，**连续的工具调用会被聚合成带意图标题的可折叠组**：组头描述"实际做了什么"
（如「定位代码、运行校验：<pattern>」「查看 README.md」），组内是该批的具体调用（「已搜索文件 X」「已读取 Y」），
完成后自动收起。一屏过程既能看清在干什么，又不淹没结论。

我们**已经有分组、也有折叠**，但有两处不对（均已代码取证）：

1. **组头是计数摘要，不是意图标题** —— `summarizeToolRun`（`src/shared/metafold.ts`）产出
   「读取 2 个文件、写入 1 个文件」这类**类型计数**，**缺少 topic（主题）这一维**；
   WorkBuddy 的标题是 `{动词}：{topic}` 形态（topic 取自工具入参）。
2. **分组只在折叠段内部生效** —— `groupToolBatches`（`src/renderer/fold-view.ts`）的唯一调用点是
   `renderSegmentEntries`（仅服务 `turn-folded` / `process-fold`）；**进行中的轮全平铺**
   （`fold-view.ts` 的 streaming 分支直接返回全展开计划）。这正是用户截图里"逐条平铺"的来源。

> WorkBuddy 的取证（`docs/WorkBuddy-reference/extracted/renderer/assets/lib-chat-ui-ChIVprRk.js`）：
> `buildSegments`(~:227311) 把**连续 ≥2 个 foldable 单元**收成组、遇正文 flush；恰好 1 个则退化为平铺；
> `computeFoldSummary`(~:227287) + `TOOL_DESCRIPTORS`(~:226371) 用**模板**归纳组头（模型不参与）；
> `shouldFold = 其后出现过正文 || 整轮已结束`(~:227349)；折叠默认收起(~:227434)、
> 三个层级共用同一个折叠外壳(~:226316 块 id 注释)。

## What Changes

- **把工具分组前移到顶层渲染路径**：进行中的轮与顶层条目也按批次成组（不再只在折叠段内）
- **组头改为意图标题**：新增 topic 抽取（从工具入参取主题）+ 意图模板
  （单工具 `{动作} {主题}` / 同类 `{类别动词} {主题}` / 跨类 `{动词1}、{动词2}：{主题}`），
  替换现有的计数摘要
- **折叠时机对齐**：`shouldFold = 其后出现过正文 || 轮已结束`；**正在执行的尾批保持平铺**
- **展开时释放吸底跟随**（避免展开把回合头顶上去）
- **复用**既有 `SegmentFold` 外壳、`foldOpen` 状态与 `groupToolBatches` 骨架，**不新建折叠层**
- **不引入 `step` / 阶段概念**：WorkBuddy 的分组边界是"正文"，不是模型步骤；我们的事件流也没有该字段

## Impact

- Affected specs: `add-turn-fold-and-anchor`（分组能力的调用点与摘要语义扩展；轮折叠语义本身不变）
- Affected code:
  - `src/renderer/fold-view.ts`（分组前移、`shouldFold`）
  - `src/shared/metafold.ts`（意图标题替换计数摘要）
  - `src/renderer/chat-view.tsx`（顶层渲染路径接入分组、吸底释放）
  - `src/core/session-host.ts`（topic 所需的入参字段已在 `summarizeArgs` 同源处）

## ADDED Requirements

### Requirement: 连续工具调用聚合成意图组

系统 SHALL 把**连续 ≥2 个可折叠单元**（工具调用、纯思考）收成一个组；**正文（非空文本）是唯一断组边界**。

- 缓冲内**恰好 1 个**可折叠单元时 SHALL 不构成组（平铺为单条）
- 组内 SHALL 允许混合不同工具
- 豁免卡（`show_widget`、`todo_write` 等既有豁免）SHALL 不参与成组，位置保持不变
- 用户消息 SHALL 终止当前组（轮边界）

#### Scenario: 连续调用成组
- **WHEN** 一轮里有 `查看文件 → 搜索内容 → 读取文件` 三次连续工具调用，中间无正文
- **THEN** 三者收成一个组，渲染为一行组头，展开可见三次调用

#### Scenario: 正文断组
- **WHEN** 三次调用之后模型输出了一段正文，随后又调用两次工具
- **THEN** 形成两个组，中间隔着那段正文

#### Scenario: 单个调用不成组
- **WHEN** 一组缓冲内只有 1 个工具调用
- **THEN** 该调用按单条平铺渲染，不出现组头

### Requirement: 组头为意图标题

组头文案 SHALL 由**系统按工具名与入参归纳**（模型不参与生成），且 SHALL 包含主题（topic）而非仅计数。

- **主题来源优先级**：工具入参的对象字段（`pattern` / `path` / `query` / `command` 等）
  → 相邻正文的关键词 → 无（只用动词）
- **标题形态**：
  - 单个工具 → `{动作} {主题}`（如「查看 README.md」）
  - 同类别多工具 → `{类别动词} {主题}`（如「定位 *.py 相关代码」）
  - 跨类别多工具 → `{动词1}、{动词2}：{主题}`（如「定位代码、运行校验：x」）
- 正在执行的组 SHALL 加「正在」前缀
- 主题值 SHALL 做压缩：路径取 basename、超长截断
- 组头 SHALL 带主导工具的图标（复用既有 `FOLD_LEAD_ICONS`）

#### Scenario: 单工具标题
- **WHEN** 组内唯一/主导工具是读取 `README.md`
- **THEN** 组头显示「查看 README.md」（而非「读取 1 个文件」）

#### Scenario: 跨类别标题
- **WHEN** 组内既有搜索又有命令执行
- **THEN** 组头显示形如「定位代码、运行校验：<主题>」的复合标题

#### Scenario: 无主题时降级
- **WHEN** 组内工具入参取不到主题、相邻正文也提不出关键词
- **THEN** 组头只显示动词（不留悬空的冒号或分隔符）

### Requirement: 折叠时机

组 SHALL 在其**后续出现过正文**或**整轮已结束**时收起；**正在执行的尾批 SHALL 保持平铺**（不渲染组头）。

- 默认态 SHALL 为收起
- 用户手动展开后，在该组生命周期内 SHALL 保持展开（不因流式刷新被重置）
- 进入新轮 SHALL 重置为默认收起

#### Scenario: 完成后收起
- **WHEN** 一轮结束，其中某个组的后面出现过正文
- **THEN** 该组收起为一行组头，展开可回看具体调用

#### Scenario: 执行中平铺
- **WHEN** 一轮仍在进行，某组是当前最后一批且其后还没有正文
- **THEN** 该批保持平铺可见，不出现组头

#### Scenario: 手动展开不被重置
- **WHEN** 用户手动展开一个已收起的组，随后流式继续输出
- **THEN** 该组保持展开

### Requirement: 展开时释放吸底跟随

用户点击组头展开时，系统 SHALL 通知宿主释放"贴底跟随"，使内容向下增长而不是把回合头顶出视口。

#### Scenario: 贴底状态下展开
- **WHEN** 视口处于贴底跟随状态，用户点击某组组头展开
- **THEN** 释放跟随，展开的内容向视口下方增长，组头位置稳定

## MODIFIED Requirements

### Requirement: 轮折叠与锚点（`add-turn-fold-and-anchor`）

轮折叠的**语义与作用范围不变**（首锚点之前的 foldable 收进「已完成 Xs」；锚点之间/末锚点之后的 foldable 收进「过程消息」）。

**扩展**：折叠段内部的批次 SHALL 使用本 spec 的**意图标题**与折叠时机；
轮折叠与工具组折叠 SHALL 共存为两个层级（轮折叠 > 工具组），共用同一个折叠外壳。

## 明确不做

- **40 个工具 canonical 全表与 6 级决策优先级**：只做常见类别（读取 / 搜索 / 命令 / 写入），
  边缘分支（`categoryCount`、`fallback` 等）按降级处理
- **中英双语模板**：项目当前无 i18n 框架，沿用既有"中文硬编码集中在词汇表"的做法
- **展开预算**（`EXPAND_MAX_CHARS` / 「显示更早的 N 条」）：WorkBuddy 旧实现的性能保护，本期不做
- **引入 `step` / 阶段事件**：见 What Changes 末条
