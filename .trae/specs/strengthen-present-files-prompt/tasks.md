# Tasks

- [x] Task 1: 重写场景提示词「交付」段（核心修复）
  - [x] 1.1 `resources/scenes/work/prompt.md`：「交付」段从软建议升级为"执行循环必经步骤 + 交付纪律"——写文件后必须调用 present_files、交付 ≠ 贴路径、多文件合并一次调用、HTML 首项自动打开预览、加粗强调
  - [x] 1.2 保留原有"只交付最终成果""中间过程折叠、回复自足""用中文回复"三条纪律

- [x] Task 2: craft 模式补交付衔接
  - [x] 2.1 `resources/modes/craft.md`：结尾补一句衔接（"产出文件后按场景提示词的交付段调用 present_files"）

- [x] Task 3: 冒烟验证（需真实 LLM 会话）
  - [x] 3.1 craft 模式请求产出 HTML 小游戏 → 模型无需提醒主动调用 present_files → 产物卡出现 → 首个文件自动在右侧面板打开（需真实 LLM 会话，人工验证）

# Task Dependencies

- Task 2 依赖 Task 1（衔接句引用场景提示词的交付段）
- Task 3 依赖 Task 1-2 完成
