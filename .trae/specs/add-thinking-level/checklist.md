# Checklist

- [x] pi 调研结论落实为代码注释：可用档位获取方式、createAgentSession.thinkingLevel 签名、thinking_level_select 事件形状（引 pi 源码行号）
- [x] 自定义服务商模型的 thinkingLevelMap 原样透传（单测钉住：声明/未声明两态）
- [x] SessionHost.create 注入初始档位；setThinkingLevel 幂等且 pi 钳制不可达档位；emitState 携带 thinkingLevel + availableThinkingLevels
- [x] SessionState 契约新增两字段，renderer 只经 shared 取（check:deps 不破）
- [x] INVOKE.setThinkingLevel 作用当前桶；pristine 桶（无宿主）先记桶内 state、建宿主带入（与 setScene 同语义）
- [x] 全局默认写偏好文件；新会话/定时任务 run/子代理建会话均以它为初始档；既有会话不被回溯
- [x] 模型菜单 pill 显示「模型名 档位」；弹层「推理强度」子菜单只列当前模型可用档位；非推理模型两处都不显示
- [x] 首页与对话页模型菜单同组件同数据源，档位切换两处一致刷新
- [x] 设置页「默认推理强度」下拉可选七档（中文标签），保存后新会话生效
- [x] 切走再切回会话档位保持（pi 逐会话持久化）；重启 resume 后档位还原
- [x] npm run typecheck && npm run check:deps && npm test 全绿；smoke:session 回归通过
- [x] STATUS.md 更新（含 pi 语义说明与方案 B/C 取舍记录）
