# Checklist

## Composer 统一

- [x] `src/renderer/composer.tsx` 存在，home-view 与 chat-view 都渲染它，两页不再各自
  手写 composer 区块（grep composer-card/textarea 仅命中 composer.tsx 与 index.css）
- [x] 对话页既有行为零回归：图片/文档附件三入口、IME 守卫、@ 补全、Alt+↑↓ 历史、
  按 sessionId 草稿、字数余量与超限双闸、流式停止按钮 + Esc 二次确认、
  发送后 recordSent 与清草稿
- [x] 首页既有行为保留：placeholder、rows=3、提交即建任务；不开输入历史与草稿持久
- [x] 首页新增一致行为：10 万字数闸（余量显示 + 超限禁发）

## 首页加号菜单

- [x] 首页「+」与对话页「+」是同一个 PlusMenu（五项：添加文件/模式▸/专家/技能/连接器）
- [x] 首页「模式」子菜单切换经 setInteraction 生效（App 补传的同源数据）；
  选「计划」后发首条消息，新任务以 plan 起手
- [x] 首页与对话页的占位项（专家/技能/连接器）行为一致（onTodo toast）

## CSS 去重

- [x] 用户/助手工具条共享类落地（.entry-toolbar + 左右修饰 + .entry-icon-btn），
  hover 浮现节奏与按钮反馈视觉不变（静态核对一致，观感见人工冒烟 12）
- [x] 菜单容器公共类 .pop-menu 落地；四个弹层观感不变（另审计合并 10 组逐字重复，约 -70 行）
- [x] index.css 无新增变量、无硬编码色值（本 spec 部分）

## 审计

- [x] settings/skills/diagnostics/sidebar/artifact-panel/dialogs 审计完成；
  「不言自明」重复已合并；存疑项记录在 STATUS.md（16 项，不合并）
- [x] 审计未引入行为变化（合并均为 CSS 选择器并集，764 用例全绿）

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
- [x] 未触碰 daemon / core / shared / 契约（本 spec 部分）
- [x] `docs/STATUS.md` 已更新（专节 + 等你验证冒烟项）
