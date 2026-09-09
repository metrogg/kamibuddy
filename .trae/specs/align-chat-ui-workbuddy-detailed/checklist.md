# Checklist

## P0：工具调用「挤没」bug
- [x] 工具调用执行中始终可见（不被挤没）——`.stream` 改普通块流容器（index.css:1254），`.entry.tool` 加 `flex-shrink: 0`（index.css:1973）
- [x] 完成后工具段折叠成 MetaFold 摘要行（现有口径不变，metafold.ts:205-211）

## P1：大矩形框 → 小圆角卡片/单行文本行
- [x] 工具调用卡片：无背景、无边框、单行文本（14px/1.75 三级灰 + 工具图标 + 状态字扫光 + 摘要省略 + chevron hover 浮现）（index.css:1967-2077）
- [x] 展开内容区：独立小圆角盒（radius 16px、max-height 300px、上下小 margin）（index.css:2085-2124）
- [x] MetaFold 折叠行：fit-content 纯文字行（主导工具图标 + 摘要 520px 省略 + 箭头 hover 浮现）；无背景、无边框（index.css:1428-1465）
- [x] 用户气泡：padding `8px 12px`（原 `32px 16px`）；外层消息行上下 32px 间距（index.css:1522 + :1513）
- [x] 去掉整卡 2px outline 脉冲（border-ping 全 src grep 无匹配，已彻底删除）

## P2：间距节奏
- [x] 打破统一 `gap: 12px`：user 前后 32px、turn 内紧凑、工具行小间距（index.css:1513/:1369/:1656/:1419/:1975）
- [x] 去掉 turn-header 的 `-4px` 反吃 hack（index.css:1367-1369）

## P3：动效
- [x] 工具详情/折叠单元展开动画：高度+opacity+translateY(-6px) 过渡（0.28s cubic-bezier(0.33,1,0.68,1)）（index.css:2096-2106 max-height 过渡 + :1476-1494 grid 0fr↔1fr）
- [x] 消息流整列 hydration reveal（opacity 0 → 1 + transform 0.32s 带回弹）（index.css:1261-1273 stream-reveal backwards）
- [x] 消息流底部渐隐 mask（index.css:1289-1303 stream-fade 叠加层 + data-visible 切 opacity）
- [x] reduced-motion 覆盖：tool-pulse/border-ping/task-spin（index.css:2129-2139）

## P4：图标体系
- [x] 工具类型图标：Read→Eye、Write→Pencil、Bash→Terminal、Search→Search、Web→Globe 等（14px）（tool-icon-registry.ts:60-137 映射表 + icons.tsx 新增 8 个图标）
- [x] 执行中隐藏工具图标（状态靠扫光文字）；失败显示 FailedIcon（chat-view.tsx:325/:310-311）

## P5：生成期上屏
- [x] web_search/web_fetch 在参数生成期即上屏卡片（消除执行前空白窗）（session-host.ts:104 STREAM_CARD_TOOLS 白名单）

## 质量门
- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（137 文件）
- [x] `npm test` 通过（45 文件 / 642 用例）
- [x] 未触碰 shared 契约（IPC 通道）/ daemon handler / core 业务逻辑（session-host 只改事件翻译）
- [ ] 手测：工具调用执行中可见、单行文本行、展开小圆角盒、折叠行 fit-content、用户气泡紧凑、折叠展开动画、消息进入动画、工具图标、生成期上屏（需用户执行）
