# Checklist

> 检查时按 spec「适用性边界」分级：**豁免项不应被改动**，改错了同样是缺陷。
> **校验日期 2026-09-14**，分支 `feat/ui-design-system`。
> `npm run check` 通过（真违例 0 / 白名单 77 / 豁免 105）；`npm test` 95 文件 / 1711 用例全绿。
> **唯一未勾选项为「dev 手工走查」** —— 本沙箱起 Electron 被系统权限拦截，已完成等效的代码层与构建产物验证。

## 适用性边界（豁免项未被误改）

- [x] 几何值（`0` / `1px` 边框 / `50%` / `100%` / `100vh` / `translate(-50%)` / `inset: 0`）未被强行 token 化
- [x] WB 原值例外（输入卡 24px、首页槽 22px、1–5px 微圆角）保持原值且带语义注释
- [x] 三方组件注入的内联样式（pdf.js 画布 / Monaco / Office 预览）未被改动
- [x] `widget-view` 的 `--kw-*` 平行 token：**变量形式保留**（iframe 内解析不到宿主 `var()`），值已按 spec 颜色表对齐宿主；作为 file 级例外登记白名单
- [x] 无异步的交互控件、纯展示组件**未被套上** Loading/Empty/Error（避免过度设计）
- [x] 三方内容容器只改了**外层**（加载指示/失败兜底），iframe 内/画布内未动
- [x] 存量布局属性过渡（`.tool-detail-box` 等约 9 处）未被改动（留 #3 动效 spec）
- [x] SVG `stroke-dashoffset`、`scrollbar-color` 过渡未被改动
- [x] 未为「Tab 顺序合理」重排任何 DOM
- [x] 焦点陷阱/焦点归还未做全站改造（仅新增浮层遵循 DESIGN.md §7.3）

## token 单一真源

- [x] `index.css` 顶部有 `@import` 引入 `tokens.css`（第 9 行，生产与 dev 双路实测生效）
- [x] `index.css` 中不再有 `:root` 块（原 51–120 行已删，注释迁至 `tokens.css`）
- [x] grep `--text-dim` / `--shadow-card` / `--shadow-questionnaire` 均零命中（改名 169 / 14 / 1 处）
- [x] 接线阶段（Task 1）只改名、不改数值；全仓 58 个 `var()` 引用零缺失（无样式丢失风险）
- [x] `--seg` 与 iframe `--kw-*` 在接线阶段未被误改

## 硬编码按档收敛

- [x] 字号：档内等值 156 处已换 `var()`；档外 **39 处**（含发现并归档的 `11px × 28`）按归档表处理，`index.css` 中已无裸 `font-size: Npx`
- [x] 间距：按归档表收敛完成（596 个值改写），仅剩登记的例外（2px 亚间距、≥48px 页面留白、负值、3 处让位偏移偏差回退）
- [x] 圆角：按归档表收敛完成（52 处改写），仅剩登记的例外（1–5px 微圆角、22/24px WB 原值）
- [x] 颜色：与 token 等值的硬编码零命中（`#f2f2f2`/`#f7f7f7`/`#e6e6e6`/`#ffffff`/`#1470b4`/`#d9822b`/`#f64041`/`#0cbf5b`）
- [x] 文字色：`rgba(0,0,0,.7)` 零命中（4 级已收为 3 级）；另有 5 处 hover 描边从文字色档改到 `--text-faint`
- [x] 遮罩：仅存 `--overlay` 一档（图片预览沉浸态 72%、删除钮 scrim 55%/78% 已登记例外）
- [x] 分类调色板：`--cat-1..6` 已建立（亮/暗双套），`--seg` / `comp-*` / `cu-seg-*` / `.timeline-span` 共 20 处改为共用；`#d9822b` 换色相为 `--cat-5 #e06c3a`
- [x] `--kw-*` 的值已对齐宿主 token（亮 4 处 + 暗 5 处）
- [x] 时长：散值已收敛为 3 档 + 循环动画例外；`cubic-bezier(0.33, 1, 0.68, 1)` 零命中（时长与 z-index 真违例双双归 0）
- [x] z-index：按映射表替换完成（26 处）；`.toast-stack` 为 `--z-toast`（修正：此前与模态同为 100，会被盖住）
- [x] `index.css` 中被 `color-mix` 覆盖的死硬编码已删除（实际 4 行）
- [x] 例外项全部登记到 `docs/design-tokens-migration.md`（37 条白名单条目，各带 reason）
- [ ] 归档后**无「变差」**：按钮/列表行/chip 的 padding 观感正常、标题层级未塌陷
  - **需人工确认**：过挤处已按「实测偏差处理」回退（36/40/44px 三处让位偏移）；但「观感是否变差」必须肉眼看，见末项

## 共享状态组件

- [x] `src/renderer/state-views.tsx` 存在并导出 `Spinner`/`EmptyState`/`LoadingState`/`ErrorState`
- [x] `EmptyState` 有可选动作槽位（`action`，已用于专家页/定时任务/模型菜单/产物面板四处 CTA）
- [x] 5 套 spinner 合并为一个组件；`index.css` 中旧 spinner 类与 `@keyframes` 已删除
- [x] 13 种空态类名在 `*.tsx` 与 `index.css` 中均零命中（共替换 87 处旧状态类）
- [x] 错误态 `.settings-error`/`.ws-error`/`.save-space-error` 的 JSX 引用已收敛
- [x] 无新增同类类名（新状态一律用 `.state-*` / `.spinner`）

## 状态语义正确性（本轮实质修复）

- [x] 侧栏任务列表：加载中不再显示「暂无历史任务」（改用 `link.kind === "connecting"` 作加载信号）
  - **已知遗留**：`link` 转 ready 到 `listSessions()` 落地之间仍有极短窗口可能显示空态；根治需把 `App` 的 `taskList` 初值改 `undefined`（属边界外，记入迁移文档）
- [x] 技能页：失败时不再「错误条 + 正在读取」并存，且提供重试（`ErrorState onRetry`）
- [x] 模型菜单 / 权限菜单：拉取失败改为就地 `ErrorState` + 重试（不再只弹 toast、不再永久停在「正在读取…」）
- [x] 专家市场页：区分「未就绪 → Loading / 失败 → ErrorState / 过滤无结果 → 无匹配」，不再把失败显示成「搜索无结果」
- [x] 上述四处的「加载 / 空 / 失败」三态由不同条件驱动，不再共用 `length === 0`

## 全局交互基础面

- [x] 主要可交互类均有 `:active` 按下态（覆盖 **25 个类**，集中在文件末尾统一块）
- [x] 按下态只动 `transform` / `opacity` / 背景色（背景色切换非过渡，不触发布局），时长取自 `var(--dur-fast)`
- [x] 缺失的禁用态已补（实缺 5 个类：`.bar-btn`/`.entry-icon-btn`/`.ws-item`/`.ws-action`/`.provider-select-trigger`；另补 `.composer-card textarea` 与 `.save-space-input`）
- [x] `prefers-reduced-motion` 有全局兜底块（文件末尾 `*, *::before, *::after`），7 处局部块保留
- [x] 嵌套滚动容器（8 个）已补 `overscroll-behavior: contain`；仅横向条与页面级容器有意未加（已说明）
- [x] 滚动条有全局基线（`scrollbar-width: thin` + `scrollbar-color`，另附 webkit 分支），`.stream` 等主要区域与侧栏风格统一
- [x] `font-weight` 过渡已移除（`.context-chip`，同时去掉 `:hover` 的字重变化）
- [x] 3 处漏配的 Esc 已补（`plus-menu.tsx` / 侧栏 space-menu / `.cu-popover`），且未借机抽共享 hook

## 机械校验

- [x] `scripts/check-design-tokens.ts` 存在且可跑
- [x] 白名单机制可用（改用 **snippet 锚定**，不再因行号漂移失效；并新增「白名单条目未命中」告警），输出区分「真违例 / 白名单命中 / 豁免 / 白名单未命中」
- [x] `package.json` 有 `check:tokens`，且 `check` 已包含它（typecheck + check:deps + check:tokens）
- [x] 造一条新硬编码（`color: #ff0000`）能被报出且退出码非零（实测 857→858，精确定位到行）
- [x] 当前代码跑出「真违例 0」

## 无回归与归档

- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（扫描 256 文件）
- [x] `npm run check:tokens` 通过
- [x] `npm test` 全绿（**实际基线 95 文件 / 1711 用例**）
- [x] `docs/design-tokens-migration.md` 存在，含映射表 + 归档统计 + 例外登记表（每条带语义与原因）+ 已知遗留问题
- [x] `DESIGN.md` 已加 §10「本轮落地范围与已知例外」（含 §4 的「共享组件待建 → 已建成」订正）
- [ ] dev 手工走查 6 个主界面（首页/对话页/侧栏/产物面板/设置/专家页）无视觉回归
  - **受阻未完成**：本沙箱起 Electron 被系统权限拦截（`sRGB Color Space Profile.icm`），且已有一个 dev 实例持单实例锁。
  - 替代验证已做：`npm run build` 成功、产物 CSS（239.5 kB）含全部 token、58 个 `var()` 引用零缺失、关键层级（toast 200 > 模态 100）与四态（`:active` 38 处 / `:disabled` 49 处）代码层复核。
  - **待人工确认清单见 `docs/design-tokens-migration.md` §6**，重点：① 全屏态下左右两个开关是否可点（层级从「高面板一档」变为同档靠 DOM 序）；② 11px→12px 的 meta 小字是否显松；③ `.stat-value` 20→30px；④ 问卷卡圆角 24→16 是否偏方；⑤ 卡片/面板内边距普遍 −2~−4px 后是否过挤
- [x] 未改动任何业务逻辑（daemon/core/shared/契约零 diff；`src/renderer` 的改动均为样式与状态呈现）
