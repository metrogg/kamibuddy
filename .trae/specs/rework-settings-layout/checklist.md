# Checklist

## 布局

- [x] 设置页为模态卡：左 nav（通用/个性化/记忆与进化/模型/提示词预览/关于）+
  右内容只显示当前分组；Esc/背板/X 关闭
  （settings-view.tsx:98-113：modal-backdrop + settings-card role="dialog" aria-modal +
  Esc 对输入框放行 + 关闭 X）
- [x] settings-view.tsx 已拆分为 settings/ per-section 文件（容器 + 6 个 section 文件）
- [x] 现有分区全部归位且行为不变（通用=推理/联网搜索/存储路径/权限；
  提示词预览与关于保留，关于含版本 + 诊断入口）

## 个性化

- [x] 自定义指令：textarea ≤1500 字 + 计数，保存后经 compose 注入独立用户规则段
  （空不注、超长截断，有测试——prompt-composer.ts:64/296 + 59 用例）
- [x] 称呼/AI 名字/人设：编辑保存后有值才注入对应行（全空零 token，
  prompt-composer.ts:66-70）
- [x] 加载欢迎语 toggle 生效（WaitingPendingLine 1s 换问候，池在
  shared/waiting-tips.ts WELCOME_GREETINGS）；变更详情 toggle 控制 write/edit
  卡生成中详情显隐（只藏 generating 实时计数，完成态不受影响）
- [x] 6 个 preferences 新字段落盘且旧文件兼容（preferences.test.ts 18 用例）

## 记忆与进化

- [x] 现有记忆分区（toggle + 画像管理）原样可用
- [x] 长期记忆记录：MEMORY.md 查看/编辑经 getMemory/setMemory IPC 落盘，
  下一轮对话生效（memory-section.tsx LongTermMemorySection；无重置/导入有注释口径）

## 模型

- [x] 设置页不再平铺未配置服务商；已配置/自建服务商可管理 Key
  （models-section.tsx:12 头注释口径）
- [x] 添加模型弹层：供应商下拉（可搜索 + 每项标已配置/未配置 + 自定义末位，
  :479/:544/:565）→ 按选择呈现字段 → 保存入库（addProviderModel:657 +
  upsertProviderModel 不遮蔽内置）；缺字段禁保存

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（1362 用例）
- [x] `docs/workbuddy对齐清单.md` 已更新（L12 设置页布局同构 / L22 个性化字段版）
