# Checklist

## 区外读询问

- [x] 默认权限档：工作区为 ~/KamiBuddy 时，模型 `ls`/`read` 工作区外路径弹出「读取工作目录之外的文件或目录」审批；拒绝则 block 且 reason 回给模型
- [x] 批准并勾选「本次会话记住」后，本会话内同目录读取不再询问；新建任务（新会话）后重新询问
- [x] 只读档：区外读同样询问；允许完全访问档：区外读不询问
- [x] 工作区内读取不受影响（不弹窗）；读 ~/.ssh、~/.kamibuddy/auth.json 仍直接拒（无「允许」选项）
- [x] web_search / web_fetch / present_files 行为不变

## 应用目录写保护

- [x] 默认权限档：edit/write 应用目录（dev 为项目根）内文件弹高风险审批，summary 指明是 KamiBuddy 自身目录
- [x] 高风险审批（写应用目录、shell）弹窗没有「本次会话记住」选项，每次都问
- [x] 只读档写应用目录直接拒；完全访问档写应用目录不询问

## 端到端验证

- [x] `npm run smoke:permission` 存在且全过：区外 edit 触发审批、deny 后 block；区内 edit 放行；区外 read 触发审批；读 ~/.ssh 不经审批直接 block；appDir 写触发高风险审批
- [x] 事件日志（~/.kamibuddy/logs/）能查到审批请求与应答记录（kind: permission_request/permission_response，含工具/风险/用户选择）

## chat 页权限入口

- [x] 对话页 composer 区有权限 chip，点击展开与首页相同的弹层；切档后立即生效
- [x] 对话页切档后，首页 chip 与设置页显示一致（同一数据源）

## 误导修正

- [x] 生成中被中断的 write/edit，恢复会话后卡片不显示「已修改/已生成」，而是未完成语义 + aborted 状态
- [x] 正常执行完成的卡片 label 不变（「已修改/已生成」等完成态词汇只属于成功终态）

## 工程验证

- [x] `npm run check`（typecheck + check:deps）通过
- [x] `npm test` 全绿（翻转用例有翻转记录注释；新增区外读/appDir 用例覆盖）
- [x] `npm run smoke:session` 13/13 不回退
- [x] docs/ARCHITECTURE.md §4.57 判定链表格已更新；docs/STATUS.md 有「权限边界加固」一节与待验证项
