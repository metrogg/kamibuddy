# Checklist

## 专家数据层

- [x] `resources/experts/` 首批 6 员，frontmatter 齐备（name/description/displayName/
  profession），正文为角色/核心能力/工作流程/输出规范结构，头注标注照搬待定制
- [x] 用户级 `~/.kamibuddy/experts/` 加载且同名覆盖内置；坏文件响亮抛错（14 用例）

## expert 模式与注入

- [x] 模式菜单有「专家 ▸」子菜单（ModeSwitch 与 PlusMenu 同源），列出 6 员
  （displayName + profession），选中 ✓，裸 expert 不列
- [x] 选中专家后：会话进入 expert 模式、expertId 落 session state、头部显示
  「专家：{名}」chip
- [x] 系统提示词含专家人格段；每轮钉住 `<current-expert>`（提示词最末）
- [x] 切到 craft/ask/plan 清除 expertId（本在 expert 回落 craft）；expert 不入 /plan
  记忆；新会话默认无专家
- [x] expert 模式工具面 = craft 同款（19 个含 task/questionnaire/powershell/
  docx_convert——验收发现 docx_convert 漏同步已补）
- [x] 无 expertId 时 expert 模式不可达（applyInteraction 抛错）

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（1145 用例）
- [x] 文档已更新（用户已废 STATUS.md）：`docs/workbuddy对齐清单.md` E5 行 🟡 +
  `docs/ARCHITECTURE.md` §4.8 决策记录
