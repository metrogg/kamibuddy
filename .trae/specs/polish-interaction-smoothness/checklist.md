# Checklist

> 检查时按 spec「明确不做」表：**列出的豁免项不应被改动**，改错了同样是缺陷。
> 本期为 `feat/ui-design-system` 分支第 6 期（交互顺滑度与质感打磨；迁移文档记作 spec #7）。
>
> **校验日期 2026-09-14**：`npm run check`（typecheck + check:deps + check:tokens）通过、
> `npm test` **95 文件 / 1717 用例全绿**、`check:tokens` 真违例 **0**（白名单仍 77 条、未新增）、
> `npm run build` 成功且产物含 MiSans woff2。
> **唯一待人工的是观感验收**（沙箱无 GUI），11 条清单见文末与迁移文档 §11.5。

## 字体必须实际生效

- [x] `index.css` 有两条 `@font-face`（400 / 600，`font-display: swap`，指向仓内 woff2）
- [x] `@font-face` 的位置在 `@import` **之后**（`@import` 仍在最前）
- [x] `--font-body`（`tokens.css`）**是字体栈的唯一真源**，body 改为 `font: 14px/1.6 var(--font-body)`
- [x] 字体栈里 `"MiSans"` 位于 `"PingFang SC"` **之后**、`"Segoe UI"` **之前**
- [x] **`npm run build` 后产物含两个 woff2**：
      `out/renderer/assets/MiSans-Regular-EjI9NiHY.woff2`（483904 B）、
      `MiSans-Semibold-DclYHP1t.woff2`（489152 B）；字节数与源文件一致
- [x] **实测确认字体生效**（不是"声明了就算完"）：Electron 探针加载**生产产物**并复现生产 CSP →
      `FontFace.status === "loaded"`、`document.fonts.check("400/600 14px MiSans")` 均为 true；
      **且宽度度量与雅黑不同**（MiSans 600 = 195.18px vs 雅黑 600 = 196.32px）
      → 证明命中真实 Semibold 字形而非回退/合成加粗
- [x] Windows 上 `font-weight: 600` 用真实字重（不再落到微软雅黑合成加粗）
- [x] 路径无需特殊处理（`electron.vite.config.ts` 的 renderer `root` 就是 `src/renderer`，
      相对 `url()` 被 vite 正常解析并 emit 为哈希资源）
- [x] **一处漏网已上报**（不在本期改动范围）：`widget-view.tsx` 的 iframe 内字体栈
      （srcdoc 是独立 document，`@font-face` 不级联，其"与宿主一致"的注释已过期）

## 滚动条不改变内容宽度

- [x] `.stream` / `.home` / `.settings-body` / `.skills-body` / `.sidebar-scroll` 有 `scrollbar-gutter: stable`
- [x] **未**给 `.thinking-body` / `.user-bubble` / `.pop-menu` 这类窄容器加该属性
      （判断依据已写进注释：只给"父不滚、内容宽由自身决定"的页面级容器加）
- [x] 对话首次超过一屏时，消息列**不横向重排**

## 整页视图切换有入场

- [x] `.settings` / `.skills` 整页壳有入场（一条 `page-in` **覆盖 4 个视图**，未逐视图各写一份）
- [x] 入场与 `.settings-card` **同族**（同为 `transform` + `opacity`、同 token；只去掉 `scale`
      —— 整页壳不是浮层，整页缩放会让边框与滚动条一起闪）；不写 `fill-mode`（避免常驻 transform
      变成 fixed 后代的包含块，`.stream` 有同坑先例）
- [x] 首页（`.home`）复用同一条 keyframes
- [x] **对话页整壳入场「刻意不做」**（**如实标注，非遗漏**）：给 `.chat` 加入场等于
      "每次从设置/统计返回长对话都整页上滑淡入"，而这正是本期 4.3 的 Requirement 要消掉的效果，
      只是抬高了一层。Task 3 据此做了取舍（`.home` 做、`.chat` 不做）
- [x] 时长缓动取自 token；未新增硬编码时长

## 结构已知的等待用骨架屏

- [x] `state-views.tsx` 新增具名导出 `Skeleton`（`width`/`height`/`radius` 走 props）
- [x] **不带扫光/脉冲动画**（理由：全站唯一的扫光 `.text-shimmer` 语义是"内容正在生成"，
      骨架也扫光会让两种等待看起来一样；同时换来 reduced-motion 零损失）
- [x] **底色不是 `--bg-raised`**——`#f7f7f7` 铺在侧栏底 `#f2f2f2` 上只差 5 个灰阶、**骨架等于没画**；
      改用 `color-mix(in srgb, var(--text) 8%, transparent)`（在三种底上都读作占位灰，不新增 token）
- [x] 侧栏任务列表用骨架，**行高对齐**：复用真行类名 + `minHeight: "1lh"`
      → 行盒 = 13 × 1.6 = 20.8px、行高 = 20.8 + 4 + 4 = **28.8px**，与真行逐像素相同，
      **且行高将来变了骨架自动跟上**（不手抄数值）
- [x] 文档预览接线 **3 处**（`office-docx` / `office-xlsx` / `pdf-preview`）：
      docx/pdf 是 A4 比例的"白纸"；**xlsx 刻意不是纸**——它是满区滚动网格（无纸无留边），
      套 A4 白纸反而与到达后的表格不同尺寸
- [x] **`office-preview` 的 Suspense fallback「刻意不接」**（**如实标注**）：它等的不是文档内容形状，
      而是**渲染器 chunk 本身**，而"纸多宽、格子多高"这些几何常量正属于被等待的那个 chunk ——
      抄一份必然漂移（撞 AGENTS.md §4 防重复）。真正长的那段等待已在三处子组件里换成形状骨架
- [x] **未在各处自建骨架**（都走 `state-views.tsx` 的 `Skeleton`）

## hover 不得改变布局

- [x] `.task-item-body` **不预留让位宽度**；hover 时 `.task-item-meta` 降到 `opacity: 0`
      **保留占位** → 标题可用宽两态逐像素相同（**订正**：曾用 `padding-right: 72px` 常驻让位，
      叠加常驻时间戳后标题只剩 ~20px，一个字都显示不下）
- [x] 空间组头同口径：删掉 `padding-right: 48px`——操作钮本就是普通 flex 子项
      （`.space-group-actions` 只切 opacity/visibility，不脱离排版），那 48px 是**第二重让位**
- [x] 让位后仅用 `opacity` / `visibility` 表达操作钮显隐（进入 `--dur-base` / 离开 `--dur-fast`，
      同 `.entry-toolbar` 既有口径）
- [x] **副作用已消除**：不再有常驻让位，于是当时为救被压到 ~58px 的输入框而加的
      `.task-item-body:has(> .task-rename-input)` 例外**一并删除**（已退化为同值的空规则）
- [x] 划过侧栏行时标题可用宽度不变、省略号位置**不跳**

## 输入法组合期间不重算补全

- [x] `autocomplete.tsx` 的 `onChange` 有 `composingRef` 守卫；新增 `onCompositionStart/End`
- [x] **复用既有先例**（`experts-view.tsx` 的 `composingRef`），未另造机制
- [x] 处理了一个细节：**不能指望浏览器在 `compositionend` 之后补的那个 `input` 兜住最后一次**
      → 在 `compositionend` 时用上屏后的最终文本算一次
- [x] 与既有 `ime-guard` 的 `bind` 链式并接（两套守卫各管一件事：一个管 Enter 是否吞、
      一个管组合期间不重算）；`shouldSwallowNow` / `onKeyDown` 未动
- [x] 中文拼音检索时补全菜单不逐键重建

## 侧栏折叠有过渡（新增 width 受控例外）

- [x] 折叠/展开有宽度过渡（`--dur-base` + `--ease-out`）
- [x] **条件挂载的坑已解决**：改用**方案 A**（常驻 DOM + `.app[data-sidebar]` + `transition`）。
      选 A 而非 B（`animation`）的理由：B 只解决展开方向，**收起方向会随卸载消失**，
      而 Requirement 要求"折叠不再瞬跳"——两侧都要平滑动
- [x] 首屏不播动画（初始态即终态，transition 只在属性变化时触发）
- [x] **收起后的 Tab 序 / a11y 移出**：折叠态加 `visibility: hidden` 并让它**参与过渡**
      （折叠全程保持 visible、动画结束才 hidden）
- [x] **关键坑（探针实测）**：`border-box` 下只归零 `flex-basis` 时盒子宽是 **24.8px 而非 0**
      （理论 25px = `--space-4`×2 + 1px 边框），必须**一起归零 `padding-inline` / `border-right-width`**
      —— 这不只是观感：`artifact-panel` 的 `maxPanelWidth()` 正是 `getBoundingClientRect()` 量这个盒子，
      "收起时量到 0"是既有契约
- [x] **连带修复**：`.sidebar` 常驻后 `.sidebar ~ .chat .chat-header` 这类兄弟选择器恒命中，
      折叠态会丢左上角开关的让位 → 补了两条更高特异性的回调
- [x] 让位语义**未变**（主区仍被挤压/舒展，不是浮层覆盖）
- [x] `DESIGN.md` §5.1 已登记**第二条 width 类受控例外**（含实现附则：归零 padding/border 的理由）

## 长历史列表不重复播放入场动画

- [x] `.stream` 的 reveal 已限定为「从空到有内容」的首次揭示（动画移到 `.stream[data-reveal="true"]`）
- [x] 判断方式：**render 期派生**（比对 `entries.length` 前后值），**不用 effect**——
      effect 晚一个 commit，首条消息会先以 `opacity: 1` 画一帧再从 0 重播，反而闪
- [x] 从设置/统计返回一个长对话时**不再整列上滑淡入**（挂载即非空 → 不播）
- [x] 首次揭示（新建对话 → 首条内容到达）仍保留揭示感
- [x] `reduced-motion` 那条已同步改成同特异度选择器（写 `.stream` 会被属性选择器压过）
- [x] 已知边界（已写进注释）：若"切视图"与"首条回显"落进同一个 React 批，那次不播

## 低成本一致性

- [x] `::selection` 用中性色（`color-mix(in srgb, var(--text) 14%, transparent)`，与滚动条 thumb 同值）；
      **只给底色不给 `color`**（选区内链接/代码块不丢语义色）；**未新增档位**
- [x] `::selection` **只写一条**的理由（**如实标注**）：spec 假设的深色底在当前唯一生效主题里不成立
      —— 亮色 `--bg-sidebar` 是浅灰 `#f2f2f2`，深色主题块尚未接线，且那块的 `--text` 翻白、
      覆盖色自动跟着翻向同一方向
- [x] `.settings-card` 阴影提到 `--shadow-lg`（与同级居中模态 `.permission-card` 一致）
- [x] resize 期间面板宽度过渡被禁用（`.app[data-resizing="true"]`，**复用** `[data-dragging]` 手法，
      未另造）；手势结束靠 debounce 尾沿（`RESIZE_SETTLE_MS = 160`——原生标题栏缩放归 OS，
      renderer 拿不到 pointerup，这是 JS 手势窗口不是 CSS 时长，故不走 `--dur-*` token）
- [x] **未去掉** `.preview-panel` 的 width 过渡（全屏切换依赖它）
- [x] 用户气泡缩略图改定高 200px（纯裁切，永不位移）
- [x] **修正 spec 前提（如实标注）**：探针实测旧 CSS 下 16:9 图的渲染盒是 **160×200 → 解码后仍 160×200**
      —— `<img height>` 作为 presentational hint 本就生效，**并没有"200 掉到 ~90"的位移**。
      所以这不是修 bug，而是**消除一条隐式依赖**（任何 `img { height: auto }` 重置就会立刻塌陷）

## 豁免项未被误改

- [x] **未**把场景/模式/专家切换改成本地乐观更新（daemon 侧是内存同步）
- [x] **未**给 `.stream` 关掉 `overflow-anchor`（默认行为正确）
- [x] **未**加 `-webkit-font-smoothing`（macOS-only）
- [x] **未**给内容卡加阴影、**未**引入第四档阴影
- [x] **未**做 tab 内容切换过渡 / toast 退场动画 / 刻度轨 hover 过渡
- [x] **未**加右键菜单、**未**加 `-webkit-app-region`（窗口用原生标题栏，确认不适用）
- [x] **未**删 `.capability-chip` 那条 2% 阴影（有 WB 原值依据）
- [x] **未改任何视觉档位值**（`tokens.css` 除 `--font-body` 一行外零改动）

## 无回归与文档

- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（扫描 258 文件）
- [x] `npm run check:tokens` 通过（真违例 **0**，白名单未新增；豁免 107→111 全在「间距」类内置明文豁免）
- [x] `npm test` 全绿（95 文件 / 1717 用例）
- [x] `npm run build` 成功，产物含 MiSans woff2（已独立复核字节数）
- [x] `DESIGN.md` 已补：§2.6 末尾的**字体约束**（`--font-body` 是唯一真源、不得就地写字体栈，
      理由含"只有被 `url()` 引用才进产物"）；§5 第四条例外已按实测订正为 24.8px
- [x] `index.css` 的 25px 注释已订正为「理论 25px（`--space-4`×2 + 1px 边框），实测渲染盒 24.8px」
      （仅改注释，声明零改动）
- [x] 成果文档已记（`docs/design-tokens-migration.md` **§11**，11.1–11.7）：
      含三处关键实测证据（字体宽度度量、贴底对照表、折叠 24.8px）、
      **修正 `polish-ui-a11y-and-aesthetics` 的账目错误**、四条诚实标注、未做项表
- [x] **人工验收清单已列出**（11 条，含 Task 4 建议新增的两条）
- [x] 已报告本期**未做**项与理由

## ⏳ 待人工验收（沙箱无 GUI）

- [ ] ① Windows 上 600 字重是否不再发虚（品牌名 / 统计数值 / 按钮）
- [ ] ② 对话首次跨过一屏时是否还横向横移
- [ ] ③ 从首页切到统计 / 技能 / 诊断 / 定时任务是否还有入场（不再硬切）
- [ ] ④ 侧栏首屏是否显示骨架，且列表到达时**不竖向跳动**
- [ ] ⑤ 文档预览是否有"白纸感"（docx/pdf 纸、xlsx 满区网格）
- [ ] ⑥ 划过侧栏行时标题省略号是否还跳
- [ ] ⑦ 中文打 `@` 后拼音检索，菜单是否还抽搐
- [ ] ⑧ 折叠侧栏是否平滑（不再是 216px 瞬跳）
- [ ] ⑨ 从设置返回长对话是否还整列上滑淡入
- [ ] ⑩ 拖窗口边缘时右侧面板**不追手**（松手约 160ms 后过渡恢复）
- [ ] ⑪ 选中文本不再是系统蓝（深色按钮上白字选不中属预期）
