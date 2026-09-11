# Checklist

- [x] 锚点选举纯函数：`trim 最长正文 ∪ 最后一条正文`（空文本/并列最长边界
      测试覆盖）—— fold-view.ts 22 测试
- [x] 段折叠：连续 ≥2 工具块成摘要批（主工具名 ×N），孤立块不折，
      思考不断批/正文与豁免断批
- [x] 轮折叠：run_finished 后过程块折进「已完成 Xs」头（默认折叠），点击展开
      完整过程；sticky（新 run collapseAll + 无自动展开路径）；历史轮默认折叠
      —— turn-fold.ts 14 测试
- [x] 豁免：产物卡/错误卡/问卷卡恒在折叠区外；streaming 中不触发轮折叠
- [x] 多轮会话：所有已完成轮都折叠，新 run 时上一轮立即折叠；折叠态按会话
      多桶隔离（turnFoldCacheRef）
- [x] F14 配套：delivery-rules.md 含「过程会被折叠、终答自足（复述清单）、
      50-70 行」条款
- [x] 清单 F14 🟡→✅、L2 备注（轮折叠/段折叠/锚点）、表头统计更新
- [x] `npm test` 全绿（1279 用例，含 fold-view 22 + turn-fold 14）；
      `check:deps` 通过（206 文件）；`typecheck` 本变更零错误——
      **工作区残留 2 处错误均为并行会话 add-search-sources-panel 的
      in-flight 文件**（App.tsx onOpenSources 未接线、collect-sources.test.ts
      未用变量），其与我方交界处（Fragment 导入被并线冲掉、groupTurnBlocks
      陈旧引用）已修复
