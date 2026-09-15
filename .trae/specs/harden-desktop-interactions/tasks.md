# Tasks

> **并行度**：Task 1（新文件）与 Task 3（`App.tsx` + `main/index.ts`）文件不重叠，**可并行**；
> Task 2（9 处模态，含 `chat-view.tsx`）与 Task 4（含 `chat-view.tsx` / `index.css` /
> `artifact-panel.tsx`）**有文件重叠，必须串行**；Task 5 收尾依赖全部完成。
>
> **基线（本期开始前）**：`npm run check` 通过、`npm test` 95 文件 / 1717 用例全绿、
> `check:tokens` 真违例 0。任何 Task 完成后这三项不得退化。

- [x] Task 1: 共享模态焦点管理 hook（新建）
  - [x] SubTask 1.1: 新建 `src/renderer/use-modal-focus.ts`，导出一个 hook，返回一个 ref
    供模态容器（`.permission-card` / `.settings-card` 等**卡片本身**，不是 backdrop）挂载。
    它负责三件事：
    - **打开时移入焦点**：优先用调用方指定的元素（如权限弹窗高风险时的「拒绝」），
      否则取容器内**第一个可聚焦元素**
    - **Tab 焦点陷阱**：keydown 监听 Tab / Shift+Tab，在容器内的可聚焦元素之间**循环**
      （首尾回绕），**不落到背后界面**
    - **关闭时归还焦点**：挂载时记录 `document.activeElement`，卸载时若该元素仍在文档中则 `focus()` 回去
  - [x] SubTask 1.2: **背景隔离**：实现时找到模态的 `.modal-backdrop`（或 `.ex-modal-mask`）祖先，
    给它**除自身与模态链之外的兄弟节点**加 `inert`（卸载时移除）。
    **若这一步需要动 App 层状态或引发大改，就跳过并在报告里说明**（Tab 陷阱已能挡住键盘跑到背后，
    `aria-modal="true"` 也已声明读屏语义，`inert` 是加强而非必需）
  - [x] SubTask 1.3: **可聚焦元素的选取**要排除 `disabled` / `tabindex="-1"` / `inert` 后代 /
    不可见元素（`offsetParent === null` 之类）；**不要**硬编码选择器清单
  - [x] SubTask 1.4: 验证：`npm run typecheck` + `npm test`（本期基线 1717）；
    报告 hook 的签名与三条行为的实现方式
  - **实测结果**（`src/renderer/use-modal-focus.ts`，约 180 行）：返回 **callback ref**（不是 ref 对象）
    —— 关键理由：`chat-view.tsx:276` 的图片预览浮层在 `UserBubble` 里条件渲染，
    若用 ref 对象则 hook 的 effect 只在组件挂载时跑一次（那时 `ref.current` 还是 null），
    这类"先挂组件、后挂节点"的模态会被整段漏掉；callback ref 在节点真正挂上时才跑，正好对齐"模态打开"。
    - ① 移入：`initialFocus()` 优先，返回 null 或已 `isConnected === false` 则退回容器内首个可聚焦元素
    - ② 陷阱：**keydown 拦截**（挂 `document`——挂容器会漏"焦点已不在容器内"的情形），
      不用哨兵元素（会在卡片里插可聚焦空节点、污染 DOM）；新增模块级 `openModals` **栈**，
      Tab 只由栈顶处理 —— 解决真实存在的嵌套（`AddModelDialog` 渲染在 `.settings-card` 内部，
      外层 `querySelectorAll` 会穿透进内层）
    - ③ 归还：节点挂上时记 `document.activeElement`（此刻还在触发按钮上），摘下时若
      `instanceof HTMLElement && isConnected` 才 `focus()`；顺序**先撤 inert、再还焦点**
      （要还给的按钮往往正是被标 inert 的那个）
    - 可聚焦选取 **5 道判定**（不写死选择器）：`tabIndex < 0`（一举覆盖显式 -1、默认不可聚焦、禁用控件）/
      `:disabled` 伪类 / `closest("[inert]")` / **`getClientRects().length === 0`**
      （**不用 `offsetParent`**——fixed 定位元素的 offsetParent 也是 null，而固定定位恰是模态常态）/
      计算样式 `visibility` 为 hidden|collapse
    - **`inert` 做了**（SubTask 1.2 未跳过）：只标背板的**兄弟**、跳过并记录外层模态已标的（避免内层摘下时误清外层）、
      清单挂上时一次性捕获
    - **hook 完全不碰 Esc**（遵守 2.2）：权限弹窗「Esc 视为拒绝」、设置卡 Esc 关闭都保持原样
  - **诚实标注**：**该 hook 没有自动化测试** —— `vitest.config.ts` 是 node 环境、仓库未装
    jsdom/happy-dom 也无 testing-library、`include` 只收 `src/**/*.test.ts`，DOM/焦点行为在本仓库无测试基建。
    三条行为只能靠 GUI 人工验收。未为凑测试去加依赖或改配置（超范围）。
  - 已知局限：正向 `tabindex`（1、2…）不特殊排序（本项目 9 处模态都没用，属反模式）；
    零可聚焦元素的模态会让 Tab 被吞（焦点原地不动、不落到背景），现有 9 处都不触发

- [ ] Task 2: 接入 9 处模态（依赖 Task 1）
  - [ ] SubTask 2.1: 逐个接入 `useModalFocus`（**每个模态都要先读它的现有焦点/Esc 逻辑，不要覆盖**）：
    1. `src/renderer/permission-dialog.tsx`（`role="alertdialog"`）—— **保留**它既有的
       「高风险默认聚焦拒绝」与「Esc 视为拒绝」；把 `denyRef`/`allowRef` 的聚焦改由 hook 的
       "指定首选元素"承接（**不要出现两处抢焦点**）
    2. `src/renderer/questionnaire-dialog.tsx`（阻塞式，daemon 在 await）
    3. `src/renderer/chat-view.tsx` 的 save-space-card（约 1234 行）与其另一处 dialog（约 276 行）
    4. `src/renderer/automations-view.tsx` 的 auto-form-card（约 517 行）
    5. `src/renderer/connectors-view.tsx` 的 mcp-form-card（约 393 行）与 mcp-editor-card（约 546 行）
    6. `src/renderer/experts-view.tsx` 的 ex-modal（约 331 行）
    7. `src/renderer/settings/settings-view.tsx` 的 settings-card（约 99 行）
    8. `src/renderer/settings/models-section.tsx` 的 add-model-card（约 759 行）
  - [ ] SubTask 2.2: **注意既有 Esc 的重复**：多个模态已有自己的 Esc 处理（如权限弹窗、
    设置卡）。
    接入 hook 时**不要新增第二个 Esc 监听**造成双触发；若发现既有 Esc 与 hook 冲突，
    保留既有行为、hook 只管焦点（在报告里说明每个模态的实际情况）
  - [ ] SubTask 2.3: **不改任何视觉值与结构语义**（`role` / `aria-*` 保持，除非补 `inert`）
  - [ ] SubTask 2.4: 验证：`npm run typecheck` + `npm test`；
    报告每个模态的接入方式与"既有 Esc/焦点逻辑"的处理（表格逐个列出）

- [x] Task 3: 拖拽越界防护（可并行）
  - [x] SubTask 3.1: **renderer 兜底**：在 `src/renderer/App.tsx` 加 document 级
    `dragover` 与 `drop` 的监听，对**非投递区**调用 `preventDefault()`
    （阻止 Chromium 的默认"导航到被拖入的文件"行为）。
    **关键**：必须**不干扰**输入卡既有的投递逻辑（`composer.tsx` / `image-attachments.tsx`
    的局部 `onDrop` 处理必须照旧生效）——实现时先读它们，确认事件顺序与 `stopPropagation` 情况，
    在报告里说明为什么兜底不会吃掉输入卡的投递
  - [x] SubTask 3.2: **main 守卫**：`src/main/index.ts` 加 `will-navigate` 处理：
    非本应用 URL 的导航一律 `event.preventDefault()`，并走**既有的外部打开通道**
    （与 `setWindowOpenHandler`（约 199 行）同一套外部打开逻辑，不要另造一套）
  - [x] SubTask 3.3: 诚实标注：**该现象本轮无法实测**（需要 GUI 拖拽）。
    报告里要写清：这是补两道标准防护（任何 Electron 应用都该有），
    前提（无 drop 拦截、无 will-navigate）是 grep 实证的；**不要声称"已修复某现象"**
  - [x] SubTask 3.4: 验证：`npm run typecheck` + `npm test`；报告两处改动的 diff 摘要
  - **实测结果**（`App.tsx` 新增一个 effect / `src/main/index.ts` 新增 `will-navigate`）：
    - **兜底的关键判断**：读了 `composer.tsx:250-252` 与 `image-attachments.tsx:250-259` 后发现
      —— 输入卡的 `onDrop` 在**含文件时** `preventDefault`，**不含文件时直接 return 且故意不 preventDefault**
      （放行 textarea 原生插入拖入的文本），且两个 handler **都没有 `stopPropagation()`**。
      故不能只看 `defaultPrevented`：必须额外判 `dataTransfer.types.includes("Files")`，
      **只兜文件拖放、放行文本拖放**——这是本次实现与"只判 defaultPrevented"的关键差别
    - 顺序依据：React 合成事件委托在 `#root`，它是 `document` 的后代 → document 级监听一定在输入卡处理**之后**
    - main：把 `setWindowOpenHandler` 里的外链出口抽成 `openExternally(url)` 两处共用
      （**未复制两份**，理由：两个调用点口径必须一致，分叉会让"防钓鱼"策略漂移）；
      `isAppUrl` 判据 = dev 放行 dev server 同源、生产**只放行 `file://` 且路径以 `/renderer/index.html` 结尾**
      （**不能只判 `file:`** —— 否则被拖入的任意文件同为 file:// 会被误放行，守卫就白设）
    - `will-navigate` 只对**主帧**触发，预览面板的 `http://127.0.0.1:*` iframe 不受影响，无回归
  - **诚实标注**：**该现象本轮未实测**（需 GUI 拖拽）。准确说法是"补了两道任何 Electron 应用都该有的
    标准防护"，两个前提（渲染层无全局 drop 拦截、main 无 `will-navigate`）是 grep 实证的，
    **不声称"已修复某现象"**
  - **未决（如实记录）**：① **iframe/widget 上的拖放**不会冒泡到父 document，兜底管不到；
    iframe 自身的导航走 `will-frame-navigate`（未加，spec 也未要求）——未验证；
    ② dev 模式下 `isAppUrl` 按 origin 放行（保留 Vite 整页重载），dev/prod 不对称是有意的但未实测；
    ③ `shell.openExternal` 收到 `file://` 时的实际表现未实机验证（为与既有 `setWindowOpenHandler`
    保持完全一致，未加额外协议过滤）

- [x] Task 4: 最小宽度不溢出 + 三处键盘可达性（依赖 Task 2，因 `chat-view.tsx` 重叠）
  - [x] SubTask 4.1: `index.css` 给 `.app`（约 96 行）加 `overflow: hidden`
    （它现在只有 `position: relative; display: flex; height: 100vh`）
  - [x] SubTask 4.2: 产物面板宽度上限**动态化**：`src/renderer/artifact-panel.tsx` 的
    `Math.min(Math.max(startWidth + delta, 340), 800)`（约 829 行）与键盘调宽（约 844 行）
    共用同一份 clamp —— 把上限 `800` 换成**按窗口可用宽计算**（如
    `Math.max(340, Math.min(800, window.innerWidth - 侧栏宽 - 主区最小宽))`）。
    **下限 340 与"拖拽/键盘同一 setter"的既有设计保持不变**；
    `App.tsx` 的初始宽度 `440`（约 495 行）与注释也要同步（注释里写着 `[340, 800]`）
  - [x] SubTask 4.3: `chat-view.tsx` 的 `.pending-tip`（约 899 行）：它挂了 `onFocus` / `onBlur`
    但元素是 `<span>` **不可聚焦**，两个处理永不触发（死代码）。
    **二选一并在报告里说明理由**：让它可聚焦（`tabIndex={0}` + 样式上给出焦点环），
    或移除死处理。**注意 `index.css` 的 `.pending-tip` 若要加可聚焦样式，必须走 token**
  - [x] SubTask 4.4: `artifact-panel.tsx` 的 `ViewSwitcher` 下拉（约 500–547 行）：
    它现在**无 backdrop、无 mousedown-outside、无 Esc**，只能靠"选中某项"或再点触发器关闭。
    补 Esc + 点击外部关闭（与该文件/同区其它弹层的既有做法一致，**不要另造一套**）
  - [x] SubTask 4.5: `artifact-panel.tsx` 的"双击条目转正为 tab"（约 577 / 622 / 729 行）：
    该语义**只有鼠标双击可达**。补一个键盘等效入口（如条目获得焦点时按 Enter，
    或条目内加一个可见的小按钮）。**选成本最低且不破坏既有视觉的方案**，说明取舍
  - [x] SubTask 4.6: 验证：`npm run check`（含 `check:tokens`，真违例必须仍为 0）+ `npm test`；
    报告 4.1–4.5 每条的改动与理由
  - [x] SubTask 4.7（Task 2 上报，必须修）: 问卷弹窗默认落点
  - [x] SubTask 4.8（Task 2 上报）: `use-modal-focus.ts` 的 `inert` 排除 toast 容器
  - **实测结果**：
    - **4.1**：`.app` 加 `overflow: hidden`（附"为什么"注释）。已核实 `.modal-backdrop` / `.toast-stack`
      都是 `position: fixed`、`.app` 无 transform/filter → **不会裁掉全局模态与 toast**；
      `preview-panel.fullscreen`（`inset: 0`）也不受影响
    - **4.2**：新增 `maxPanelWidth()` / `clampPanelWidth()`（artifact-panel 约 770–802 行）。公式：
      `maxPanelWidth = max(340, min(800, innerWidth − 侧栏宽 − 320))`，拖拽与键盘共用。
      **侧栏宽从 DOM 量而非在 TS 里抄 216**（侧栏收起时不渲染 → 量到 0 恰好正确；抄常量会双写漂移）；
      主区最小宽取具名常量 `MAIN_MIN_WIDTH = 320`（900−216−320=364，面板压到 340 时三者恰好铺满）。
      **额外补了一个 resize 回落**（`App.tsx` 约 544–553）：否则"宽窗口把面板拖到 800 再缩小窗口"
      这一刻没人调 setter，面板会一直超出视口 → spec 的"面板被压缩而非挤出主区"会落空
    - **4.3**：**诊断报告这条判断不准确** —— React 的 `onFocus` 走 `focusin`（**冒泡**），
      所以此前子元素「×」获焦时那个 `<span>` 的处理**是会被触发的**，`paused` 确实置位（不是死代码）。
      故采用**第三条路**：把 `onFocus`/`onBlur` 移到它内部唯一可聚焦的「×」按钮上，行为逐字不变。
      不加 `tabIndex={0}`（会造一个"聚焦后除暂停轮播无事可做"的空 tab stop，且要给非 button 补焦点环＝新增视觉值）；
      不删处理（会丢掉键盘用户的暂停行为＝回归）。`index.css` 未改
    - **4.4**：复用同区弹层既有模式 —— 透明 `.ws-backdrop`（照抄 `model-menu.tsx:157-166`）
      + `window` 级 Esc（照抄 `model-menu.tsx:62-72`），层级关系与既有菜单一致，**无新 CSS**
    - **4.5**：方案 = **条目聚焦后 `Shift+Enter` 转正** + `aria-keyshortcuts` + tooltip 追加文案
      （纯文案，零视觉变化）。理由：三个条目本就是 `<button>`，**Enter 已被"预览"（主操作）占用**，
      抢给"转正"会让键盘用户失去预览；已排除"个别浏览器仍补发 click"的风险
      （`openPreview` 对已存在的 tab 是幂等的）
    - **4.7**：新增 `firstOptionRef` + `useModalFocus({ initialFocus: () => firstOptionRef.current })`，
      ref 挂在 `options.map` 的首个 `.questionnaire-option`（已核实：容器内文档顺序首个可聚焦元素
      确实是头部「全部跳过」，正是要绕开的）
    - **4.8**：**改了** —— `isolateBackground` 的兄弟循环加跳过 `.toast-stack`。
      理由：`role="status"` 是实时播报区，**inert 会把它移出无障碍树、连播报一起掐掉**，
      而后台任务失败这类提示恰恰可能在模态开着时出现；且 toast 高悬在模态之上（`--z-toast`），
      不属于"模态背后的界面"
  - **验证**：`npm run check` 通过（`check:tokens` 真违例 **0** / 白名单 77 / 豁免 107）、
    `npm test` **95 文件 / 1717 用例**，与基线一致
  - **新发现（未决，由 Task 5.7 处理）**：`ViewSwitcher` 的 Esc 挂 `window`（照既有约定）且未 `stopPropagation`，
    而 ArtifactPanel 的全屏 Esc 挂 `document` → **全屏时打开视图下拉再按 Esc 会同时关闭下拉并退出全屏**，
    违反「Esc 只关最内层」。这是本期新增行为引入的层级冲突，需修

- [ ] Task 5: 校验与文档
  - [ ] SubTask 5.1: `npm run typecheck && npm run check:deps && npm run check:tokens` 三项通过
  - [ ] SubTask 5.2: `npm test` 全绿（基线 95 文件 / 1717 用例）
  - [ ] SubTask 5.3: 在 `DESIGN.md` 无障碍一节（§8 附近，先看实际编号）补两条硬要求：
    ① 凡 `aria-modal="true"` 的模态必须有**焦点陷阱 + 焦点归还**（背景 `inert` 为加强项）；
    ② 页面的 `dragover`/`drop` 默认行为必须被拦截，外部导航必须走 `will-navigate` 守卫
  - [ ] SubTask 5.4: 成果文档记本期（承接 `docs/design-tokens-migration.md` 的编号继续，
    或新建一节）：三条硬伤的处理 + **诚实标注**（拖拽那条现象未实测、`inert` 是否落地）
  - [ ] SubTask 5.5: **人工验收清单**（沙箱无 GUI，需你确认）：① 权限弹窗 Tab 是否在弹窗内循环；
    ② 关闭后焦点是否回到原处；③ 窗口拉到最小是否还溢出；④ 拖文件到消息流区域是否还导航；
    ⑤ 产物面板视图切换下拉按 Esc 是否关闭
  - [ ] SubTask 5.6: 报告本期**未做**的项与理由（右键菜单属产品需求待定、诊断页表格行的键盘可达归后续）

# Task Dependencies

- **第一轮（已完成）**：Task 1（新建 `use-modal-focus.ts`）、Task 3（`App.tsx` + `main/index.ts`）
- **第二轮**：Task 2（9 处模态；含 `chat-view.tsx`）—— 依赖 Task 1
- **第三轮**：Task 4（`index.css` + `artifact-panel.tsx` + `chat-view.tsx`）—— 必须排在 Task 2 之后
  （两者都碰 `chat-view.tsx`）
- **第四轮**：Task 5 依赖 Task 1–4 全部完成
