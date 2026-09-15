# Checklist

> 检查时按 spec「明确不做」表：**列出的豁免项不应被改动**，改错了同样是缺陷。
> 本期为 `feat/ui-design-system` 分支第 4 期（收诊断报告「只做 5 件事」的第 5 项）。
>
> **校验日期 2026-09-14**：`npm run check`（typecheck + check:deps + check:tokens）通过、
> `npm test` **95 文件 / 1717 用例全绿**、`check:tokens` 真违例 **0**（白名单仍 77 条、未新增）。
> 扫描文件数 257 → **258**（新增 `use-modal-focus.ts`）。
> **唯一待人工的是"实际观感/交互验收"**（沙箱无 GUI），清单已列在文末与成果文档 §9.6。

## 模态焦点管理

- [x] 新建了共享 hook（`src/renderer/use-modal-focus.ts`），不是在每个模态里各写一遍
- [x] hook 职责齐全：① 打开移入焦点 ② Tab / Shift+Tab **在模态内循环** ③ 关闭**归还**焦点
- [x] 可聚焦元素的选取排除了 `disabled` / `tabindex="-1"` / 不可见元素，且**未硬编码选择器清单**
      （5 道判定：`tabIndex < 0` / `:disabled` / `closest("[inert]")` / `getClientRects().length === 0` /
      `visibility` 为 hidden|collapse）
- [x] **10 个接入点 / 8 个组件**全部接入（**注意口径**：spec 与 tasks 写"9 处"，实为 10 个接入点 ——
      `chat-view.tsx` 有 2 处：save-space 卡 + 图片预览浮层；spec 自己的枚举列表也是 10 项。
      已按实况记入成果文档）
- [x] 权限弹窗**保留**既有安全默认：`risk: "high"` 时焦点落在「拒绝」，Esc 仍视为拒绝
      （聚焦改由 hook 的 `initialFocus` 承接，**旧 effect 里的 `target?.focus()` 已删**，无两处抢焦点）
- [x] 接入时**未产生第二个 Esc 监听**：hook 完全不碰 Esc；各处既有 Esc 原样保留并有逐条说明
- [x] 背景 `inert`：**已实现**（`isolateBackground` 只标最近背板的兄弟，跳过并记录外层已标的；
      并**排除 `.toast-stack`**——否则 `role="status"` 的播报会被 inert 掐掉）
- [x] 未改 `role` / `aria-*` 语义，未改任何视觉值
- [x] **必要支撑改动**（已记录）：`SaveToWorkspaceDialog` 移除 `autoFocus` —— 否则它会赶在 hook 的
      callback ref 之前抢走焦点，hook 记下的"打开源"变成输入框自己，关闭时该输入框已卸载 → **归还失效**
      （恰好是要修的现象）。依据是 React layout 阶段"子先父后"

## 拖拽越界不导航

- [x] `App.tsx` 有 document 级 `dragover` / `drop` 兜底 `preventDefault()`
- [x] **输入卡既有投递照旧生效**：读了 `composer.tsx:250-252` 与 `image-attachments.tsx:250-259`，
      发现输入卡在**不含文件时故意不 `preventDefault`**（放行 textarea 原生插入文本）且两处都无
      `stopPropagation` → 故不能只看 `defaultPrevented`，**必须额外判 `types.includes("Files")`**，
      只兜文件拖放、放行文本拖放
- [x] `main/index.ts` 有 `will-navigate` 守卫：非本应用 URL 一律拦截
- [x] 拦截后走**既有**的外部打开通道（把 `setWindowOpenHandler` 的外链出口抽成 `openExternally(url)`
      两处共用，**未复制两份**）；`isAppUrl` 判据在生产**只放行 `file://` 且路径以 `/renderer/index.html` 结尾**
      （**不能只判 `file:`** —— 否则被拖入的任意文件同为 file:// 会被误放行）
- [x] **诚实标注**：现象未实测（需 GUI），报告未声称"已修复某现象"，只说明补了两道标准防护

## 最小宽度不溢出

- [x] `.app` 已加 `overflow: hidden`（已核实不会裁掉 `position: fixed` 的模态与 toast）
- [x] 产物面板宽度上限**不再是硬编码 800**：`maxPanelWidth = max(340, min(800, innerWidth − 侧栏宽 − 320))`
- [x] 下限 `340` 保留；**拖拽与键盘共用 `clampPanelWidth`** 的既有设计未破坏
- [x] `App.tsx` 注释已同步；**并额外补了 resize 回落**（否则"宽窗口拖到 800 再缩窗"时无人调 setter，
      面板会一直超出视口 → spec 场景会落空）
- [x] 侧栏宽**从 DOM 量而非抄 216**（侧栏收起时不渲染 → 量到 0 恰好正确，避免双写漂移）

## 三处键盘可达性

- [x] `.pending-tip` 的 `onFocus`/`onBlur` 与可聚焦性一致 —— **诊断报告这条判断不准确**：
      React 的 `onFocus` 走 `focusin`（冒泡），子元素「×」获焦时该处理**是会被触发的**，不是死代码。
      故采用**第三条路**：把处理移到内部唯一可聚焦的「×」按钮上，行为逐字不变
      （不加 `tabIndex={0}`＝避免空 tab stop 与新增焦点环视觉值；不删处理＝避免丢掉键盘暂停行为）
- [x] `ViewSwitcher` 下拉支持 Esc 与点击外部关闭，**复用同区既有模式**
      （透明 `.ws-backdrop` 照抄 `model-menu.tsx:157-166`；Esc 照抄其 `62-72`），**无新 CSS**
- [x] 产物条目「双击转正为 tab」有键盘等效入口：**`Shift+Enter`** + `aria-keyshortcuts` + tooltip 文案
      （零视觉变化）。取舍：三个条目本就是 `<button>`，**Enter 已被"预览"（主操作）占用**，
      抢给"转正"会让键盘用户失去预览
- [x] 未为可聚焦元素新增样式 → `check:tokens` 真违例仍为 0

## Esc 层级（Task 4 新发现，已修）

- [x] 修复 `ViewSwitcher` Esc 与全屏 Esc 的冲突：原来前者挂 `window`、后者挂 `document`，
      冒泡顺序是 `document → window` → 全屏时按 Esc 会**同时**关下拉并退全屏
- [x] 改法：ViewSwitcher 的 Esc 改为 **`document` + capture** + 命中时 `stopPropagation()`，
      只关最内层
- [x] **回归确认**：由 `if (!open) return;` 保证 —— 下拉未打开时该 capture 监听**根本不注册**，
      全屏 Esc 照旧生效

## 豁免项未被误改

- [x] **未新增右键菜单**（属产品需求待定，不在本期）
- [x] 未引入 OS 沙箱 / 危险命令检查器（属权限模块另有 spec）
- [x] 未动完整虚拟滚动（第 3 期已判风险）
- [x] 未做模态的视觉重设计（本期只补行为语义）
- [x] **未改任何视觉值**（颜色/间距/圆角/阴影/字号零 diff；本期只加 `overflow`、`inert`、
      事件处理与 clamp 逻辑）

## 无回归与文档

- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（扫描 258 文件）
- [x] `npm run check:tokens` 通过（真违例 **0**，未新增白名单）
- [x] `npm test` 全绿（95 文件 / 1717 用例）
- [x] `DESIGN.md` **§7「无障碍要求」**已补：第 3 条扩容为"移入 + Tab 陷阱 + 归还缺一不可"
      （`inert` 为加强项、`.toast-stack` 除外），并注明 `useModalFocus` 是**唯一入口**；
      新增第 10 条"`dragover`/`drop` 必须拦截 + 外部导航必须走 `will-navigate`"
      （就地加固而非新增重复条目，避免同一要求两份表述漂移；未改 §7-§9 编号，因外部文档在引用）
- [x] 成果文档已记本期（`docs/design-tokens-migration.md` **§9**，9.1–9.8 含**四条诚实标注**：
      拖拽现象未实测 / hook 无自动化测试 / `.pending-tip` 误判已修正 / `inert` 只 8 处拿到）
- [x] **人工验收清单已列出**（成果文档 §9.6，7 条可直接照做）
- [x] 已报告本期**未做**项与理由（右键菜单＝产品需求待定；connectors 两表单无 Esc＝补属新增行为；
      诊断页表格行键盘可达＝归后续）

## ⏳ 待人工验收（沙箱无 GUI，无法自测）

- [ ] ① 权限弹窗 Tab 是否在弹窗内循环（不跑到背后）、关闭后焦点是否回原处
- [ ] ② 窗口拉到最小（900）是否还横向溢出
- [ ] ③ **拖文件到消息流区域是否还导航**（**本轮唯一无法自测的现象**）
- [ ] ④ 视图切换下拉按 Esc 是否关闭，且**全屏时只关下拉、不再一起退全屏**
      （再按一次 Esc 才退全屏）
- [ ] ⑤ 问卷弹窗打开后**首个落点是首选项**（不是「全部跳过」）
- [ ] ⑥（顺带）折叠动画未变成"瞬间消失"（第 3 期 `allow-discrete` 的验收点）
