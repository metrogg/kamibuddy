# add-team-ux-parity Tasks

> 按 spec 的批次顺序做。P0 明确不做（用户 2026-09-18 决定保留全局开关现状）。

## 批次 ① · 成员焦点导航与键盘路径 ✅

- [x] 1.1 `team-status-bar.ts`：`nextMemberTarget`（纯函数）—— 主理人 → 成员 1 → … →
      主理人循环；**跳过没有 sessionId 的成员**（聚焦空壳会白屏）；无可切目标返回
      undefined（调用方据此不拦按键）
- [x] 1.2 `composer.tsx`：空输入框按 ↓ 触发 `onCycleMember`；三条前提缺一不可
      （有团队 / 框为空 / 无修饰键）；IME 候选期间不拦（方向键归输入法）
- [x] 1.3 `chat-view.tsx`：`cycleMember` 接线；**Ctrl+O** 从成员视图回主理人
      （只在成员视图注册，不影响领导态的 Ctrl+O）
- [x] 1.4 单测 6 条（`team-status-bar.test.ts` 的 nextMemberTarget 组）
- [x] 1.5 **不做 Esc 退视图**（spec 原写有）：Esc 已被图片预览/浮层/停止确认占用，
      再加一个「看情况」的 Esc 会让现有语义不确定；Ctrl+O 已覆盖该需求（WorkBuddy 同款）

## 批次 ② · 常驻成员状态栏 ✅

- [x] 2.1 `team-status-bar.tsx`：`teamBarRows`（纯函数，展示模型）+ 组件
      （`● 运行中 / ✓ 完成 / ✗ 失败 / … 启动中` + 轮数与工具数 + 点击聚焦 + × 收起）
- [x] 2.2 数据源沿用 `team_member_progress` 投影（不新增事件、不新增 IPC）
- [x] 2.3 `chat-view.tsx`：输入区上方常驻；收起状态按会话保持（用户主动隐藏）
- [x] 2.4 `index.css`：`.team-bar*` 样式（全 token，无硬编码视觉值）
- [x] 2.5 单测 6 条（四态符号 / 计数省略 0 / 不可点 / current 高亮 / 空团队）

## 批次 ③ · 任务面板（Ctrl+T）✅

- [x] 3.1 只读 IPC 全链路：`INVOKE.getTeamTasks` + `TeamTaskView`（契约层自己声明，
      shared 不能 import core）+ IpcContract + bridge 类型 + preload + daemon handler
- [x] 3.2 daemon handler：按当前桶取任务板，无团队/未建会话 → 空数组（空态不是错误）
- [x] 3.3 `team-task-panel.tsx`：分组展示（可开工 → 进行中 → 等上游 → 已完成 → 已取消）
      + owner / 依赖 / 结果；打开期间 2.5s 轮询（本地 IPC 成本极低，换面板不显示旧状态）
- [x] 3.4 与状态栏**同位互斥**（输入区上方，二选一）
- [x] 3.5 Ctrl+T 开合，**只在有团队时注册**（没团队的会话别抢这个快捷键）
- [x] 3.6 单测 5 条（分组顺序 / 空组不出现 / 未知状态丢弃 / 依赖文案）

## 批次 ④ · 成员权限卡按成员分组 ⏳ 待做

- [ ] 4.1 成员审批从全局 modal 队列分出，走输入区上方独立卡位（与 sandbox 卡互斥同位）
- [ ] 4.2 三选显式化：`仅本次允许`（allow_once）/ `本会话内允许`（allow_session）/ `拒绝`（deny）
- [ ] 4.3 并发多成员请求纵向堆叠（不互相覆盖）
- [ ] 4.4 主会话 / 子代理 / 定时任务保持现状（全局 modal）
- [ ] 4.5 单测：审批归属分组与三选映射（纯函数）

## 批次 ⑤ · 专家包安装链路 ⏳ 待做

- [ ] 5.1 `core/expert-package-import.ts`：本地目录导入 + 校验（复用 `loadExperts` 同一套规则）
- [ ] 5.2 WorkBuddy 形状（`plugin.json`）自动转换：manifest → frontmatter、
      `agents/*.md` 补 `tools`、工具名本地化、成员 name 取 `displayName.zh`
- [ ] 5.3 转换产物必须过 `check:expert-assets`（把门禁跑进导入流程）
- [ ] 5.4 专家市场页「导入专家包」入口 + 结果反馈
- [ ] 5.5 **不做网络一键下载**（本机包目录已覆盖真实用例，见 spec 否决方案）

## 批次 ⑥-⑩ · P2 细节 ⏳ 待做

- [ ] ⑥ `expertType` 四值（`skill|agent|plugin|team`，`expert` 保留为 `agent` 别名）
- [ ] ⑦ 成员轮次上限（`maxTurns`，agent 定义 + `team_create` 覆盖；触顶**不硬杀**，
      给主理人一条提示）
- [ ] ⑧ spawn 逐个记账（部分成员启动失败时给汇总与原因，不静默）
- [ ] ⑨ 成员头像（搬入源包 `avatars/`，缺失回落首字符色板）+ 专家卡 `avatar`
- [ ] ⑩ truly-idle 收敛：**只记录不实现**（当前无 DB 状态机，将来做自动化后台委派才需要）

## 验证

- [x] v.1 `typecheck` ✓
- [x] v.2 `check:tokens` ✓（真违例 0；新样式全 token）
- [x] v.3 `check:deps` ✓（新 IPC 契约不破依赖方向）
- [x] v.4 `check:model-experience` ✓（22 模块契约齐全）
- [x] v.5 单测：`team-status-bar.test.ts` 12 + `team-task-panel.test.ts` 5 ✓
- [ ] v.6 全量 vitest（待跑）
- [ ] v.7 **真机截图核对**（用户验收）：状态栏位置与观感、↓/Ctrl+O/Ctrl+T 手感、
      面板与状态栏同位互斥是否符合预期
