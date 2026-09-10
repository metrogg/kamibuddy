# 推理强度（Thinking Level）Spec

## Why

pi 原生支持推理强度（`session.setThinkingLevel`，off/minimal/low/medium/high/xhigh/max，
按模型能力自动裁剪，逐会话持久化、resume 自动还原），KamiBuddy 一直没有暴露：
用户调不了推理强度，也没有 WorkBuddy 的「全局默认兜底 + 会话内模型菜单快捷切换」
（用户指定的方案 B）体验。

## What Changes

- **宿主层**：`SessionHost.create` 接受 `thinkingLevel`；新增 `setThinkingLevel` 方法与
  `thinking_level_select` 事件桥接；宿主权威状态（`SessionState`）携带当前档位与
  当前模型的可用档位列表。
- **契约层**：`SessionState` 增加 `thinkingLevel` 与 `availableThinkingLevels`；
  新增 `INVOKE.setThinkingLevel` 通道（作用于当前会话桶）；偏好文件增加
  `thinkingLevel` 全局默认键。
- **daemon**：createHost 注入全局默认（`preferences.thinkingLevel`）；setThinkingLevel
  handler 落在当前桶宿主上（pi 负责逐会话持久化与 resume 还原，我们不做第二份持久化）；
  automation-runner 与 subagent-runner 建会话同口径注入全局默认。
- **模型目录**：自定义服务商模型的 `thinkingLevelMap` 透传给 pi（否则自定义推理模型
  档位恒被裁成 off）；目录快照暴露各模型可用档位。
- **UI**：模型菜单（首页与对话页同一组件）pill 显示「模型名 + 档位」；弹层加
  「推理强度」行，点击展开档位子菜单（只列当前模型可用档位）；非推理模型不显示
  档位行与 pill 档位后缀。设置页增加「默认推理强度」下拉（全局兜底，影响之后
  新建的会话；既有会话以各自会话内选择为准，不被全局改动回溯）。
- 档位中文标签映射集中一处（适配层常量，同工具卡片 label 先例）：off=关 /
  minimal=极低 / low=低 / medium=中 / high=高 / xhigh=极高 / max=最大。

## Impact

- Affected specs: support-concurrent-tasks（档位按桶可见）、add-subagent-task-tool
  （子代理建会话注入默认档，不做每子代理独立档位——方案 C 明确不做）
- Affected code: `core/session-host.ts`、`core/model-catalog.ts`、`daemon/index.ts`、
  `daemon/automation-runner.ts`、`daemon/subagent-runner.ts`、`shared/session-events.ts`、
  `shared/ipc.ts`、`shared/bridge.ts`、`preload/index.ts`、`renderer/model-menu.tsx`、
  `renderer/settings-view.tsx`

## ADDED Requirements

### Requirement: 会话内推理强度切换

The system SHALL 在模型菜单里提供当前会话的推理强度切换，只列出当前模型支持的档位；
切换经 pi `setThinkingLevel` 生效并逐会话持久化（resume 后还原，无需自研持久化）。
多任务并发下档位按会话桶独立，A 会话的切换不影响 B 会话。

#### Scenario: 切换档位

- **WHEN** 用户在模型菜单弹层打开「推理强度」子菜单并选择「高」
- **THEN** 当前会话宿主 `setThinkingLevel("high")` 生效，pill 显示「模型名 高」，
  后续该会话的 run 按高档位推理；切走再切回、或重启后 resume，该会话仍是「高」

#### Scenario: 非推理模型

- **WHEN** 当前模型不支持推理（pi 裁剪后可用档位仅 off）
- **THEN** pill 不显示档位后缀，弹层不出现「推理强度」行

### Requirement: 全局默认推理强度

The system SHALL 在设置页提供「默认推理强度」下拉（可选档位为 pi 全量七档），
写入偏好文件；之后新建的会话（含定时任务 run 会话、子代理会话）以该值为初始档位；
既有会话不回溯修改。

#### Scenario: 设置全局默认

- **WHEN** 用户在设置页把默认推理强度改为「中」并新建任务发消息
- **THEN** 新会话以 medium 起步；此前已存在的会话档位不变

### Requirement: 自定义模型能力透传

The system SHALL 把自定义服务商模型在 models.json 中声明的 `thinkingLevelMap`
原样透传给 pi 的模型定义，使自定义推理模型获得与内置模型一致的档位裁剪行为。

#### Scenario: 自定义推理模型

- **WHEN** 用户在自定义服务商的 models.json 模型条目里声明 `thinkingLevelMap`
  （如 `{ "high": "high", "max": "max" }`）并选中该模型
- **THEN** 模型菜单的「推理强度」子菜单恰好列出 high 与 max 两档（含档位标签），
  选择后 pi 按映射值下发请求
