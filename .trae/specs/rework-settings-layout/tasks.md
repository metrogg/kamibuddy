# Tasks

## 波一 · 并行（契约/注入 与 布局骨架，文件零交集）

- [ ] Task 1: 个性化契约 + compose 注入（core/daemon/shared）
  - [ ] 1.1 preferences.ts：新增 customInstructions/userNickname/assistantName/
    personaDescription/welcomeGreeting（默认 true）/showChangeDetails（默认 true）
    6 字段（旧文件兼容默认）；daemon 增 getPersonalization/setPersonalization
    （部分更新合并）与 getMemory/setMemory（读写 ~/.kamibuddy/MEMORY.md）IPC；
    shared/ipc.ts 类型集中
  - [ ] 1.2 prompt-composer.ts：个性化注入段——用户规则独立段（对齐 WB
    always_applied_user_rules 语义，说明「用户设定、酌情遵循」）+ 称呼/AI 名字/
    人设各一行（有值才注，全空零 token）；customInstructions 超 1500 字截断；
    位序在记忆段之后、人格段之前；测试（注入/为空不注/截断）
  - [ ] 1.3 验证：`npm run typecheck && npx vitest run src/core src/daemon src/shared`

- [ ] Task 2: 设置页布局重构（renderer 大头）
  - [ ] 2.1 settings-view.tsx 拆分为 settings/ 目录：左 nav（通用/个性化/记忆与进化/
    模型/提示词预览/关于，分组标题行如 WB「功能」「数据与安全」可省——我们项少）
    + 模态卡容器（居中 ~880px、背板点击关、Esc 关、右上 X；复用 modal-backdrop
    视觉）+ 右内容面板（独立滚动）；现有 9 个分区组件按归位搬入
    general-section.tsx / memory-section.tsx / models-section.tsx /
    prompt-section.tsx / about-section.tsx（原样搬运不改行为）
  - [ ] 2.2 personalization-section.tsx 骨架：回复风格分区原样搬入（新控件归 Task 3）
  - [ ] 2.3 index.css：设置模态卡 + 左 nav 样式（WB 截图口径：nav 项 13px、
    选中态底色 var(--bg-hover) 圆角、内容区 padding 24+；全用既有变量）
  - [ ] 2.4 验证：`npm run typecheck && npx vitest run src/renderer`

## 波二 · 并行（拆开后文件零交集）

- [x] Task 3: 个性化页新控件 + 行为（personalization-section.tsx + chat-view）
  - [x] 3.1 自定义指令 textarea（≤1500 字 + 计数，说明文案自创「给 AI 定几条规则，
    后续对所有任务都生效」）；称呼与身份：对你的称呼/AI 的名字单行输入 +
    人设/人格描述 textarea（编辑态切换，复用画像编辑模式）——读写走
    get/setPersonalization
  - [x] 3.2 加载欢迎语 toggle：chat-view 载入/首轮等待超 ~1s 显示一句问候
    （自创 5-6 条轮换，如「正在为你准备，马上来…」——与 waiting-tips 共存不冲突，
    注释口径）；展示文件变更过程详情 toggle：write/edit 卡「生成中」的实时计数/
    详情显隐（默认开=现状）
  - [x] 3.3 验证：`npm run typecheck && npx vitest run src/renderer`

- [ ] Task 4: 记忆与进化页扩容（memory-section.tsx + daemon IPC 已由 Task 1 供）
  - [ ] 4.1 现有记忆分区原样保留（toggle + 画像 重置/编辑/导入）
  - [ ] 4.2 长期记忆记录：MEMORY.md 查看/编辑（getMemory/setMemory，复用画像
    textarea 编辑模式；说明文案自创「AI 主动记下的偏好与决定，可随时修改」）
  - [ ] 4.3 验证：`npm run typecheck && npx vitest run src/renderer`

- [x] Task 5: 模型页 + 添加模型弹层（models-section.tsx）
  - [x] 5.1 服务商平铺移除：管理行 = 已配置 Key || 自建（未配 Key 的自建保留编辑/
    删除入口）；空态文案自创
  - [x] 5.2 添加模型弹层：供应商下拉（可搜索 + 每项标已配置/未配置 + 自定义末位）；
    预置未配 Key 先填 Key（新 IPC settings:add-provider-model + upsertProviderModel
    ——不写 baseUrl/api 防遮蔽内置、不打归属标记防误显自建）+ 模型字段；自定义内嵌
    CustomForm 复用；缺字段禁保存带原因；Esc capture 拦截防连带关设置卡
  - [x] 5.3 验证：`npm run typecheck && npx vitest run src/renderer`（custom-providers +5 用例）

## 收尾

- [x] Task 6: 全量验证 + 文档
  - [x] 6.1 `npm run typecheck && npm run check:deps && npm test` 全绿（1362 用例）
  - [x] 6.2 `docs/workbuddy对齐清单.md` L12（设置页布局同构）/L22（个性化字段版）更新

# Task Dependencies

- Task 3/4 依赖 Task 1（字段与 IPC 契约）；Task 3/4/5 依赖 Task 2（settings/ 目录拆分）
- Task 6 依赖全部前置任务
