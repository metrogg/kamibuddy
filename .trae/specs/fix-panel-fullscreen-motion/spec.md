# 修复右侧面板全屏：补动效 + 收起后残留全屏态 Spec

## Why

2026-09-19 用户实测反馈两条，第三条是同源的：

1. **全屏切换没动效**（瞬切）；
2. **全屏里收起面板，再展开又回到全屏** —— 用户得先手动退出全屏才能正常用；
3. （同源、用户没提但一并修）全屏里切到任务诊断 / 引用来源：那两个面板没有全屏形态，
   却继承了全屏位 —— 旧实现下容器宽被强制归零，面板直接看不见。

**根因**（逐条定位，非推测）：

- ① 三个因素叠加，任一条都足以瞬切：
  - [index.css:4255-4265](file:///d:/DongProject/kamibuddy/src/renderer/index.css) 的
    `.preview-panel.fullscreen` 自己声明了 `transition: none`（与同文件 `.preview-panel`
    基类的 `transition: width` 直接打架 —— 基类那条注释恰好写着「全屏切换需要」）；
  - 同一条规则写 `left: 0` + 内联宽被摘掉（`width: auto`）：**auto 不可插值**，
    两端没有可过渡的值对；
  - `.panel-slot[data-fullscreen="true"] { transition: none }`：容器在全屏时瞬间归零，
    连让位那一段也没有。
- ② `panelFullscreen`（[App.tsx:706](file:///d:/DongProject/kamibuddy/src/renderer/App.tsx)）
  与 `panelOpen` 是两个独立 state，全库只有 `closePreviewPanel`（切会话路径）清它；
  收起按钮只翻 `panelOpen`（[App.tsx:1817-1821](file:///d:/DongProject/kamibuddy/src/renderer/App.tsx)）
  → 再展开时 `fullscreen` 仍是 true，面板直接以全屏形态回来。
- ③ 同上：面板位换人时没人清 `panelFullscreen`，而占用者不是产物面板时它没有意义。

## What Changes

- **全屏改为一条真正可插值的 width 过渡**（`.preview-panel.fullscreen`）：右缘锚定
  `right: 0`、宽度走「`panelWidth` px ↔ `100%`」，左缘因此从停靠位扫到窗口左缘；
  去掉 `left: 0` 与 `transition: none`。覆盖范围不变（absolute 的包含块仍是 `.app`
  → 盖满整个窗口，含左侧栏）。
- **两个方向靠「视觉相位」保住起点，且相位在入场方向必须走渲染期对齐**（`artifact-panel.tsx`）：
  `.fullscreen` 类（盒模型）跟随 `visual`，内联宽度跟随**语义态** `fullscreen` ——
  退出时宽度立刻回到 `panelWidth`（此时面板还是 abspos，过渡照跑），相位到期才摘类
  （摘早了面板已是在流的 440px 盒子，那一帧即终态）；入场则必须让盒模型与宽度值落在
  **同一次提交**里（`if (fullscreen && !visual) setVisual(true)` 渲染期对齐，不能放 effect
  —— 晚一帧时宽度的计算值没变（100% 在 440px 的槽里仍算 440），过渡根本不触发）。
  相位时长 `PANEL_FULLSCREEN_MS = 200`，与 `--dur-base` 对齐（同 `PANEL_EXIT_MS`
  的「TS 侧手抄一份」惯例）。两条都有 Chromium 实证，见「验证」。
- **容器不再在全屏时归零**（`App.tsx` 的面板位 + `index.css` 删掉
  `.panel-slot[data-fullscreen="true"]`）：全屏的面板不在流里，容器保持 `panelWidth`
  → 对话列停在停靠态。否则面板只盖住右缘 440px 的第一帧，对话列已瞬跳成全宽，
  左半边会露出「刚被撑开的对话列」。
- **全屏只对产物面板成立**（`App.tsx` 新增清理 effect）：`!(panelOpen && !taskDiagOpen && !sourcesOpen)`
  时清掉 `panelFullscreen` —— 判据与渲染处的占用优先序（诊断 > 来源 > 产物）同一份，
  收起与换人两条路径都覆盖，修 ② 与 ③。
- `DESIGN.md` §5 受控例外 ③ 订正：全屏就是这条 width 的用途（覆盖整个窗口），
  并把旧注里「`[data-fullscreen="true"]` 停过渡」的说法改掉（它正是根因）。
- 进出同档 `--dur-base`：全屏是同一个盒子的状态切换（面板不离开屏幕），不套 §5.8
  的进出场不对称 —— 与例外 ④（左侧栏折叠）同款。

## 否决方案

1. **保留 abspos 覆盖 + 用 `clip-path` 做「揭开」动画。**
   否掉：clip 只是遮罩，面板内容仍按全宽排版 → 动画两端（入场首帧、退场末帧）
   可见的条带内容会跳变（内容不随宽度重排）；全屏层每帧重绘，面板内含 Monaco / PDF /
   iframe 时代价高；还要新增一条 DESIGN.md 受控例外。
2. **用 `transform: translateX/scale` 滑入滑出（§5 规则 1 的合成属性口径）。**
   否掉：`transform` 不改变布局宽，表达不了「面板铺开 / 收回」这件事本身（本仓库对
   例外 ③④ 的既有结论：这类让位/铺开语义只能动 `width`）；且退场终点与在流停靠位
   对不上，会以一次瞬跳收尾。
3. **只做入场（关键帧动画），退场保持瞬切。**
   否掉：用户报的是「全屏没动效」，两个方向每次切换都发生；只做一半等于把同一处
   观感问题留一半。
4. **让「全屏」只占满主区（侧栏保留、容器宽度接管）。**
   否掉：用户明确选择保留「盖住整个窗口（含左侧栏）」的现状语义。该方案动效最省事
   （容器 width px↔px），但它改的是行为，不是本次要修的问题。

## Impact

- Affected code：[index.css](file:///d:/DongProject/kamibuddy/src/renderer/index.css)（面板位 / 面板 / 全屏三段）、
  [artifact-panel.tsx](file:///d:/DongProject/kamibuddy/src/renderer/artifact-panel.tsx)（视觉相位 + 宽度两源）、
  [App.tsx](file:///d:/DongProject/kamibuddy/src/renderer/App.tsx)（面板位宽度、全屏清理 effect）、
  [DESIGN.md](file:///d:/DongProject/kamibuddy/DESIGN.md)（例外 ③）。
- 不新增 token、不新增 IPC / 事件、不改 reducer；`check:tokens` 0 真违例。
- 无自动化回归护栏：renderer 侧没有 DOM/React 渲染测试（现有 renderer 测试都是纯函数），
  本次不新建测试基建；护栏是下面这次 Chromium 探针 + 用户手测。

## MODIFIED Requirements

### Requirement: 右侧面板全屏切换的动效

原行为：`.fullscreen` 规则自带 `transition: none` + `left: 0`（`width: auto`），
容器在全屏时瞬间归零 —— 进出全屏都是瞬切。

改为：全屏 = 一条可插值的 `width` 过渡（`panelWidth` px ↔ `100%`，右缘锚定），
入场即刻起跑；退场由视觉相位保住起点，收尾那一刻摘类、几何与过渡终点逐像素一致。

#### Scenario: 进入全屏

- **WHEN** 用户点面板头部的全屏按钮（或面板内按 Esc 之外的路径进入）
- **THEN** 面板左缘从停靠位连续扫到窗口左缘（约 200ms），不是瞬间铺满

#### Scenario: 退出全屏

- **WHEN** 用户在全屏下点「退出全屏」或按 Esc
- **THEN** 面板左缘连续收回到停靠位（约 200ms），结束那一帧不变形、不跳动

#### Scenario: 全屏下收起再展开（本次修的 bug）

- **WHEN** 用户在全屏下点「收起产物面板」，随后再点「展开产物面板」
- **THEN** 面板以**停靠态**回来（不是全屏态）；用户不需要先手动退出全屏

#### Scenario: 全屏下切到别的面板

- **WHEN** 用户在全屏下点「任务诊断」或从产物卡跳到「引用来源」
- **THEN** 全屏态被清掉，被打开的面板按停靠态正常显示（不会继承全屏位而看不见）

#### Scenario: 全屏下关掉面板

- **WHEN** 用户在全屏下收起面板
- **THEN** 面板先播完「收回停靠位」这一段（约 200ms）再随容器收 0 一起消失
  （不再是「从全屏态直接消失」；容器与相位同档，收尾那一刻两者同时到位）

## 验证

**Chromium 探针（本仓库 Electron 152.0.7977.76，离屏窗口，布局照抄
`.app / .chat / .panel-slot / .preview-panel` 的 flex + static 槽位结构）**：

| 检查项 | 结果 |
|---|---|
| 停靠态 | `left 760 / w 440 / relative` ✓ |
| 入场逐帧插值 | `440 → 878 → 1143 → 1200`，左缘 `760 → 322 → 57 → 0` ✓ |
| 全屏稳定态 | `w 1200 / left 0`（= 盖满整个窗口）✓ |
| 退场逐帧插值 | `1146 → 663 → 470 → 440`，左缘 `54 → 537 → 730 → 760` ✓ |
| 相位结束摘类前后 | `left 760 / w 440` 两侧完全一致（跳变 = false）✓ |
| 反证：把 `transition` 换回 `none` | 入场 / 退场逐帧插值双双 = false（探针有牙齿）✓ |

**第二条探针**（证明「相位必须渲染期对齐」这一判断，不是顺手写的）：

| 场景 | 逐帧宽度 | 结论 |
|---|---|---|
| 晚一帧切盒模型（= effect 版相位） | `1200, 1200, …` 只有 1 个值 | 瞬跳 ✗ |
| 同一帧切盒模型 + 宽度（= 生产写法） | `494 → 607 → 750 → … → 1200`，12 个值 | 逐帧插值 ✓ |

**门禁**：`tsc --noEmit` 通过；`check-dependency-rules` 通过；
`check-design-tokens` 通过（仅剩白名单例外）；`vitest run` 161 文件 / 2985 用例通过（1 跳过）。

**手测（用户执行）**：全屏进出看动效；全屏里收起再展开应回到停靠态；
全屏里点任务诊断 / 引用来源应正常显示。
