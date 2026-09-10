# Tasks

## 波一 · 数据层与执行器（串行：加载器接口先行）

- [ ] Task 1: agents 资源 + 加载器 + 去毒纯函数
  - [ ] 1.1 `resources/agents/`：内置四员 scout/planner/reviewer/worker.md
    （frontmatter：name/description/tools；正文自创提示词——禁止复制 pi 示例
    与 WorkBuddy 原文；scout 只读+联网、planner/reviewer 只读、worker 全工具面）
  - [ ] 1.2 `src/core/agents.ts` + 测试：加载内置目录 + 用户级 `~/.kamibuddy/agents/`
    （getConfigDir()/agents），同名用户级覆盖内置；frontmatter 校验从紧
    （缺 name/description/tools 抛错、文件坏抛错）
  - [ ] 1.3 `src/core/subagent-sanitize.ts` + 测试：去毒纯函数
    （仿冒 system-reminder/Human:/Assistant: 行转义；正常文本不动）
  - [ ] 1.4 验证：`npm run typecheck && npx vitest run src/core/agents* src/core/subagent-sanitize*`

## 波二 · 执行器与工具（依赖 Task 1 接口）

- [x] Task 2: subagent-runner + task 工具 + daemon 接线
  - [x] 2.1 `src/daemon/subagent-runner.ts`：子代理执行器——进程内独立 AgentSession
    （cwd 同主会话、agent tools 白名单、继承当前模型、权限门用户在场变体、
    不注册 task 工具）；并发 4 排队；单跑 10 分钟超时；abort 信号传播；
    输出取最后 assistant 文本 → 24k 截断 → 去毒；进度回调（供 tool_progress）
  - [x] 2.2 `src/extensions/task-tool.ts` + 测试：task 工具三模式 schema
    （单发/并行 tasks≤8/链式 chain + {previous} 占位）；agent 不存在时列出可用清单；
    返回结构（输出 + turns + 失败诊断）；spawn 预算检查（由 daemon 注入计数器）
  - [x] 2.3 `src/daemon/index.ts`：装配 task 工具（注入 runner 与预算计数器）、
    主会话 abort 时传播杀子代理；run 会话不注册
  - [x] 2.4 `src/extensions/permission-policy.ts`：task 登记放行（不直接碰文件系统）
    + 测试；`resources/modes/craft.md` 白名单加 task；
    `src/core/session-host.ts` 工具卡标题 task → 「子任务」
  - [x] 2.5 验证：`npm run typecheck && npm run check:deps && npx vitest run src/extensions src/daemon src/core`

## 收尾

- [x] Task 3: 全量验证 + 文档
  - [x] 3.1 `npm run typecheck && npm run check:deps && npm test` 全绿（972 用例 + smoke 10/10）
  - [x] 3.2 `docs/STATUS.md`：专节（subagent：三模式/隔离执行/去毒/预算与深度限制）
    +「等你验证」冒烟项（第 16 项）

# Task Dependencies

- Task 2 依赖 Task 1（agents 加载器与去毒函数接口）
- Task 3 依赖 Task 1、2
