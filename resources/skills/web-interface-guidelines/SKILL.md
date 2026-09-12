---
name: web-interface-guidelines
description: 审查 UI 代码（tsx/css/html）是否符合界面规范——无障碍、焦点态、表单、动画、排版、内容处理、图片、性能、交互、主题、文案。当用户说「审查我的界面」「检查可访问性」「review UI/UX」「audit design」时使用。
---

<!-- 来源：vercel-labs/web-interface-guidelines + vercel-labs/agent-skills（MIT License，
     见同目录 LICENSE.txt）。原版每次审查前 WebFetch 拉取最新规则——我们改为本地
     references/guidelines.md（离线确定性；上游更新时手动同步）。 -->

## Web Interface Guidelines

审查指定文件（或让用户给出文件/模式），逐项对照 `references/guidelines.md`
中的规则输出问题清单。

## 流程

1. 读取 `references/guidelines.md`（本地规则集，包含输出格式要求）
2. 读取用户指定的文件（未指定则询问文件/模式）
3. 逐条规则核对
4. 按 guidelines.md 末尾的 Output Format 输出：按文件分组、`file:line` 格式、
   只写问题与位置（修法不显然时才解释）、无开场白

## 使用边界

- 这是**审查**技能，不是创作技能——做新页面的视觉设计用 frontend-design。
- 规则里 Tailwind 类名写法（如 `focus-visible:ring-*`）对应到我们的手写 CSS
  时按语义理解（`:focus-visible` 有可见焦点样式）。
- 纯 Electron 桌面场景下不适用的条目（safe-area 刘海屏、hydration 服务端渲染、
  URL 状态同步）跳过并在输出中说明跳过理由。
