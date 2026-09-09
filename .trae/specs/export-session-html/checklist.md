# Checklist

## 当前会话导出

- [x] 侧栏当前会话行有「导出」按钮（title="导出为 HTML"），点击后 `~/KamiBuddy/exports/` 生成 HTML
- [x] 文件名 = 清洗后的会话标题 + `-yyyyMMdd-HHmmss.html`（非法字符替换、压单行、超长截断、空标题回退 session）
- [x] 导出成功后 toast 显示完整路径，且系统默认浏览器自动打开该文件
- [x] 导出的 HTML 内容完整：用户消息、助手回复、思考块、工具调用与结果
- [x] playground 会话同样导出到 `~/KamiBuddy/exports/`（固定默认根）

## 空会话与错误处理

- [x] 当前会话无任何消息时导出被拒，提示「该会话还没有内容可导出」，不崩溃、不生成空文件
- [x] 越界路径（如 `../auth.json`）导出被 daemon 拒绝

## 历史会话导出

- [x] 历史会话行「导出」按钮 title 写明「恢复此会话并导出 HTML」
- [x] 点击历史行导出：该会话被恢复（对话页显示其内容）并完成导出
- [x] 流式进行中点导出被拒并提示，当前会话不受影响
- [x] 恢复失败（如目标会话损坏）时不导出，当前会话不受影响（失败原子性）

## 工程验证

- [x] `npm run check`（typecheck + check:deps）通过
- [x] `npm test` 全绿（含 session-export 新增用例）
- [x] `npm run smoke:session` 与 `npm run smoke:permission` 不回退
- [x] docs/STATUS.md 有「会话导出 HTML」小节（含 pi 包根导出面实测结论）与待验证项
