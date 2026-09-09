# present_files 工具注册与产物交付/预览链路修复 Spec

## Why

`present_files` 已注册进 pi 扩展，但从未被加进任何交互模式的工具白名单（`resources/modes/ask.md` 与 `craft.md` 的 `tools` 数组都没有它），而会话工具集完全由模式 frontmatter 决定（`session-host.ts:421-426` 初始 `tools: [...mode.tools]`、`setInteraction` 的 `setActiveToolsByName([...mode.tools])`）。白名单语义是"未列出即禁用"——所以**模型在真实会话里根本看不到 present_files**，尽管场景提示词（`resources/scenes/work/prompt.md:20`）教它交付时要调用。这就是用户实测里"交付没发生、模型只能把文件路径贴在正文里"的根因。同时分类/结果/预览/URL 链路还有一串对齐缺口（missing 警告误报、previewed 虚假承诺、URL 产物死路、工作区内交付 HTML 预览依赖 main 窗口 CSP 放行等）。

## What Changes

- **P0（核心修复）**：把 `present_files` 加入 craft 与 ask 两个模式的 `tools` 白名单。只读工具，两模式都给（产物可能来自上一轮 craft，ask 里也应能补交付）；问/答模式的约束靠"不注册 write/edit"维持，不受 present_files 影响。**BREAKING**：`resources/modes/*.md` frontmatter 变更。
- **P1**：`sizeOf` 从三态坍塌修成三态显式（`outside` / `missing` / number）——只有"stat 失败"（工作区内、目标不存在/不可读）才进 `missing` 警告；playground 与区外路径不探测、不警告、结果不误导。`PresentedFile.size` 语义不变（number，不探测/URL 为 0），区分逻辑在扩展层。
- **P2**：结果 JSON 的 `previewed` 字段与 `message` 不再虚假承诺"已在预览面板打开"。实际打开是渲染进程异步行为（`App.tsx` 监听 `artifacts_presented`），工具无法预知成功——`previewed` 只回真实给定的 `focusFile`（或留空语义），`message` 改为"已交付"中性表述。
- **P3**：URL 产物在预览面板走外部打开（`openExternal`），不再被误当本地文件送进 `readArtifact`/静态服务。面板区分 URL 与本地路径两类产物卡。
- **P4**：工作区内交付 HTML 的预览路径确认通畅——确认 main 窗口 CSP 的 `frame-src`/`child-src`/`default-src` 放行 `http://127.0.0.1:*`（静态服务就绑 127.0.0.1 随机端口，iframe `src` 即此域）。若已配置则仅留回归测试断言，不改代码。
- **附带**：`file://` URI 与 `javascript:`/`data:` 的口径与"整单报错"语义在文档/测试里显式化（当前行为正确：不匹配 HTTP/绝对路径 → invalid → 整单报错，无需改代码）。

## Impact

- Affected specs：产物交付（present_files）、产物预览面板、交互模式工具白名单
- Affected code：
  - `resources/modes/ask.md`、`resources/modes/craft.md`（frontmatter tools 白名单）
  - `src/extensions/present-files.ts`（sizeOf 三态、missing 口径、结果 message/previewed）
  - `src/shared/artifacts.ts`（`classifyPresentedFiles` 签名/分类、测试）
  - `src/renderer/artifact-panel.tsx`（URL 产物外部打开分支）
  - `src/renderer/chat-view.tsx`（产物卡：URL 与本地文件两类）
  - `src/main/index.ts`（CSP 确认，可能零改动）
  - `src/extensions/present-files.test.ts`（如有）、`src/shared/artifacts.test.ts`（回归）

## ADDED Requirements

### Requirement: present_files 在创作模式可被模型调用

系统 SHALL 在 craft 模式的工具白名单中包含 `present_files`，使模型在任务完成时能显式交付产物。

#### Scenario: 模型调用交付工具
- **WHEN** 用户在 craft 模式完成任务，模型产出可用文件并调用 `present_files`
- **THEN** 工具正常执行（不抛"未知工具"），daemon 收到 `artifacts_presented` 事件，UI 产物清单出现该文件，首个本地文件在右侧预览面板自动打开

#### Scenario: 问答模式也可交付
- **WHEN** 用户在 ask 模式，模型调用 `present_files`
- **THEN** 工具正常执行（它是只读工具，不改变任何状态），产物正常进清单

#### Scenario: 工具白名单不含 present_files 时（回归断言）
- **WHEN** 检查 craft 与 ask 的 frontmatter
- **THEN** `tools` 数组必须含 `present_files`（防未来重构时再次漏挂）

### Requirement: present_files 结果不再误导模型（missing 警告只报真实失败）

系统 SHALL 只对"在工作区内但 stat 失败（不存在/不可读）"的文件给出 missing 警告；playground 与工作区外路径不探测、不警告。

#### Scenario: playground 会话交付本地文件不警告
- **WHEN** playground（无工作区）会话里模型调用 `present_files` 交付一个真实存在的本地绝对路径文件
- **THEN** 工具成功执行、产物进清单、结果 JSON 的 `warnings` 为空（size 记 0 属预期，不视为"不存在"）

#### Scenario: 工作区内不存在的文件给出警告
- **WHEN** 模型交付一个工作区内但实际不存在的绝对路径
- **THEN** 该文件进 `missing`，结果 JSON `warnings` 包含"以下路径不存在或不可读，请核对：<path>"

#### Scenario: 工作区外真实存在的文件不警告
- **WHEN** 模型交付一个工作区外但真实存在的绝对路径
- **THEN** 不 stat、不进 missing、`warnings` 为空

### Requirement: 结果 message/previewed 不虚假承诺预览成功

系统 SHALL 让 `present_files` 的结果表述与真实行为一致：交付是同步确定的，预览打开是渲染进程异步行为。

#### Scenario: 结果不承诺预览
- **WHEN** `present_files` 成功执行
- **THEN** 结果 JSON 的 `message` 为"已交付"类中性表述；`previewed` 仅为实际给定的 `focusFile`（URL 交付或 focusFile 不存在时为空数组），不出现"已在预览面板打开"等无法兑现的承诺

### Requirement: URL 产物在预览面板可外部打开

系统 SHALL 让 URL 类产物在面板中走外部打开（系统浏览器），而不是被当本地文件送进文本/静态服务读取。

#### Scenario: 点击 URL 产物卡
- **WHEN** 用户在产物清单/面板点击一个 `http(s)://` 产物
- **THEN** 调用外部打开（系统浏览器），不发起 `readArtifact`，不显示"暂不支持预览此类型"

### Requirement: 工作区内交付 HTML 可在预览面板运行

系统 SHALL 保证工作区内交付的 HTML 文件在右侧预览面板的 iframe 中能加载并执行 JS（与 WorkBuddy 的"活预览"一致）。

#### Scenario: 交付 HTML 自动打开且可运行
- **WHEN** 模型交付工作区内一个 HTML 文件（首项，focusFile）
- **THEN** 右侧预览面板自动打开该文件，iframe `src` 指向 `http://127.0.0.1:<port>/<相对路径>`，页面可执行脚本（沙箱 `allow-scripts allow-same-origin allow-forms`）

#### Scenario: CSP 放行预览域（回归断言）
- **WHEN** 检查 main 窗口 CSP 配置
- **THEN** `frame-src`/`child-src`（或等效 `default-src` 未收紧时）必须允许 `http://127.0.0.1:*`，且预览静态服务实际绑定 127.0.0.1 随机端口

## MODIFIED Requirements

### Requirement: 产物交付唯一入口（present_files 显式交付）

系统 SHALL 继续以 `present_files` 作为产物唯一交付入口（UI 不从 write/edit 推导）；本次改动让该入口真正对模型可见（此前因白名单缺失而不可用）。

### Requirement: 非绝对路径整单报错（口径显式化）

系统 SHALL 维持"files 中任一非绝对路径/非法协议（含 `file://`、`javascript:`、`data:`）→ 整单报错、不交付任何一项"的语义，并在测试中显式断言。

### Requirement: 工具结果一律结构化 JSON（type 字段）

系统 SHALL 保持 `present_files` 返回 `{type:"present_files_result", ...}` 结构化 JSON 文本，供 UI 分支渲染。

## REMOVED Requirements

### Requirement: 从 write/edit 推导产物

**Reason**：已由"present_files 显式交付"取代（`chat-view.tsx` 注释"不再从 write 推导"），本轮不再回退。
**Migration**：无——维持现状。
