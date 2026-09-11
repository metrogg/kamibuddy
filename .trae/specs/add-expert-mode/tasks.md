# Tasks

## 波一 · 数据层（单代理）

- [x] Task 1: experts 资源 + 加载器
  - [x] 1.1 `resources/experts/` 首批 6 员（work-report/legal-contract/academic-paper/
    business-copy/general-writer/tech-blog）：从 WorkBuddy tencent-docx/experts/ 对应
    SKILL.md 提取正文知识，转为 experts 格式（frontmatter：name/description/
    displayName/profession + 正文 角色/核心能力/工作流程/输出规范/注意事项）；
    每文件头注标注「预设照搬自 WorkBuddy 内置专家，待定制替换」
  - [x] 1.2 `src/core/experts.ts` + 测试（14 例）：加载内置 + 用户级 `~/.kamibuddy/experts/`
    同名覆盖；校验从紧（缺四字段抛错、name=文件名强制）
  - [x] 1.3 验证：`npm run typecheck && npx vitest run src/core/experts*`

## 波二 · 模式与注入（依赖 Task 1 接口）

- [x] Task 2: expert 模式 + 人格注入 + IPC（core/daemon/shared）
  - [x] 2.1 `resources/modes/expert.md`：tools=craft 同款（18 个）；正文片段自创
  - [x] 2.2 `SessionState.expertId` + `INVOKE.setExpert`：选专家=进 expert 模式+绑定人格
    （applyInteraction 单入口扩展第三参）；切走清 expertId（本在 expert 回落 craft）；
    expert 不入 /plan 记忆（回程 expertId 已清，记下必炸——注释）；快照/恢复带 expertId
  - [x] 2.3 `prompt-composer.ts`：expert 分支——骨架 + expert 片段 + 人格段
    （requireExpertPersona 每次现载）+ 钉住段 `<current-expert>` 落提示词最末
    （v1 无 user-context 每轮注入机制，随每轮重组的系统提示词落离对话最近处，
    文本稳定不炸前缀缓存）；场景轴不参与（注释）
  - [x] 2.4 验证：`npm run typecheck && npm run check:deps && npx vitest run src/core src/daemon src/shared`
  - [x] 2.5（追加）修复 craft.md 白名单丢失的 task（bcb5365 引入的回归）

## 波三 · renderer（依赖波二契约）

- [x] Task 3: 专家选择菜单 + 头部显示
  - [x] 3.1 `INVOKE.listExperts` 通道（一行级透传 ×4）；ModeSwitch 与 PlusMenu 加
    「专家 ▸」子菜单（displayName + profession 副行、expertId 命中 ✓、裸 expert 不列）；
    App 层 listExperts 启动拉一次（变动低频不建推送）
  - [x] 3.2 对话头部 ModeSwitch 旁显示「专家：{displayName}」chip
  - [x] 3.3 验证：`npm run typecheck && npm run check:deps && npx vitest run src/renderer`

## 收尾

- [x] Task 4: 全量验证 + 文档
  - [x] 4.1 `npm run typecheck && npm run check:deps && npm test` 全绿（1145 用例）
  - [x] 4.2 文档（用户已废 STATUS.md）：`docs/workbuddy对齐清单.md` E5 行更新为 🟡
    （expert 模式+人格注入+预设 6 员已落地；专家团/CRUD 未做）；
    `docs/ARCHITECTURE.md` §4.8 决策记录（expert=第四模式+人格注入及关键子决策）

# Task Dependencies

- Task 2 依赖 Task 1（experts 加载器接口）
- Task 3 依赖 Task 2（setExpert IPC 契约）
- Task 4 依赖全部前置任务
