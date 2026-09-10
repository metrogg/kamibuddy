# Checklist

## questionnaire 工具

- [x] craft/ask/plan 三模式白名单含 questionnaire；权限门放行（不弹审批）
- [x] 模型调用后 renderer 弹问卷卡：选项单选 + 「其他…」自由输入 + 整卡跳过；
  提交在全部问题有答案后可点
- [x] 作答/跳过经 IPC 回传，模型收到对应工具结果（跳过文案要求不追问）
- [x] 问卷 pending 期间侧栏亮「待确认」amber badge（App 层合成 approvals + questionnaires）
- [x] 消息流留下「向用户提问」工具卡（等待中/完成两态）
- [x] 多并发问卷排队（审批优先）；无人值守 run 会话中工具直接返回不可用文案

## powershell 工具

- [x] craft 白名单含 powershell；ask/plan 不含
- [x] command-guard 拦截：iex/Invoke-Expression/Add-Type/-EncodedCommand、
  DownloadString/curl|iex 下载执行、Remove-Item -Recurse -Force（尤其根级路径）、
  凭据目录访问、shutdown/format/Set-ExecutionPolicy 等——五类别共 54 个 vitest 用例
- [x] 正常命令执行返回输出（24k 截断）；默认 120s 超时（上限 600s）；非 Windows 响亮报错
- [x] 权限门：read-only 拒、balanced 高风险询问、danger-full-access 放行（有测试）
- [x] 无人值守 run 会话中 powershell 一律不可用

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（927 用例 + smoke:permission 10/10）
- [x] IPC 类型集中在 shared/ipc.ts（无两侧字面量）
- [x] `docs/STATUS.md` 已更新（专节 + 冒烟项第 15 项）
