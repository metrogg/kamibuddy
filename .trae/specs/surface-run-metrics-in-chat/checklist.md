# Checklist

## 数据与降级

- [x] 指标条的 token/命中率只在有 usage 数据时显示，无数据只显示用时（不显示 0 值）
- [x] 覆盖率：无 usage 会话、多 assistant 条目、历史会话切换三种情况都有单测
- [x] 命中率与 token 格式化复用 shared 既有纯函数（`cacheHitRate` / `formatTokenCount`），无第二份实现

## 会话页可见性

- [x] 输入区下方常驻指标条存在，展示用时、输入/输出 token、缓存命中率
- [x] 流式期间用时持续递增（500ms 刷新），结束后保留最近一轮数值
- [x] 历史回合头部显示该轮真实用时（不再一律「已完成」）；取消轮显示「已取消 Ns」
- [x] 压缩进行期间会话流尾部显示状态行（区分手动/阈值/溢出），结束或失败后消失
- [x] 同一时刻不叠加两条状态行（压缩行与等待行/排队徽标位序一致）
- [x] 指标条样式复用既有 token 变量与 `tabular-nums`，未引入原生组件与新配色

## 工程

- [x] 未新增 IPC 通道，未新增 renderer→daemon 的拉取式调用（数据全部来自 reducer 已有状态）
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
- [x] 对齐清单已更新；「不做」的数据缺口（子代理台账、审批等待计时、seq gap 检测）已记录
