# Checklist

> 2026-09-14 校验：`npm run typecheck` / `npm run check:deps` / `npm test`（89 文件 / 1612 用例）全绿。
> 标注「代码层已确认」的界面项，其渲染结果由 state 纯函数决定，已由单测覆盖；**视觉确认待人工在运行中的应用里执行**（见 tasks.md SubTask 6.3b）。

## 正交化

- [x] `resources/modes/` 下只有 ask / craft / plan 三个模式，`expert.md` 已删除
- [x] 交互模式切换（craft ↔ ask ↔ plan）不改变会话的 `expertId`（`session-host.setInteraction` 只写 `interactionId`；用例「切交互模式不改 expertId」）
- [x] 选择/取消专家不改变会话的 `interactionId`（`session-host.setExpert` 只写 `expertId`；清除时显式写 `undefined` 防浅合并残留）
- [x] 六种组合均可达并被验证：`prompt-composer.test.ts` 的 6 例矩阵（craft/ask/plan × 绑/不绑专家）
- [x] `composeSystemPrompt` 的人格解析条件是 `expertId !== undefined`，与 `interactionId` 无关
- [x] 历史会话落盘 `interactionId === "expert"` 时，resume 归一为 `craft` 且保留 `expertId`（`session-rebuild.normalizeLegacyInteraction` + 4 例测试）
- [x] `applyInteraction` 不再接收 `expertId` 参数，`/plan` 回程记忆只记三模式
- [x] 子代理会话与定时任务会话不继承专家人格与私有技能（`subagent-runner` / `automation-runner` 的 compose 回调忽略 expertId）

## 人格注入（保持不回退）

- [x] 绑定专家时人格正文仍注入系统提示词前部槽位且带 Role Override 声明
- [x] 绑定专家时末尾仍有不含人格正文的 `<current-expert>` 钉子段
- [x] 绑定专家时仍不注入风格段（风格让位于人格）

## 专家资源目录化

- [x] `resources/experts/<name>/expert.md` 形式承载全部 9 个内置专家
- [x] 加载器按目录加载；`frontmatter.name` 与目录名不一致时响亮报错
- [x] 目录缺 `expert.md`、存在游离 `.md`、`skills/` 为空、技能子目录缺 `SKILL.md` 均响亮报错
- [x] 用户级专家目录（`~/.kamibuddy/experts/`）同样支持目录化与同名覆盖

## 专家私有技能

- [x] `ExpertDefinition` 暴露专家技能目录（`skillsDir`）
- [x] 绑定带 `skills/` 的专家时，系统提示词技能清单段含其私有技能（用例：绑定后含 `dcf-model-builder`）
- [x] 未绑定该专家时，其私有技能不出现在技能清单段
- [x] 所处模式工具白名单无 `read` 时，技能清单段不注入（门控表达式与改造前逐字一致）
- [x] 专家私有技能与全局技能重名、或与其它专家私有技能重名时，加载抛错并指明冲突文件路径
- [x] 技能页/`skillsSnapshot` 仍只展示全局技能，不混入专家私有技能

## 搬用技能

- [x] `resources/experts/stock-research-report/skills/` 下原样含 `comps-valuation`、`dcf-model-builder`、`initiating-coverage`
- [x] `initiating-coverage` 的 `assets/`（2 个）与 `references/`（6 个）完整搬入
- [x] 该专家目录的 README 注明来源（WorkBuddy `equity-research` 专家包）、搬入日期、含哪三个技能、待定制差异

## 渲染层与预览

- [x] 模式切换器不再需要过滤 `expert`（`src/renderer/**` 已无该字面量），且不因切换模式清掉专家 chip（**代码层已确认**，视觉待人工）
- [x] 从专家市场页「使用专家」仍走「新任务 + 绑专家」，不再隐含切模式（**代码层已确认**，视觉待人工）
- [x] 提示词预览可选择专家，能预览到人格段；文件头关于「不注入人格段」的差异说明已更新

## 工程校验

- [x] `npm run typecheck` 无错
- [x] `npm run check:deps` 通过（依赖方向未被破坏）
- [x] `npm test` 全绿（89 文件 / 1612 用例）
- [x] `docs/workbuddy对齐清单.md` 的 E5 与 F3 状态列已更新，并补搬用技能的证据

## 附带修复（实现过程中暴露）

- [x] `src/core/frontmatter.ts` 支持 YAML 块标量（`|` / `|-` / `>` / `>-`）——搬入技能的 `description: |` 曾导致整个专家库加载失败；`+` 变体与缩进列表/嵌套对象仍响亮报错
