# Checklist

## plan 模式

- [x] `resources/modes/plan.md` 存在：frontmatter 含 `ready: true` 与只读白名单
  （read / read_document / find / grep / ls / web_search / web_fetch，无 write/edit/present_files），
  正文为自创计划提示词
- [x] plan 模式下模型的活动工具集不含 write/edit/present_files（setInteraction →
  setActiveToolsByName 白名单生效）
- [x] 头部 ModeSwitch 与加号菜单「模式」子菜单都列出「计划」（ready，无「待做」标）

## 执行计划按钮

- [x] plan 模式 + 非流式 + 最后一条是 assistant 消息：该消息操作条出现「执行计划」
- [x] 点击后先切回 craft 再自动发送执行引导语（执行请求不撞上只读工具面）
- [x] 流式中、非 plan 模式、非末条消息均不显示该按钮

## 加号菜单

- [x] 对话页「+」展开菜单：添加文件 / 模式 ▸ / 专家 / 技能 / 连接器
- [x] 「添加文件」触发既有图片选择流程（行为不变）
- [x] 「模式」子菜单单选当前交互模式并即时切换（与 ModeSwitch 同源）
- [x] 专家/技能/连接器点击给待做 toast；菜单向上展开、左对齐
- [x] 首页 composer 的「+」不受影响

## /plan 命令

- [x] 发送 `/plan`（无参数）：模式切到 plan；plan 中再发 `/plan`：回到上一个非 plan 模式
- [x] `/` 补全列表出现 plan 及描述
- [x] `/plan xxx`（带参数）作为普通文本发送，模式不变
- [x] parseBuiltinCommand 的 plan 分支有 vitest 用例

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
- [x] 未触碰在途 add-document-reading 的 WIP 文件（doc-extract* 等）
- [x] `docs/STATUS.md` 已更新（专节 + 等你验证冒烟项）
