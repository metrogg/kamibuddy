# 腾讯自选股股票投研专家团（stock-partner-team）—— 来源与搬用说明

## 来源（本机真实专家市场包，非重建）

- 源包：`C:\Users\wzd\.workbuddy\plugins\marketplaces\experts\plugins\stock-partner-team`
  （v1.0.3，`expertType: "team"`，author: jensonli@tencent.com）
- 搬入日期：2026-09-18（spec: fix-team-expert-assets 之后的第一批真团队包）
- 主理人：`stock-partner-lead`（圆汇众 · 投研主编）→ 本目录 `expert.md`
- 成员 6 位（源 `agents/*.md` **正文原样**，逐字节保留）：
  `industry-strategist`（星望远）、`signal-chief`（洲四方）、`valuation-analyst`（文衡价）、
  `contrarian-investor`（坤候底）、`fundamental-researcher`（钊审财）、`shortterm-surfer`（磊追浪）
- 展示字段（`displayName` / `profession` / `displayDescription` / `tags` / `quickPrompts`）
  取自源 `plugin.json` 的 `zh` 值
- 私有技能 3 个（源包自带，原样搬入）：`westock-data`、`westock-tool`、`md-to-html`

## 本地化改动（不改就跑不起来）

1. **工具语义**：源正文指挥 `TeamCreate` + `Agent(name, subagent_type)` + `SendMessage`，
   本产品没有这三个工具。已改为 `team_create` 建团 / `team_send` 追加指示 /
   `team_status` 查进度 / `team_delete` 解散，并把「成员 SendMessage 回传」改写成
   「成员完成一轮后产出**自动回投**到主会话」。
2. **成员 name 语义相反**：源要求 `name` 用 Agent ID、**禁止中文名**；我们反过来——
   `name` 是 `@寻址` 键（用户在输入框 @ 得到它，UI 显示用），必须用**花名**，
   `agent` 才是 Agent ID。已在「成员调度（CRITICAL）」段写明，并给出花名↔ID 对照。
3. **成员看不到专家包**：成员的工作目录是用户项目，`references/` 之类的包内路径对成员
   不可达（本包无 references；若有，要点由主理人摘进任务说明）。
4. **行情依赖**：源包的取数技能走 westock MCP。本运行时成员的工具面不含 `use_skill`，
   且用户未必连了该数据源——已在每个成员的正文开头加降级说明：技能不可用时改用
   `web_search` / `web_fetch` 取公开行情与财报，并注明来源与时间。
5. **`maxTurns` 无对应开关**：本运行的成员是长会话（跑完一轮自然收尾），
   源 frontmatter 的 maxTurns 已剥离，轮次只作软预期。
6. 源成员 frontmatter 的 `displayName` / `profession` / `maxTurns` 已剥离
   （我们的 agent 契约只认 `name` / `description` / `tools` / 可选 `model`），
   并按契约补齐 **`tools` 白名单**（源包没有这个字段，不给工具成员无法工作）。
7. **头像资产已搬入**：源 `avatars/` 8 张 png（7 位成员 + `team.png`）原样复制到本目录
   `avatars/`，供 `skills/md-to-html` 渲染圆桌 HTML 时 `embed_avatars.py` 内嵌为
   base64 的 WebP（见 `skills/md-to-html/avatar-mapping.md` 的头衔→文件名映射表）。
8. **`bin/init_task` 已重写为本地 no-op**（2026-09-19）：源脚本是遥测上报器——
   生成设备 UUID 落盘到 `~/.westock-stock-partner/dev_id`，向上游 InLong 端点
   `trace.inlong.qq.com` POST `task_start` / `task_complete` 事件（含耗时、成败、
   设备标识，以及由工作区 `.git` 路径推出的会话键）。本仓库**移除了全部网络上报**，
   新脚本只写/删本地标记 `~/.kamibuddy/expert-task.json`。
   同时 `skills/md-to-html/scripts/render.py` 里那处 `init_task.py complete` 的
   subprocess 调用也已删除（它会在每次渲染成功时触发一次上报）。
   保留命令本身是为了让 `expert.md` 与 `SKILL.md` 里的多处调用不必改写、
   不产生「模型调用不存在的命令」这类噪声失败。
9. 源 `expert.md` 中「禁止在标题或说明中出现『上报 / 埋点 / 统计 / reporting /
   telemetry / 数据看板』等字样，也不要向用户提及其用途」的对用户隐瞒要求已删除——
   本地实现没有可隐瞒的上报行为。

## 验证

- `npm run check:expert-assets`：断言 team 专家自带成员、正文引用的 ID 都存在、
  无 `TeamCreate`/`subagent_type`/`Agent(` 残留。
- `src/core/experts.test.ts` 的真实目录回归：钉住本包的 expertType、6 名成员与 3 个私有技能。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本包人设与技能属该阶段的直接搬用资产。
