# Tasks

- [x] Task 1: 全局唤起热键（main 进程）
  - [x] SubTask 1.1: 新建 `src/main/global-shortcut.ts` 控制器：注册 `Shift+Alt+W`，
        toggle 语义 = 窗口聚焦/可见 → `minimize()`，否则 → `restore()` + `focus()` + `show()`；
        `will-quit` 时 `unregisterAll()`；注册失败返回 false 时不抛错，经 event-log 记录
        并保存状态供诊断页读取。toggle 判定逻辑抽成纯函数（输入窗口状态，输出动作）便于测试
  - [x] SubTask 1.2: `src/main/index.ts` 接线：窗口创建后初始化控制器，窗口引用经依赖注入
        （控制器不直接持有 BrowserWindow 全局，方便测试与多窗口演进）
  - [x] SubTask 1.3: 诊断页（`diagnostics-view.tsx`）加一行「全局唤起热键 Shift+Alt+W：
        已注册 / 注册失败（被占用）」；状态经 daemon 快照或 main 直查 IPC 透出（选改动最小的路）
  - [x] SubTask 1.4: 纯函数测试：toggle 判定（聚焦→minimize、最小化→restore+focus、
        隐藏→show+focus）、注册失败路径不抛错

- [x] Task 2: 发送时消息吸顶（chat-view 滚动锚定）
  - [x] SubTask 2.1: 先读 `chat-view.tsx` 现有滚动实现（吸底跟随/上翻解除跟随的现行语义），
        在其上新增「发送吸顶」：用户发送消息（本地回显上屏）后，scrollTo 该用户消息元素
        使其位于视口顶部（`block: "start"`）
  - [x] SubTask 2.2: 边界处理：吸顶与 streaming 吸底跟随的衔接（发送后先吸顶，回复开始
        streaming 后自然转入吸底跟随；用户上翻解除跟随的既有行为不改）；
        切换会话/恢复历史时不触发吸顶（只对「本会话内新发送」生效）
  - [x] SubTask 2.3: 测试：锚定决策抽纯函数（何时吸顶/何时跟随/何时不动），jsdom 或纯逻辑测试钉住

- [x] Task 3: 对齐清单与文档收尾
  - [x] SubTask 3.1: `docs/workbuddy对齐清单.md` L23 行拆为四个子项标注：
        FloatShortcut ⛔（IDE 遗产死开关，全局热键替代已做）/
        用户消息顶对齐 ✅（5.5.4 已去开关化，复刻为默认行为）/
        DisableSlotSystem ⛔（无运营平台）/ QueueBanner ⛔（无云端容量协议，状态机留档）；
        表头统计数字同步更新
  - [x] SubTask 3.2: ~~STATUS.md 追加 L23 跟进小节~~ **偏差记录**：STATUS.md 当日被
        并行会话反复删除（回收站 6 次），恢复操作被用户取消——判定为用户侧在重构文档，
        不重建。L23 跟进的完整记录落在本 spec 目录 + 对齐清单 L23a–d 行。

# Task Dependencies

- Task 1 与 Task 2 互不依赖，可并行
- Task 3 依赖 Task 1、Task 2 完成（清单状态要反映真实代码）
