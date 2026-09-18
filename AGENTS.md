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
  beautifulsoup4 / lxml / Pillow），环境用**随包托管的运行时**解决：
  `python` / `node` / `gitbash` 三个运行时统一放在托管根
  `<configDir>/runtimes/<id>/<version>/` + `current` 指针（内核在 `src/core/runtimes/`），
  **用户什么都不用装**（也不要求预装 Python / Git for Windows）。
  python 仍由 `uv` 在运行期装（`--only-binary=:all:`），node / gitbash 由构建期脚本拉取后
  **随包分发**（gitbash 的 7z 解包只在构建期做 —— 7-Zip 不进产物）。
  来源、校验、许可义务与体积实测见 `docs/运行时来源与许可.md` 与
  `resources/runtimes/README.md`（后者含 §5 的**否决方案**）。
- **环境准备照 WorkBuddy 的** **`setup-html-to-docx.sh`** **抄机制**：
  - 幂等脚本，已就绪秒退；首次联网装 `uv` → `uv python install 3.12` 拉独立发行版
    → 在托管根下建 venv → `--only-binary=:all:` 装 wheel（绕开 lxml 无
    libxml2/libxslt 时源码编译失败的坑）→ import 冒烟。
    历史路径 `~/.venv-html-to-docx` 若存在，被**复用**并如实上报（不静默丢弃）；
    `HTML_TO_DOCX_VENV` 作为显式覆盖口保留。
  - 私有化/无外网：`UV_INDEX_URL` + `UV_PYTHON_INSTALL_MIRROR` 指向内网镜像，
    或运维预置 `uv` 与离线 wheel；node / gitbash 的**随包载荷**同样可手工放置
    （`resources/runtimes/payload/<id>/<version>/`，fetch 脚本幂等跳过，dist 链因此不必联网）。
  - 会话启动后台预热（SessionStart hook，超时不阻塞），首次冷启动不卡会话。
  - 转换失败降级 Markdown；组件/图片失败只跳过或占位，不整篇崩。
  - 这套 venv 是进程内受控调用，不等于把 `bash` 暴露给 agent 当自由 shell
    工具（agent 的 shell 能力见下一节）。
- **agent 的 shell 能力另有决策**（2026-09-17 修订：原「**`bash` 仍然不用**」**作废**）：
  Git Bash 现在**随包**作为托管运行时提供（用户不必装 Git for Windows，原约束的**前提已消失**），
  但**「是否把 `bash` 开放成模型的自由 shell 工具」是另行决策，至今未做** ——
  工具面里没有 `bash`（`resources/modes/*.md` 的白名单只含 `powershell`），
  `permission-policy.ts` 对 `bash` 仍维持高风险询问（无检查器、无法包沙箱，fail-closed）。
  随包提供运行时只让它在**路径上找得到**（注入层：`src/core/runtime-inventory.ts` 的
  `planRuntimeShellInjection` 算出环境补丁 → `src/daemon/**` 的 `createSandboxedRunner` 把它
  注入模型 shell 的**子进程**环境，进沙箱与降级直连两条 spawn 路径都在内），不改工具面
  —— 别把两件事混成一件。
  而 `powershell` 是 Windows 原生、不依赖 Git for Windows，**已启用**
  （决策记录见 `docs/workbuddy分析/09-sandbox-and-permissions.md` §6 决策 A）。
  **前置条件「危险命令检查器」已落地**：`src/extensions/command-guard.ts` 拦五类
  （动态执行 / 下载执行 / 凭据目录读取 / 递归强制删除 / 系统破坏），
  `src/extensions/powershell-tool.ts` 每次执行前无条件过它。它**不是沙箱**——
  base64 重编码、变量拼接、写脚本再执行都能绕过静态文本匹配，所以
  「读走凭据」（`type ~\.ssh\id_rsa`）这条路至今只有它拦得住：沙箱只约束写，
  读与网络不受约束，别因为"有沙箱了"就削弱检查器。
  工具已在工具面里：`src/daemon/index.ts`（主会话）、`src/daemon/subagent-runner.ts`
  （子代理）、`src/daemon/automation-runner.ts`（定时任务注册无人值守变体，
  工具层一律拒）；`craft` 白名单与内置 `worker` 角色的工具面都含它
  （回归断言在 `src/core/agents.test.ts`）。
  没有独立开关：**可见性**由模式白名单决定（`craft` 含它、`ask` 不含），
  **能不能跑**由权限预设档位 + 沙箱决定。
  三层分工、档位映射与已知边界见 `docs/ARCHITECTURE.md` §4.4a/§4.4b 与 `docs/sandbox.md`。
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
- **任何界面改动前必须先读 `DESIGN.md`；不得引入新的硬编码视觉值（颜色/间距/圆角/阴影/时长）。**
  Token 唯一真源是 `src/styles/tokens.css`；档位不够用时先改 DESIGN.md 并写明理由，
  不许在组件里加新档。验收细则见 DESIGN.md §9 的 CR 自查清单。

## 八、AI 协作与证据纪律

- 一次改动一个关注点，不要顺手重构无关文件。
- 改 `documents/` 必须同时跑 `npm test`。
- 不确定 pi 的 API 时读 `开源项目/pi/packages/coding-agent/` 的源码核对，
  不要凭记忆猜——那份 clone 就是留着当参考的。
- **声称"完成"之前跑 `npm run typecheck && npm run check:deps`**，并在交付里附上
  实跑结果（命令 + 输出）。没跑过就不算完成，"应该没问题"不是证据。
- **证据要打真入口路径**：测试走生产的装配入口、真实资源目录、真实会话形态，
  不另搭只有测试用的旁路——旁路绿 ≠ 线上绿。教训：沙箱上线首测那次回归，
  正是因为终端测试全绿、真实进程里每条命令都失败。
- **断言"没碰的东西逐字节不变"**：改动波及的相邻产物（提示词字节、序列化 JSON、
  台账/事件格式）要有对照断言。"看上去没变"不算证据。
- **改坏 → 看它变红 → 再回滚**：新增的护栏（测试、门禁脚本、探针）都先人为破坏一次，
  确认它真会失败；不会变红的护栏只是装饰。
- **非平凡改动留一份决策记录**（本项目形态：`docs/` 里的「决策 N」小节、
  `ARCHITECTURE.md` 的决策段、`.trae/specs/*/spec.md`），且**必须含 `## 否决方案`**
  ——被否掉的路 + 否掉的理由，避免同一个决定被反复推翻。
  记录**写完即冻结**：后续只改状态（有效 / 被取代 / 作废）与事实性路径，不改结论；
  结论要变就另写一份并与旧记录互相链接。
- 提交前人工过一遍上面几条。决策记录自查（先做人工项，脚本化以后再说）：
  这次是非平凡改动吗？有决策记录吗？记录里有 `## 否决方案` 吗？

## 九、明确不做（YAGNI）

不要主动引入：LLM provider 抽象层（`pi-ai` 已经是了）、插件加载器（pi 有 packages + Skills）、
会话存储接口（`SessionManager` 已给两种实现）、多租户/多用户、事件 schema 版本号
（daemon 和 renderer 同仓库同构建，不存在版本错配）。
