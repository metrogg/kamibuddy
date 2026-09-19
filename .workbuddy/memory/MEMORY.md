# KamiBuddy 项目长期笔记

## 判断进度的正确方式
- `.trae/specs` 勾选状态不可信（~20 个 spec 代码已交但 checkbox 未回勾）。落地看 `src/` 有无对应文件。
- README 落后于代码，以 `docs/ARCHITECTURE.md` + 代码为准。界面显示名「嘉立创Work」/ 仓库代号「KamiBuddy」。

## 环境坑（最费时间，先读）
- Git Bash shim 缺 coreutils（grep/sed/head/wc/ls/cat 全 `command not found`，node/git 正常）。查文件用 Glob，内容用 Grep，脚本用 node。
- ⚠️ 致命：`git` 输出接管道会静默返回空（`head` 不存在 + `2>/dev/null` 吞错、退出码 0）→ 误判工作区干净。`git status --porcelain`/`git log` 一律裸跑。
- PowerShell 工具不回传 stdout，别用它取输出。
- Electron 用 `npm run dev`/`npm start`（剔除 ELECTRON_RUN_AS_NODE），别 `npx electron .`。
- `npx` 不可靠（牵 wsl.exe 被拦、乱码）。直呼本地入口：vitest→`node node_modules/vitest/vitest.mjs run`、tsc→`node node_modules/typescript/lib/tsc.js --noEmit`、tsx→`node node_modules/tsx/dist/cli.mjs`、electron-vite→`node node_modules/electron-vite/bin/electron-vite.js build`。
- 逆向 22MB codebuddy.js 别用 Grep（长行被吞），写临时 node 脚本 indexOf+slice，查完删。

## 两套数据源（2026-09-14）
- 会话 JSONL `~/.kamibuddy/sessions/*.jsonl`：消息正文+按条 model/usage/timestamp，跨会话历史看这里。
- 运行台账 `logs/runs/<sid>.jsonl`：只记 pi 不记的（计时/TTFT/重试/快照/队列），无按条 model/usage。
- 事件日志 `logs/events-*.jsonl`：全量 SessionEvent，体积是风险（~22MB/日，无轮转无清理）。

## 可观测性（三页分工，别互塞）
- 统计页=跨会话宏观；诊断页=机器级自检；任务诊断面板=单任务微观（`task-diagnostics-panel.tsx`，跟随会话）。
- 不双写：消息正文只落会话 JSONL 一份。两套计时/两个 token 口径不许混。缺消息逐条稳定标识是最大结构缺口。

## MCP 子系统（src/core/mcp-config.ts + src/extensions/mcp-client.ts）
- 双级配置：用户级 `~/.kamibuddy/mcp.json` + 项目级 `<工作区>/.mcp.json`（项目级覆盖同名）。**注意：宿主 WorkBuddy 的 `~/.workbuddy/mcp.json` 不是本产品的。**
- JSONC 格式，支持 `${VAR}` 展开（未设置即报错），schema 校验（stdio command / http url 互斥）。配置坏=响亮抛错，本会话不加载、不阻塞。
- 连接：并行连、30s 握手超时、断线指数退避重连（1/2/4/8s，上限 5 次）。工具注册为 `mcp__<server>__<tool>`。
- 可见性陷阱：工具只在**下个会话**对模型可见（激活名单 extraActiveTools 在会话构造时并入）。新增 server 经 connectors 页 reload 热应用、连接/重连即时反映，但模型调用要等下一轮。

## Skill 子系统（src/core/skill-*.ts + src/extensions/skill-*-tool.ts）
- 三层落点：内置 `resources/skills` + `resources/plugins`；用户级 `~/.kamibuddy/skills/`；项目级 `<工作区>`（skill-scope.ts 按路径判定）。
- 导入：`skills-view.tsx` 支持「含 SKILL.md 文件夹」或「单个 .md」；`importSkill` 校验（name 小写 a-z0-9-连字符、description 必填）、两段式换名原子回滚、写 `_installed.json` sidecar。下一轮对话即生效（daemon 每轮现读清单）。
- 模型自装技能带 `agentCreated` 标记才允许覆盖/删除（对齐 WorkBuddy）。同名非 agentCreated 一律拒。
- **安全边界**：`<configDir>/skills` 写被权限门拒（技能正文=提示词，防注入），模型只能在工作区产出再经 skill_install 工具落盘。

## 设置页与配置层
- 加一个配置键成本=6 文件+2 IPC 通道；`config.get(key)` 单一入口未落地，批量加配置项前先补它。
- pi 已有整套配置白放（compaction/retry/steeringMode 等），没接 UI。完全缺：网络代理/保留期清理/主题切换/快捷键/子代理模型映射。

## 界面约定
- 截图先定性应用：真 WorkBuddy 才有 `发现应用`/`Buddy加油站`/`5.5.6`/`WorkBuddy`；我们 `嘉立创Work`/`V0.1.0`。
- 菜单纯文字+右侧对勾（不抄 WorkBuddy 图标）。让位内边距四值分写，简写会抬左。

## 专家团（agent-team，2026-09-19：产出走「拉」）
- 成员产出只在 `~/.kamibuddy/sessions/<时间戳>_<memberSessionId>.jsonl`（pi 文件名带时间戳前缀，按裸 id 拼会静默失效）。领导用 `team_read` 取回。无回投/推送机制（推模式协议已删）。
- 铁律：① 生命周期敏感异步操作不许 `void`，回投须 `await`；② 先 `markPendingDelivery()` 再投递，`finally clearPendingDelivery()`；③ `pendingDelivery`≠`interrupted`；④ 只存标记不存正文。
- `TeamMember.turns` 恒为 0 是假信号，轮数看 `activity`/`recordCompletion()`。
- `followUp()` 入队即 resolve，resolve≠送达；销账须「见过在队列 + 然后消失」两拍。

## 完成后必跑
`npm run typecheck && npm run check:deps && npm test`；改 `documents/` 必跑 `npm test`。另有门禁 check:tokens/check:model-experience/check:invariants/check:expert-assets。
