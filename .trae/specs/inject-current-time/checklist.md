# Checklist

- [x] 组装的 systemPrompt 末尾含运行时环境块：本地时间（分钟级）+ 星期 + IANA 时区 + GMT 偏移（固定 now 的单测断言；格式 `Current time: 2026-09-09 23:18 (Wednesday, GMT+8, Asia/Shanghai)`，措辞自创）
- [x] 每个新 run 取当下时间（composePrompt 唯一生产调用在 daemon composeSystemPrompt，before_agent_start 每轮现调、无组装缓存——非会话创建时固化）
- [x] 分钟级精度：同一分钟内两次组装输出字节一致（23:18:01 vs 23:18:59 字节相等的测试；缓存取舍有注释）
- [x] 既有 composer 行为不破（未支持槽位抛错、残留槽位抛错、空技能压平、piContext 拼接——既有 11 用例全绿）
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（739 个测试）
- [ ] 冒烟（用户重启后）：问「现在几点了」模型答出当前日期/星期/时分/时区
