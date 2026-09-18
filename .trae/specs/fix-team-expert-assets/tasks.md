# fix-team-expert-assets Tasks

> 前置结论与证据见 `spec.md`（Why 与行号）。本批不动团队运行时，只修
> 「资产 ↔ 运行时」这一段错配。

## 批 1 · 加载器与契约（可单测，先行）

- [x] 1.1 `src/core/agents.ts`：导出 `loadAgentsDir(dir)`（现有内部函数提升为导出，
      供 experts 复用，保证成员文件格式与全局库同源，不出现第二套解析）
- [x] 1.2 `src/core/agents.ts`：新增纯函数
      `mergeAgentPools(globalAgents, expertAgents)`（空入参原样返回 / 全局在前 /
      重名保留全局那份），单测覆盖
- [x] 1.3 `src/core/experts.ts`：加载 `<expert>/agents/*.md` → `ExpertDefinition.agents`
- [x] 1.4 `src/core/experts.ts` 校验：`agents/` 存在但为空 → 抛错；
      成员名与全局 agents 库重名 → 抛错；专家之间同名允许
- [x] 1.5 `src/core/experts.ts`：新增可选 `expertType`（`expert | team`，缺省 `expert`，
      非法值抛错），文件头注释同步立场修订
- [x] 1.6 单测（`experts.test.ts` / `agents.test.ts`）：私有成员加载、空目录、
      坏文件、重名、expertType 三态解析
- [x] 1.7 回归断言：真实 14 员里 12 个单体专家 `expertType === "expert"` 且 `agents` 为空
      （并顺带修了 3 处 ExpertDefinition 字面量 fixture 与 probe 脚本的调用点）

## 批 2 · 资产（两个团队专家）

- [x] 2.1 `resources/experts/gpt-researcher-team/agents/`：新增 6 个成员人格
      `topic-researcher` / `research-planner` / `draft-reviewer` / `draft-reviser` /
      `report-writer` / `report-publisher`（人设从正文成员表与各 Phase 下发任务抽取，
      tools 白名单参考 `worker.md`：研究类含 web_search/web_fetch，发布员含 write，
      一律不含 `task` / `questionnaire` / `automation_*`）
- [x] 2.2 改写 `gpt-researcher-team/expert.md`：工具语义换 `team_create/team_send/
      team_status/team_delete`；删 `TeamCreate`/`Agent(`/`subagent_type`；
      成员表每格写清「花名（name） + agent ID」；保留消息中转与「禁止自模拟」铁律；
      补「并行副本必须唯一 name」与超时表的软化注脚
- [x] 2.3 `resources/experts/openspec-doc-team/agents/`：新增 3 个成员人格
      `doc-researcher` / `doc-generator` / `doc-auditor`
- [x] 2.4 改写 `openspec-doc-team/expert.md`（同 2.2 口径）
- [x] 2.5 两个专家 frontmatter 声明 `expertType: team`
- [x] 2.6 两个 README 记录「搬用来源 + 本轮本地化改动」（不进提示词，故写在 README 而非正文）

## 批 3 · 接线与 UI

- [x] 3.1 `src/daemon/index.ts`：agents 清单改为按当前专家动态解析的函数
      `resolveAgents`（`bucket.conversation.state.expertId`，按 expertId 记忆缓存——
      listAgents 每次工具调用都走，不能每次全量重载专家库）；task/team 的
      `listAgents` 与 `startTeam` 的 find 统一走它
- [x] 3.2 `src/shared/ipc.ts`：`ExpertListItem` 加 `expertType`；
      `src/daemon/index.ts` 的 `listExperts` 映射补字段
- [x] 3.3 `src/renderer/experts-view.tsx`：新增 `scoped`，专家团 tab 按
      `expertType === "team"` 过滤（切 tab 清选中分类），空态改为「还没有团队型专家」
- [x] 3.4 相关单测/快照更新（prompt-preview、prompt-composer 的 ExpertDefinition fixture）

## 批 4 · 护栏与验证

- [x] 4.1 新增 `scripts/check-expert-assets.ts`：team 专家必须有非空 `agents/`；
      正文 `agent: "xxx"` 的每个 ID 必须存在；每个成员都必须被正文点名；
      禁止串 `TeamCreate`/`subagent_type`/`Agent(`
- [x] 4.2 `package.json` 加 `check:expert-assets` 并接入 `check` 链
- [x] 4.3 **破坏性验证**：ID 拼错 → 红（2 条诊断）；插入 `TeamCreate` → 红（指名行号）；
      改回后绿
- [x] 4.4 实跑 `typecheck` / `check:deps` / `check:tokens` / `check:model-experience` /
      `check:invariants` / `check:expert-assets` 全绿；全量 vitest：
      2698 passed / 1 failed —— 失败项 `src/sandbox/confinement.win.test.ts
      「超时杀掉整棵进程树」`，单独复跑 9 passed（5s，并发压力下 20s 超时被拖爆），
      与本次改动无交集（未触碰 src/sandbox/*）
- [ ] 4.5 真机验证（待做）：设置页开「智能体团队（实验）」→ 绑定「深度研究团队」→
      下达协作任务 → 确认 `team_create` 带出 6 名成员、无“没有名为…的子代理定义”

## 验证

- [x] v.1 typecheck ✓
- [x] v.2 check:deps ✓
- [x] v.3 check:tokens ✓
- [x] v.4 check:model-experience ✓
- [x] v.5 check:invariants ✓
- [x] v.6 check:expert-assets ✓（含 4.3 先红后绿）
- [x] v.7 全量 vitest ✓（2698 passed；唯一失败项为既有 flaky，见 4.4）
