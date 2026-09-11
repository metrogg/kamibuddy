# Tasks

- [x] Task 1: fold-view 纯函数层（`src/renderer/fold-view.ts` + 测试）
  - [x] SubTask 1.1: 块分类（ConversationEntry 五类映射：正文→锚点候选、
        空文本→foldable、工具→foldable、show_widget/todo_write/错误/产物→豁免；
        问卷卡本就在消息流外）
  - [x] SubTask 1.2: 锚点选举纯函数（trim 最长 ∪ 最后一条，空文本不参与）
  - [x] SubTask 1.3: 段折叠分组（≥2 成批/孤立不批/思考不断批；摘要复用
        shared/metafold 词汇表）
  - [x] SubTask 1.4: 轮折叠计划 buildFoldPlan（turn-folded/process-fold/anchor/
        exempt/visible；进行中全展开）
  - [x] SubTask 1.5: 测试 22 例全过

- [x] Task 2: chat-view 渲染与状态
  - [x] SubTask 2.1: TurnHeader 可点击（hasTurnFold 时才给交互，无折叠内容不假交互）
  - [x] SubTask 2.2: SegmentFold 通用折叠组件（工具批摘要条与「过程消息」条
        共用一套外壳与词汇）；v1 metafold 块流退役（一套折叠规则不漂移）
  - [x] SubTask 2.3: 折叠状态：缺省折叠 + 手点展开唯一写路径 + 新 run
        collapseAll + 多桶按会话隔离 + sticky 无自动展开路径
  - [x] SubTask 2.4: 产物/错误/问卷卡在折叠区外（位置与现状一致）

- [x] Task 3: F14 提示词配套与收尾
  - [x] SubTask 3.1: delivery-rules.md 补终答自足条款（过程会被折叠/复述清单/
        50-70 行；WB 对照取舍记录）
  - [x] SubTask 3.2: 清单 F14 🟡→✅ + L2 备注（轮折叠/段折叠/锚点）+ 表头统计；
        全量验证 typecheck + check:deps + test 绿（1272 用例）

# Task Dependencies

- Task 1 是 Task 2 的前置（渲染消费渲染计划）
- Task 3.1 与 Task 1/2 并行；Task 3.2 最后
