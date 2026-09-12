# Checklist

## 快修与 token

- [x] `--accent` 已定义（#1470b4 收编，index.css:104），markdown 链接常态下划线可辨识（:2355）
- [x] `--warning` 定义并替换 3 处 #d9822b 硬编码（:107；--seg 分类色有意保留）
- [x] 三处计时/时间/用量数字 tabular-nums（:404/:1002/:1738）
- [x] 圆角 3 档 token 落地（sm×47/md×27/lg×10，6/7/8/10/16px 直写清零）；
  字号 5 档 token 落地（38 处核心路径替换）
- [x] 黑阶 rgba 0.75/0.82/0.9 收口为 primary 交互档

## 可访问性（P0/P1 清零）

- [x] 全局 button/控件 :focus-visible 焦点环（:177-184）；composer/问卷输入框焦点替代
- [x] 缩略图/图片遮罩/嵌套 span 三处非 button 交互语义化（含 Esc 关闭）
- [x] 全部表单控件有 label 关联（chat-view/settings 8 处/sidebar 2 处/composer）
- [x] entry-toolbar :focus-within 可见
- [x] ModeSwitch/model-menu/plus-menu/permission-menu 菜单语义对齐
  （haspopup/expanded/backdrop/Esc/role）
- [x] automations 弹层与 permission 弹窗有可访问名；automations/experts-view/
  workspace-picker Esc 关闭
- [x] sash 键盘调宽（±10px clamp）；automations 任务行 hover 态

## P2 打磨

- [x] .provider-select 样式补齐；Intl.NumberFormat ×2；type="url"；spellCheck/autocomplete
- [x] role=menu/tablist/aria-selected/aria-expanded/aria-pressed 语义补齐
- [x] 状态行 aria-live ×2；首页 placeholder `…`；text-wrap: balance；overscroll-behavior
- [x] reduced-motion 全局兜底落地（:6894）；模型大列表 content-visibility（:4182）

## 审美修正

- [x] 案例封面：体裁图标 + 单色底，无 pastel 渐变、无 hover 上浮
- [x] 死导航降灰（nav-item-pending）+ 提示文案；「引擎」文案改用户视角
- [x] Windows 中文：MiSans @font-face（400/600）+ 字体栈（雅黑兜底），
  子集 473/478KB ≤2MB（LICENSE 义务记 resources/fonts/README.md）

## 工程验证

- [x] 复跑审查：P0/P1 清零（补回被并行会话覆盖项后终验 10/10 通过）；P2 剩余记档
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（1348 用例）
