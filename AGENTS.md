# AGENTS.md — 本项目的开发约定

> 给人和 AI 共同遵守。修改这些规则前先读 `docs/ARCHITECTURE.md` 的决策理由。

## 项目一句话

KamiBuddy 是基于 [pi agent harness](https://pi.dev) 的办公 AI Agent 桌面端，对标腾讯 WorkBuddy。
逆向调研素材在 `docs/workbuddy分析/`，**当规格书读，不当代码抄**（见下方合规红线）。

## 一、依赖方向（最重要，违反即返工）

依赖只能单向流动：

```
        shared          ← 类型 + IPC 契约，零运行时依赖，谁都可以 import
          ▲  ▲  ▲
   ┌──────┘  │  └──────┐
   │         │         │
 desktop  extensions  core
                │      │
                └─► documents ◄┘
                   (纯函数库)
```

三条硬规则：

1. **`documents/` 不许 import pi，不许 import electron。** 它只是
   `内容 + tokens + 体裁 → HTML → bytes` 的纯函数库。这条保证它可以脱离
   LLM 和 Electron 单独跑单元测试——这是我们最重的模块，测试是 AI 写它时唯一的护栏。
2. **pi 的类型只允许出现在 `core/` 和 `extensions/` 里。**
   `AgentSessionEvent`、`AgentTool`、`ExtensionAPI` 这些一律不许流到 `renderer/`。
   理由：pi 是 0.85.x，破坏性变更几乎必然发生。适配层挡住后，pi 升级只塌一个模块。
3. **`renderer/` 只能 import `shared/`。** 不许碰 `core/`、`daemon/`、`documents/` 的内部。

`npm run check:deps` 机械校验以上规则，CI 和提交前都要跑。

## 二、文档流水线

- **HTML 是唯一中间态。** 内容先渲染成 HTML，导出器再把 HTML 转成目标格式。
  不许出现"直接拼 docx 对象"的第二条路径——那样预览、PDF、图表全要另做一遍。
- **文档流水线一行 shell 都不许碰。** 全部走 Node 自定义工具在进程内完成。
  原因：pi 在 Windows 找不到 bash 会**直接抛异常**（`utils/shell.ts:100`），
  而目标用户（行政/产品/销售）机器上不会装 Git for Windows。
  WorkBuddy 靠自带 287MB 用户态解决，我们靠不产生依赖解决。
  这条**只约束文档流水线**（本节的范围），不是全局禁令 —— 见下一条。
- **agent 的 shell 能力另有决策**：`bash` 仍然不用（上面那条理由不变），
  但 `powershell` 是 Windows 原生、不依赖 Git for Windows，**已决定启用**
  （决策记录见 `docs/workbuddy分析/09-sandbox-and-permissions.md` §6 决策 A）。
  **前置条件：必须先有危险命令检查器**（`iex` / `Invoke-Expression` / `Add-Type` /
  `-EncodedCommand` / 递归删除 / 下载执行…）。当前**尚未实现，工具面里也还没有
  powershell** —— 在检查器落地之前不要打开它：没有 OS 沙箱时，一条命令就能绕开
  权限门的全部路径保护（`type ~\.ssh\id_rsa`）。
- 导出器统一签名 `(html, opts) => Promise<Buffer>`，新增格式就是新增一个文件。

## 三、能力是数据，不是代码

模式、提示词、体裁、design token 一律放 `resources/` 下的文件，代码只负责读取。

```
resources/
  modes/     ask.md craft.md plan.md   ← frontmatter 声明工具白名单，正文是提示片段
  prompts/   骨架 + fragments/          ← 组合式，不是每模式一份完整文件
  genres/    <体裁>/{prompt.md,template.html}
  tokens/    design tokens JSON
  skills/    SKILL.md（pi 原生 Agent Skills 标准，直接加载）
```

判据：**加一个体裁或模式，应该是加一个目录，零行代码改动。**
如果你正在写 `if (mode === 'ask')`，停下——那说明该配置化。

抄 WorkBuddy 的"双面文件"技巧：一份 `.md` 的 frontmatter 给加载器读工具白名单，
正文给模板引擎读提示片段。一份文件同时定义策略和内容，不会出现两者漂移。

## 四、防重复

- **IPC 通道名和 payload 类型集中在 `shared/ipc.ts`**，主进程和渲染进程都从这里 import。
  不许在两侧各写一遍字符串字面量。
- **写任何 helper 前先看 `shared/`。** AI 不记得三天前写过什么，这条是硬要求。
- 业务工具的公共部分（HTTP、错误映射、大输出落盘）抽进 toolkit，
  工具本身只写领域逻辑。

## 五、配置

所有配置读取走 `config.get(key)` 单一入口，分层合并：
内置默认 → 本地文件 → （预留）云端下发。

**不许在业务代码里直接 `readFileSync('settings.json')`。**
云端配置是将来少发版的命根子，现在不做，但入口必须现在就统一。

## 六、合规红线

- `docs/workbuddy分析/` 是经批准的逆向调研素材，**仅限内部参考**。
- **机制可以学，文字必须自己写。** 提示词、模板、技能正文一律独立撰写，
  不许从 WorkBuddy 的 `.tpl` / `SKILL.md` 原文复制粘贴。
- 不许把调研素材或其中的 prompt 原文提交进本仓库的产物目录。

## 七、代码风格

- TypeScript strict，ESM，禁 `any`（确实需要时写 `unknown` 加窄化）。
- 文件名 kebab-case，类型/组件 PascalCase，其余 camelCase。
- 注释写"为什么"，不写"做了什么"。
  踩坑处必须写明现象和根因——这是 WorkBuddy 逆向时最高价值的情报，正向开发时是知识传承。
- 不写防御性兜底掩盖上游问题。让它响亮地失败。

## 八、AI 协作

- 一次改动一个关注点，不要顺手重构无关文件。
- 改 `documents/` 必须同时跑 `npm test`。
- 声称"完成"之前跑 `npm run typecheck && npm run check:deps`。
- 不确定 pi 的 API 时读 `开源项目/pi/packages/coding-agent/` 的源码核对，
  不要凭记忆猜——那份 clone 就是留着当参考的。

## 九、明确不做（YAGNI）

不要主动引入：LLM provider 抽象层（`pi-ai` 已经是了）、插件加载器（pi 有 packages + Skills）、
会话存储接口（`SessionManager` 已给两种实现）、多租户/多用户、事件 schema 版本号
（daemon 和 renderer 同仓库同构建，不存在版本错配）。
