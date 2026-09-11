# 网页来源图标（CSP 放行 + 搜索卡来源列表）Spec

## Why

「来源」功能的 favicon 早已实现（来源按钮头像组 + SourcesPanel 行图标 +
`sourceUrlMeta` 取 `${origin}/favicon.ico`），但 main 下发的 CSP 里
`img-src` 不含 `https:`——所有外部 favicon 被拦、全部回退 Globe 图标，
用户看到的就是「没有图标」。另外 web_search 工具卡在消息流里只有文字摘要，
WorkBuddy 的搜索卡（`cr-tool-web-search__item/favicon`）有逐条来源行
（favicon + 标题，可点击）。

## What Changes

- **CSP 放行外部图片**（`src/main/index.ts` installCsp，dev 与 prod 两条 policy 同步）：
  `img-src` 加 `https:`——favicon 与 markdown 外部图片一并解锁。
  权衡写注释：img-src 只放行图片加载（不可执行），风险是追踪像素/IP 暴露，
  对桌面 agent 是可接受口径（WorkBuddy 同）；script/connect 不受此次放开影响。
- **web_search 工具卡来源列表**（chat-view.tsx ToolEntry 特化）：
  卡有 `sources` 时，展开区渲染来源行列表——每行 SourceFavicon（复用
  sources-panel.tsx 的组件与失败回退）+ 标题（无标题显 host），点击打开链接
  （复用既有打开外部链接通道）；行列表置于 detail 文本之前（detail 保留）。
  卡头 summary 后加 favicon 头像组（按站点去重取前 3，复用来源按钮的
  叠放样式）+「N 个来源」计数。
- index.css：来源行样式（复用既有变量；favicon 16px、圆角 3px——WorkBuddy 同款尺寸）

**明确不做**：favicon 本地缓存、第三方 favicon 服务、来源排序/去重策略变更、
web_fetch 卡的 favicon（单 URL 摘要已含站点名）。

## Impact

- Affected specs：补全 add-search-sources-panel（CSP 是当初实现不可见的根因）
- Affected code：`src/main/index.ts`（CSP 两行）、`src/renderer/chat-view.tsx`
  （ToolEntry web_search 特化）、`src/renderer/index.css`

## ADDED Requirements

### Requirement: 外部 favicon 可加载

CSP 的 img-src SHALL 包含 `https:`（dev 与 prod 一致），来源按钮头像组与
SourcesPanel 行图标在站点提供 favicon 时显示真实图标，失败仍回退 Globe。

#### Scenario: favicon 显示
- **WHEN** 模型 web_search 返回知乎/ GitHub 来源，用户打开来源面板
- **THEN** 行首显示对应站点图标（而非全部 Globe 回退）

### Requirement: 搜索卡来源列表

web_search 工具卡含 sources 时 SHALL：卡头显示按站点去重的前 3 个 favicon
头像组与「N 个来源」计数；展开区在 detail 文本前渲染来源行列表
（favicon + 标题/host，点击打开链接）。

#### Scenario: 搜索卡展开
- **WHEN** 用户展开一张已完成的 web_search 工具卡
- **THEN** 看到逐条来源行（带站点图标与标题），点击行在浏览器打开对应网页

## MODIFIED Requirements

无。

## REMOVED Requirements

无。
