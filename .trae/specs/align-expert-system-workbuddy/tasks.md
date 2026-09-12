# Tasks

- [x] Task 1: 人格注入改造（prompt-composer expert 分支）
  - [x] SubTask 1.1: 人格正文（剥 frontmatter 的 body）注入系统提示词前部槽位
        （骨架之后、模式段之前），前加 Role Override 语义声明（自写文案）；
        末尾 `<current-expert>` 精简为钉子（名字 + 遵循其角色与工作流，不含人格）
  - [x] SubTask 1.2: expert 分支不注入风格段及与人格冲突的通用身份段
  - [x] SubTask 1.3: prompt-composer 测试同步：槽位顺序断言、override 声明存在、
        钉子段无人格正文、expert 无风格段、craft 不受影响
- [x] Task 2: 预设扩充 + 字段增强
  - [x] SubTask 2.1: 新增 stock-research-report / science-writing / poetry-prose 三员
        （从 WorkBuddy tencent-docx/experts 对应 SKILL.md 提取方法论自写，不抄原文）
  - [x] SubTask 2.2: frontmatter 增加 displayDescription + quickPrompts（恰好 3 个），
        首批 6 员补齐；`src/core/experts.ts` 校验同步（缺字段抛错、数量必须 3）
  - [x] SubTask 2.3: experts 测试同步（9 员加载、字段校验正反例）
  - [x] SubTask 2.4: listExperts 链路透传新字段（shared/bridge/preload/daemon，
        已是透传则免改）
- [x] Task 3: UI（菜单副行 + quickPrompts chips）
  - [x] SubTask 3.1: 专家子菜单项加 displayDescription 副行
  - [x] SubTask 3.2: 选中专家后对话页输入区上方显示 3 个 quickPrompts chips
        （点击填入输入框不发送；发送一条后消失；切专家重显）+ CSS
- [x] Task 4: 收尾验证
  - [x] SubTask 4.1: `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] SubTask 4.2: 对齐清单 E5 行更新（机制差距补齐情况写入「我们」列）

# Task Dependencies

- Task 3 依赖 Task 2（UI 消费新字段）
- Task 1 与 Task 2 无依赖，可并行
- Task 4 依赖全部
