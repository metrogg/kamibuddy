# 场景提示词强化交付驱动（让模型主动调用 present_files）Spec

## Why

上一轮修复让 present_files 真正出现在工具列表里（P0），但用户实测发现：**模型写完文件后不会主动交付，要等用户问"为什么没有交付产物"才补调用**。根因是提示词驱动不足——WorkBuddy 靠 `<agent_loop>` 8 步循环第 7 步（强制 present_files，加粗 IMPORTANT）+ `<result_presentation>` 独立交付纪律章节让交付成为行为收束的必经步骤；我们的 `resources/scenes/work/prompt.md` 只有一句软建议"任务完成时调用"，模型当成可选项。

## What Changes

- **场景提示词重写「交付」段**（`resources/scenes/work/prompt.md`）：从"软建议"升级为"执行循环必经步骤 + 交付纪律"——
  - 写入/编辑完成后、给出最终回复前，必须调用 present_files（唯一交付入口）
  - 明确"交付 ≠ 在回复里贴文件路径"——路径贴正文不是交付，用户看不到预览
  - 多文件合并一次调用；只交付最终成果；HTML 首项自动打开预览
  - 加粗强调（对齐 WorkBuddy 的 IMPORTANT 收束句式）
- **craft 模式提示词补交付衔接**（`resources/modes/craft.md`）：结尾补一句"产出文件后按场景提示词的交付段调用 present_files"（模式与场景的职责分工：场景管交付纪律，模式管行为约束，衔接点显式化）。
- **ask 模式不动**：问答模式没有写工具，不产生新文件，交付段不适用（保留 present_files 白名单仅供补交付历史产物，不加强制语义）。

## Impact

- Affected specs：产物交付提示词（present_files 触发时机）
- Affected code：
  - `resources/scenes/work/prompt.md`（「交付」段重写）
  - `resources/modes/craft.md`（结尾补衔接句）
- 不改代码、不改工具白名单、不改事件流——纯提示词层修复。

## ADDED Requirements

### Requirement: 场景提示词把交付定义为执行循环必经步骤

系统 SHALL 在场景提示词中明确规定：任何涉及写文件（write/edit）的任务，在给出最终回复前必须调用 `present_files` 交付产物。

#### Scenario: 模型写完文件后主动交付
- **WHEN** 用户在 craft 模式请求"做一个坦克大战小游戏"，模型调用 write 生成 HTML 文件
- **THEN** 模型在给出最终回复前主动调用 `present_files`（无需用户提醒），files 填该文件绝对路径，首个文件在右侧预览面板自动打开

#### Scenario: 交付与回复的先后次序
- **WHEN** 模型完成多步任务（先写文件再总结）
- **THEN** present_files 调用发生在最终回复之前；最终回复中可引用产物路径，但不得以贴路径替代交付

#### Scenario: 只交付最终成果
- **WHEN** 任务中间产生了草稿/临时文件，最终产出一个可用文件
- **THEN** present_files 的 files 只含最终成果文件，不含中间产物

### Requirement: 交付纪律在提示词中显式化

系统 SHALL 在场景提示词中写明交付纪律：present_files 是唯一交付入口；多文件合并一次调用；HTML 首项自动打开预览。

#### Scenario: 多文件合并一次调用
- **WHEN** 任务产出 3 个最终文件
- **THEN** 模型调用一次 `present_files`，files 含全部 3 个路径（按推荐观看顺序），而不是分 3 次调用

#### Scenario: HTML 首项自动打开预览
- **WHEN** 交付列表首项是 HTML 文件
- **THEN** 该文件在右侧预览面板自动打开（模型无需额外说明）

## MODIFIED Requirements

### Requirement: 场景提示词「交付」段

**原**：任务完成、已经产出可用文件时，调用 present_files 把成果交付给用户（软建议）。
**新**：写文件后必须交付——present_files 是执行循环的必经步骤，交付后用户才能在预览面板看到产物；在回复里贴路径不是交付。

## REMOVED Requirements

无。
