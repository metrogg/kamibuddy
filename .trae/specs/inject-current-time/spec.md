# 注入当前时间上下文 Spec

## Why

用户实测：问「现在几点了」，WorkBuddy 精确回答（2026年9月9日 周三 23:18 GMT+8），
KamiBuddy 答「没有读取系统时钟的工具」。根因不是缺工具——WorkBuddy 在系统提示词
`<env>` 块注入 `Today's date`（product.json 模板实证）；而 pi 本身不注入任何时间，
我们的 prompt-composer 槽位（interaction/skills/cwd/model）也没有时间上下文，
且 prompt-switch 每轮整体替换 systemPrompt，模型对时间零感知。

## What Changes

**A. 运行时环境块注入（每轮新鲜）**
- `composePrompt` 组装的 systemPrompt 末尾追加运行时环境块：
  当前本地时间（**分钟级**）+ 星期 + 时区名（IANA）+ GMT 偏移
- prompt-switch 的 before_agent_start 每轮重组 → 每个新 run 都拿到当下时间，
  长会话隔夜不漂移
- `ComposePromptInput` 加可注入的 `now?: Date`（默认 `new Date()`）——
  纯函数可测：固定 now 断言输出

**B. 格式与缓存考量**
- 格式示例（文字自创）：`Current time: 2026-09-09 23:18 (Wednesday, GMT+8, Asia/Shanghai)`
- **分钟级而非秒级**：run 内连续模型调用通常同分钟，systemPrompt 不变则不炸
  provider 提示词缓存；秒级会每轮炸缓存。取舍写进注释

## Impact

- Affected specs：提示词组装（prompt-composer / prompt-switch）
- Affected code：
  - `src/core/prompt-composer.ts`（环境块追加 + now 入参 + 格式化函数）
  - `src/core/prompt-composer.test.ts`（新用例）
  - `src/core/session-host.ts`（compose 调用处确认 now 传递——若 composer 内默认
    `new Date()` 则可能零改动）

## 范围外（明确不做）

- 用户名 / 画像注入（WorkBuddy 知道「振东」——我们没有画像系统，YAGNI，
  将来做记忆 T5 时再议）
- cwd / platform / OS 版本等其余 env 字段（cwd 已有 {{cwd}} 槽位；
  其余字段模型用不上，不凑 WorkBuddy 的清单）

## ADDED Requirements

### Requirement: 当前时间注入

系统 SHALL 在每个 agent run 的 systemPrompt 末尾包含运行时环境块：
本地当前时间（分钟级）+ 星期 + IANA 时区名 + GMT 偏移；
每个新 run 取注入当下时间（非会话创建时固化）。

#### Scenario: 问当前时间
- **WHEN** 用户问「现在几点了」
- **THEN** 模型能答出当前本地时间（含日期、星期、时分与时区），
  不再回复「没有读取系统时钟的工具」

#### Scenario: 隔夜会话
- **WHEN** 昨天创建的会话今天继续对话（新 run）
- **THEN** 该轮 systemPrompt 的环境块是今天的时间（before_agent_start 每轮重组）

#### Scenario: 缓存友好
- **WHEN** 同一 run 内一分钟内的连续模型调用
- **THEN** systemPrompt 字节一致（分钟级精度），不炸 provider 提示词缓存

## MODIFIED Requirements

无。

## REMOVED Requirements

无。
