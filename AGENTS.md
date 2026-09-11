# AGENTS.md — 本项目的开发约定

> 给人和 AI 共同遵守。修改这些规则前先读 `docs/ARCHITECTURE.md` 的决策理由。

## 项目一句话

KamiBuddy 是基于 [pi agent harness](https://pi.dev) 的办公 AI Agent 桌面端，对标腾讯 WorkBuddy。
逆向调研素材在 `docs/workbuddy分析/`,我们的目标就是做一个workbuddy出来,如果没有更好的办法就模仿吧+

### 参考物与来历

- WorkBuddy：经批准解包后的安装目录（`开源项目/WorkBuddy/`，非 git 仓库），
  逆向笔记在 `docs/workbuddy分析/`
- pi：官方仓库 clone（`开源项目/pi/`），查 API 时直接读源码，不凭记忆猜。
- codex / deepseek-harness：同类 Agent 实现的参考 clone。
- opencode：先 fork 到个人仓库再拉的（`开源项目/opencode/`）。

## 选型与实现顺序（动手前先走这一遍）

先复刻 WorkBuddy，但**能借力就不要自研**。遇到某一块要动手，按下面的顺序决定怎么做：

1. **市面已有成熟实现 → 直接用。** 成熟库能覆盖的（文档解析、格式转换、图表等），
   不自己写，避免堆出不可维护的私货。可扩展、可维护优先于「自己造」。
2. **不确定 → 先看 WorkBuddy 怎么实现的。** 它就在 `开源项目/WorkBuddy/` 里。
   能直接照它的实现做，就直接做。
3. **WorkBuddy 的实现走不通**（比如依赖云端 / 腾讯内部能力等），
   **去找同类型的别家实现或市面上的开源库** 看他们怎么解决。
4. **pi 自身的插件 / 扩展生态也要看**（`开源项目/pi/` 的 packages 与 examples），
   不少能力 pi 已有现成参考或可直接复用。
5. **还是定不下来 → 来问我。** 拿不定主意先问，不要擅自选一条路硬写。

上面这条原则不变；它凌驾于「我先按文档写的做」之上——文档写得和它冲突时，以它为优先并回来确认。

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

1. **`documents/`** **不许 import pi，不许 import electron。** 它只是
   `内容 + tokens + 体裁 → HTML → bytes` 的纯函数库。这条保证它可以脱离
   LLM 和 Electron 单独跑单元测试——这是我们最重的模块，测试是 AI 写它时唯一的护栏。
2. **pi 的类型只允许出现在** **`core/`** **和** **`extensions/`** **里。**
   `AgentSessionEvent`、`AgentTool`、`ExtensionAPI` 这些一律不许流到 `renderer/`。
   理由：pi 是 0.85.x，破坏性变更几乎必然发生。适配层挡住后，pi 升级只塌一个模块。
3. **`renderer/`** **只能 import** **`shared/`。** 不许碰 `core/`、`daemon/`、`documents/` 的内部。

`npm run check:deps` 机械校验以上规则，CI 和提交前都要跑。

## 二、文档流水线

- **HTML 是唯一中间态。** 内容先渲染成 HTML，导出器再把 HTML 转成目标格式。
  不许出现"直接拼 docx 对象"的第二条路径——那样预览、PDF、图表全要另做一遍。
- **文档流水线按 WorkBuddy 的方式跑 Python，不再禁止 bash/python。**
  S3「HTML→docx」用 Python 引擎（`python-docx` / `html-for-docx` /
  beautifulsoup4 / lxml / Pillow），环境用「托管 venv + `uv` 装独立 Python 3.12」
  解决，不要求用户机器上预装 Python / Git for Windows。
- **环境准备照 WorkBuddy 的** **`setup-html-to-docx.sh`** **抄机制**：
  - 幂等脚本，已就绪秒退；首次联网装 `uv` → `uv python install 3.12` 拉独立发行版
    → 建 `~/.venv-html-to-docx` → `--only-binary=:all:` 装 wheel（绕开 lxml 无
    libxml2/libxslt 时源码编译失败的坑）→ import 冒烟。
  - 私有化/无外网：`UV_INDEX_URL` + `UV_PYTHON_INSTALL_MIRROR` 指向内网镜像，
    或运维预置 `uv` 与离线 wheel。
  - 会话启动后台预热（SessionStart hook，超时不阻塞），首次冷启动不卡会话。
  - 转换失败降级 Markdown；组件/图片失败只跳过或占位，不整篇崩。
  - 这套 venv 是进程内受控调用，不等于把 `bash` 暴露给 agent 当自由 shell
    工具（agent 的 shell 能力见下一节）。
- **agent 的 shell 能力另有决策**：`bash` 仍然不用（上面那条理由不变），
  但 `powershell` 是 Windows 原生、不依赖 Git for Windows，**已决定启用**
  （决策记录见 `docs/workbuddy分析/09-sandbox-and-permissions.md` §6 决策 A）。
  **前置条件：必须先有危险命令检查器**（`iex` / `Invoke-Expression` / `Add-Type` /
  `-EncodedCommand` / 递归删除 / 下载执行…）。当前**尚未实现，工具面里也还没有
  powershell** —— 在检查器落地之前不要打开它：没有 OS 沙箱时，一条命令就能绕开
  权限门的全部路径保护（`type ~\.ssh\id_rsa`）。
- 外部命令调用失败必须响亮报错（§7），不许静默降级掩盖"命令不存在"。
  （文档流水线内、受控的转换失败降级 Markdown 是明确设计，不属"静默掩盖"。）
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

- **IPC 通道名和 payload 类型集中在** **`shared/ipc.ts`**，主进程和渲染进程都从这里 import。
  不许在两侧各写一遍字符串字面量。
- **写任何 helper 前先看** **`shared/`。** AI 不记得三天前写过什么，这条是硬要求。
- 业务工具的公共部分（HTTP、错误映射、大输出落盘）抽进 toolkit，
  工具本身只写领域逻辑。

## 五、配置

所有配置读取走 `config.get(key)` 单一入口，分层合并：
内置默认 → 本地文件 → （预留）云端下发。

**不许在业务代码里直接** **`readFileSync('settings.json')`。**
云端配置是将来少发版的命根子，现在不做，但入口必须现在就统一。

## 六、WorkBuddy 资产使用（2026-09-10 用户决策）

**内部使用阶段允许直接搬用 WorkBuddy 资产**（Python 引擎、HTML 模板、design tokens、
专家/编排文案），正式上线前由专人做风险置换——风险兜底不是开发者的任务。
已搬用的资产在目录 README 注明来源（如 `resources/docx-engine/README.md`）。
机制类情报（架构、流程、阈值）仍然优先照学；能搬就不重写，别为原创而原创。

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
