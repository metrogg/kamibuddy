# Checklist

- [x] 右侧面板在无文件时也可点击头部开关展开，显示概览菜单与"选择文件以预览"空态（App.tsx `panelOpen &&` 渲染 + artifact-panel 空态分支）
- [x] 有产物交付时面板自动展开（panelOpen 置 true），首个本地文件自动打开（App.tsx `artifacts_presented` → setPanelOpen(true) + openPreview(focusFile)）
- [x] 用户气泡最大宽度为消息流宽的 70%，长消息折行而非占满宽（index.css `.user-bubble max-width: 70%`）
- [x] `artifacts_presented` 事件触发时产物清单经 `appendCustomEntry` 持久化到会话文件（session-host.ts persistArtifacts）
- [x] 恢复历史会话时 `buildConversationEntries` 把 `artifacts_presented` custom 条目翻译成事件，产物卡正常显示（+ Task 5 修复 resume 断链：`artifactsFromEntries` 折叠进 snapshot.artifacts，session-rebuild.test.ts 3 用例）
- [x] 多次交付的产物清单位于 reducer 折叠语义下正确（按路径去重、后交付排末尾）（conversation.test.ts reducer 用例 + artifactsFromEntries 4 用例）
- [x] `npm run typecheck && npm run check:deps && npm test` 通过（462 个测试全绿）
- [ ] 冒烟：无文件面板展开、气泡 70% 宽、历史会话产物卡恢复均正常（用户选择自行重启验证，待确认后勾选）
