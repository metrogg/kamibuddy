# Checklist

## agents 数据层

- [x] `resources/agents/` 内置四员（scout/planner/reviewer 只读、worker 全工具面），
  frontmatter 含 name/description/tools，正文自创
- [x] 用户级 `~/.kamibuddy/agents/*.md` 加载且同名覆盖内置；坏文件响亮抛错（15 用例）

## task 工具

- [x] craft 白名单含 task；ask/plan 不含；权限门放行 task 本身（三档，有测试）
- [x] 单发/并行（≤8、并发 4 排队）/链式（{previous} 占位、首步失败即停）三模式可用（19 用例）
- [x] 子代理隔离上下文执行：独立会话、agent 声明的工具白名单、继承主会话模型
- [x] 输出 24k 截断 + 去毒（仿冒 system-reminder/Human:/Assistant: 行被转义，10 用例）
- [x] agent 不存在返回可用清单；每会话 spawn 预算 20 超出拒绝
- [x] 子代理会话不注册 task（深度 1 层，双保险）；run 会话（无人值守）不注册 task
- [x] 主会话中断传播杀子代理（abortAll + execute signal 双路径）；单跑 10 分钟超时
- [x] 工具卡标题「子任务」，运行中/完成（N 轮）两态

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（972 用例 + smoke:permission 10/10）
- [x] `docs/STATUS.md` 已更新（专节 + 冒烟项第 16 项）
