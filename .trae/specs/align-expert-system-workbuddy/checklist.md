# Checklist

- [x] expert 模式系统提示词中人格全文位于前部槽位（骨架之后、模式段之前），前有 Role Override 语义声明
- [x] 末尾 `<current-expert>` 段只含专家名与「遵循其角色与工作流」，不重复人格正文
- [x] expert 分支不注入风格段；craft 模式注入位置与风格行为不受影响
- [x] resources/experts/ 共 9 员，新增 stock-research-report / science-writing / poetry-prose
- [x] 全部 9 员含 displayDescription 与 quickPrompts（恰好 3 个）；加载器对缺字段/数量不符抛错
- [x] 新 3 员正文为自写（非 WorkBuddy SKILL.md 原文复制；短语级雷同已改写）
- [x] 专家子菜单项显示 displayDescription 副行
- [x] 选中专家后输入区上方显示 3 个 quickPrompts chips；点击填入输入框不发送
- [x] 发送任意一条消息后 chips 消失；切换专家 chips 按新专家重显
- [x] listExperts 链路透传 displayDescription 与 quickPrompts
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
- [x] 对齐清单 E5 行更新
