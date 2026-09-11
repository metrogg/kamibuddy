# 专家体系（expert 模式 + 人格注入 + 预设专家库）Spec

## Why

对齐清单 E5：WorkBuddy 的专家 = 交互轴第四模式 + PluginAgentPrompt 人格注入
（"主提示是通用 OS，专家 = OS + 人格 APP"），配官方预设专家库。
KamiBuddy 已有双轴骨架、agents 加载器、task 委派——缺的是**主会话级专家**：
选一个专家，整个会话以该专家的身份、方法论与输出规范工作。
用户拍板：专家团（Teams/主理人）先不做；预设模板先照搬 WorkBuddy 内置专家，后续定制。

## What Changes

1. **专家数据层**（能力是数据 §3）：
   - `resources/experts/*.md`：frontmatter 对齐 WorkBuddy agent-md-spec
     （name=文件名 / description / displayName / profession / 无 tools 字段——
     工具面由模式统一分配）；正文结构：角色/核心能力/工作流程/输出规范/注意事项
   - 首批 6 员**照搬 WorkBuddy 内置专家正文**（用户明确授权，临时方案后续定制）：
     work-report（工作周报）、legal-contract（法律合同）、academic-paper（学术论文）、
     business-copy（商业文案）、general-writer（通用写作）、tech-blog（技术博客）——
     从 tencent-docx/experts/ 的 SKILL.md 转为 experts 格式（保留正文知识，
     包装成角色/能力/流程/规范结构；每文件头注标注「预设照搬自 WorkBuddy 内置专家，
     待定制替换」）；stock-research 与 poetry-prose 不搬（JD 对口度低）
   - `core/experts.ts` 加载器（与 agents.ts 同族：内置目录必读 + 用户级
     `~/.kamibuddy/experts/` 同名覆盖 + 校验从紧）
2. **expert 交互模式**（第四模式）：
   - `resources/modes/expert.md`：tools = craft 同款全工具面；正文片段自创
     （专家行为准则：以当前专家身份工作、交付走 present_files、工作留痕）
   - `SessionState` 加 `expertId?: string`；`INVOKE.setExpert(id | undefined)`
     ——切专家是单入口（选专家即进 expert 模式；切走其他模式清 expertId）
   - prompt-composer：expert 模式分支——注入 = 通用骨架 + expert 片段 +
     **专家正文人格段**（PluginAgentPrompt 等价物）+ 每轮 user-context 钉住
     `<current-expert>`（WorkBuddy 同款防漂移）；expert 模式下场景轴不参与
     compose（注释说明，v2 再定）
   - 专家 frontmatter 的 skills 预加载 v1 不做（spec 声明）
3. **renderer**：
   - 模式切换器（ModeSwitch 与 PlusMenu 模式▸ 同源菜单）加「专家 ▸」子菜单：
     列出专家（displayName + profession），选中即 setExpert
   - 对话头部显示当前专家（displayName）；无专家时 expert 模式不可达
     （菜单只列具体专家，不裸列「专家」模式）
4. **权限与 run 会话**：expert 只是提示词与模式组合，权限门无新登记；
   automation 任务保持 work+craft 不起专家（专家选择是会话级 UI 状态）

**明确不做**：专家团（主理人/Teams/SendMessage）、专家市场与安装、
expert-manager CRUD 技能、头像、skills 预加载、专家独立模型、
stock-research 与 poetry-prose 两员、expert 模式下的场景轴联动。

## Impact

- Affected specs：与 add-subagent-task-tool（agents 加载器同族）、
  add-plan-mode-and-plus-menu（模式切换器）衔接；专家团是后续 spec
- Affected code：
  - `resources/experts/*.md` ×6（新）、`src/core/experts.ts`（新 + 测试）
  - `resources/modes/expert.md`（新）、`src/core/prompt-composer.ts`（expert 分支）
  - `src/shared/session-events.ts`（SessionState.expertId）、`src/shared/ipc.ts`
    （INVOKE.setExpert）、`src/daemon/index.ts`（接线）、`src/core/session-host.ts`
  - `src/renderer/model-menu.tsx`（或 ModeSwitch 所在组件）/ `plus-menu.tsx` /
    `chat-view.tsx`（头部专家显示）

## ADDED Requirements

### Requirement: 专家定义与加载

系统 SHALL 从 `resources/experts/`（内置）与 `~/.kamibuddy/experts/`（用户级）加载
专家定义（frontmatter：name/description/displayName/profession；正文角色结构），
用户级同名覆盖内置；缺字段响亮抛错。内置首批 6 员（工作周报/法律合同/学术论文/
商业文案/通用写作/技术博客），文件头标注预设来源与待定制状态。

#### Scenario: 用户覆盖预设
- **WHEN** 用户在 `~/.kamibuddy/experts/work-report.md` 放同名文件
- **THEN** 选择「工作周报」专家时使用用户版正文

### Requirement: 专家选择与人格注入

系统 SHALL 在模式菜单提供「专家 ▸」子菜单（列出全部专家）；选中后该会话进入
expert 模式且 `expertId` 落 session state；系统提示词注入该专家正文人格段，
且每轮 user-context 钉住当前专家（防多轮后漂移）；切换到 craft/ask/plan 时
清除 expertId；新会话默认无专家（craft）。

#### Scenario: 以周报专家身份工作
- **WHEN** 用户在模式菜单选「专家 ▸ 工作周报」，说「帮我把这周的工作整理成周报」
- **THEN** 会话头部显示当前专家，回复以周报专家的方法论与输出规范执行，
  交付走 present_files；后续轮次仍保持该专家身份

### Requirement: expert 模式工具面

expert 模式 SHALL 使用与 craft 相同的工具白名单（全工具面含 task/questionnaire/
powershell）；expert 模式必须绑定 expertId（无专家不可达）。

#### Scenario: 专家使用委派
- **WHEN** 专家会话中模型判断需要并行调研
- **THEN** 可调用 task 工具派子代理（与 craft 同能力）

## MODIFIED Requirements

### Requirement: 交互模式集合

**原**：craft/ask/plan 三模式。**新**：增加 expert 第四模式（绑定 expertId 使用），
模式菜单 = 三模式 + 「专家 ▸」子菜单。

## REMOVED Requirements

无。
