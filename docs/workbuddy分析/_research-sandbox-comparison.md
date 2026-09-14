# Trae / WorkBuddy / Codex 沙箱与权限隔离 · 三方对比报告

> 日期：2026-09-14 ｜ 调研：Codex 主 agent（Trae）+ 两个 subagent（WorkBuddy / Codex）
> 证据底稿（本目录内，全部为本次新产出的原始摘要）：
> - `_research-trae-sandbox.md`（本机 Trae CN 1.107.1 实测 + 二进制字符串）
> - `_research-workbuddy-sandbox.md`（解包产物 + 反混淆 JS，666 行）
> - `_research-codex-sandbox.md`（codex-rs 源码，531 行）
> 证据等级：【源码】【实测】【二进制】【文档】【推测】【未验证】
> 本文只做对比与结论；所有一手引用在上面三份底稿里。

---

## 0. 一句话结论

三家**都收敛到同一条公理**：*「要不要做」（策略层）×「能不能做」（隔离层）是两个正交维度，
再加一条「做了之后如何告知与补救」（观测/提权层）。区别在于**隔离层放在哪**：

| | 隔离层落在哪 | 代价 | 对 Windows 的态度 |
|---|---|---|---|
| **Trae** | 自研原生沙箱（`trae-sandbox.exe` + `sbox_sdk.dll`） | 200MB+ 原生代码、需提权装内核依赖 | 一等公民，仅 Windows 发行包就带完整沙箱 |
| **WorkBuddy** | Linux/mac 用 `@anthropic-ai/sandbox-runtime`；Windows 自研 `tsbx` 内核态 | 多人年、独立 rule center | 自研最深（但 `network_rules`/registry 规则**解析不强制**） |
| **Codex** | 复用 **OS 原生能力**：Seatbelt / bwrap+Landlock+seccomp / 受限令牌+ACL+WFP | 一次性管理员 setup；但实现是"薄壳 + 策略" | 有完整原生实现（`windows-sandbox-rs` 46 文件） |

**给 KamiBuddy 的落点**：策略层照抄 WorkBuddy 的求值链 + Codex 的双轴与规则引擎词汇；
隔离层**本轮不碰自研**，按 `09-sandbox-and-permissions.md` 决策 B 继续搁置并诚实上报 `partial`。
但三方都给了我们**不依赖 OS 沙箱就能立刻做**的一批机制（见 §5）。

---

## 1. 四方角色（含 pi 作为底座）

| 角色 | 定位 | 对我们的意义 |
|---|---|---|
| **Codex** | 编码 agent，OS 原生隔离 + 规则引擎 | 策略词汇与降级诚实性的教科书 |
| **WorkBuddy** | 办公 agent，四层纵深 | 与我们的产品形态最接近，产品级姿态可参考 |
| **Trae** | IDE 内 agent，自研沙箱 + 企业下发 | 证明"自研原生"路线可行但昂贵 |
| **pi**（底座） | 故意不做沙箱，但把**策略钩子给全** | 我们的挂载点来源（`tool_call` / `project_trust` / `BashOperations`） |
| （附）**deepseek-harness** | 一切皆插件，词汇与 codex 逐字相同 | 印证业界已收敛，别自创方言 |

---

## 2. 统一分析框架

把三家拆到同一坐标里看，共 7 层：

```
L1 信任与预设     项目是否可信 → 决定默认档位
L2 策略求值链     规则/钩子按固定顺序短路求值（deny 恒定优先）
L3 沙箱模式轴     只读 / 工作区可写 / 完全放开
L4 审批策略轴     ask / never / granular（按来源分类）
L5 OS 隔离实现    受限令牌、Seatbelt、bwrap、Landlock、ACL、WFP
L6 提权与补救     被拦后：能给模型什么出路、给用户什么选项
L7 观测与诚实性   拒绝事件、审计、是否假称"已隔离"
```

---

## 3. 逐层对比

### L1·L2 策略与求值链

| | WorkBuddy | Codex | Trae |
|---|---|---|---|
| 求值链 | **10 个短路出口**（hook → always-approval → deny → 可信 allow → 命令安全检查 → ask → bypass → 不可信 allow → 模式策略 → 非交互 deny → 默认 ask）【源码】 | execpolicy（prefix rule，allow/prompt/forbidden，**最严者胜**）+ 危险命令检查 + 审批策略【源码】 | 规则为 JSON 数据（文件三段权限 + 目录类型 + 网络 allow/deny），求值顺序【未验证】 |
| deny 优先级 | **恒定最高**，bypass 也拦不掉 | forbidden > prompt > allow | deny 与 allow 并列存在，谁胜【未验证】 |
| allow 分层 | **可信 / 不可信**两层：未信任目录里的项目级 allow **自动降级** | 项目信任决定默认 approval（trusted→on-request，untrusted→UnlessTrusted） | 【未验证】 |
| 危险命令 | bypass 模式下 HIGH/CRITICAL 仍 ask | "默认 Prompt + 禁前缀"（全仓无 `iex` 黑名单） | 未在二进制中发现命令级黑名单 |
| 反包装 | — | **`BANNED_PREFIX_SUGGESTIONS`**：`bash -c`/`powershell -Command`/`node -e` 等永不能存为规则前缀 | — |

**共识**：deny 必须先于一切；allow 要分信任级别；bypass 不是"全放行"。
**最值得立刻抄的一条**：Codex 的反包装列表——它堵的是"用 shell 包一层绕过检查"，我们权限门的天然漏洞。

### L3·L4 两个正交轴

| | 沙箱模式 | 审批策略 | 预设关系 |
|---|---|---|---|
| Codex | `read-only`(默认) / `workspace-write` / `danger-full-access` | `untrusted` / `on-request`(默认) / `granular` / `never` | 双轴独立；`granular` 五字段按来源分开关（false = **自动拒绝而非打扰**） |
| WorkBuddy | CLI 侧 `PermissionMode`（默认/plan/acceptEdits/fullAccess/bypassPermissions…） | 桌面端**归一化为 bypassPermissions** + trustedDirectories + 极小 allowedTools | 产品上关掉弹窗，安全靠 deny 硬规则 + 审计 + OS 沙箱 |
| Trae | 沙箱内文件的 inherit/readonly/no-access 由规则给出；会话档位【未验证】 | 设置面板 + 企业下发 | 沙箱规则是企业可管控资产 |
| **我们（现状）** | 行为 ≡ `workspace-write` + `ask` | 首页/chat 权限 chip（默认/只读/完全访问） | 硬编码，待参数化 |

**结论**：`09-…` 决策 C 里"两个正交轴 + 预设=双旋钮捆绑 + 类型留扩展位"的判断，被 Codex
的 `GranularApprovalConfig` 与 Trae 的企业 JSON 双双印证。

### L5 OS 隔离实现

| | macOS | Linux | Windows |
|---|---|---|---|
| Codex | `sandbox-exec` + SBPL（**`(deny default)` 起步**，绝对路径防 PATH 注入） | **bwrap 默认** + `no_new_privs` + seccomp；Landlock 降为显式 legacy；**WSL1 直接拒绝** | 受限令牌 + 能力 SID + ACL + **WFP 网络过滤** + 独立桌面 + 专用本地账号 + DPAPI |
| WorkBuddy | `sandbox-runtime`(Seatbelt) + 自带 toybox/zsh + broker shim（**darwin-only**） | `sandbox-runtime`(bwrap) | 自研 `tsbx`（`tsbx.dll`/`sandbox-center.exe`）；文件策略见 §4 |
| Trae | 【未验证】 | 【未验证】 | 自研 `sbox_sdk.dll` + `aiep_sbox.dll`：NT 层文件 API 拦截 + `CreateProcessWithTokenW` + 文件/网络 ACL + ALPC IPC |
| **共同机制** | — | — | **Windows = 受限令牌 + ACL**，三家独立收敛；自研的只是"拦得更深" |

**我们不做自研的核心理由**（`09-…` 决策 B 原文）：需提权安装 + 建系统账号 + 处理"人人可写目录"绕过点；
Codex 是 Rust 40+ 文件无法复用，Node 侧只能同机制重写。

### L6 提权与补救（被拦之后）

| | 给模型的出路 | 给用户的选项 |
|---|---|---|
| Codex | 沙箱拒绝 → 带 `retry_reason` 发起审批 → **第二次无沙箱重试**（但**有 deny-read 时永久禁止逃逸**） | 审批可路由给 `auto_review` subagent |
| WorkBuddy | ACP 工具调用审计 + 规则拦截 | 权限档位切换 |
| Trae | **错误里写清被拦路径/host + "可申请在沙箱外运行"** | "去 Settings → Conversation → Custom Sandbox Configuration 改规则" |
| **我们** | 权限门 block reason 应带「为什么 + 怎么办 + 提权入口」（当前只有 reason） | 首页+chat 权限 chip |

**最值得抄的交互**：Trae 那句错误文案同时服务模型与用户；Codex 的"有 deny-read 时禁止逃逸"
是**提权只能严格变宽**的工程化表述（与 dsh `WIDER_MODES` 一致）。

### L7 观测与诚实性

| | 结构化违规事件 | 是否假称隔离 | fail 方向 |
|---|---|---|---|
| Codex | `SandboxViolationEvent`（后端/原因/路径/↓512 字符片段）+ `SandboxEnforcement` 显式上报 | 否，明确 `full`/`partial` | **fail-closed**（无后端拒绝运行；bwrap 缺失启动告警） |
| WorkBuddy | SecurityCenter 审计 ACP 调用 | 否 | 混合：safe-delete fail-**closed**，但 fs shim **fail-OPEN**（`node-brokered-fs-shim.cjs:41-42`，**反面教材**） |
| Trae | 沙箱内建指标：block_file_counts / file_delete_to_recycle_counts / block_sandbox_drop_count / audit_file | 否，`environment-check` 报 `unsupported_reason` | fail-closed（不支持就明说 supported=false） |
| **我们** | 审批落 eventLog（待做） | `SandboxEnforcement` 一律 `partial`（已定） | **必须 fail-closed** |

---

## 4. Trae 的 `tsbx`/`sbox` 文件策略要点（可直接借表）

两家的 Windows 文件策略**形状几乎一样**：

| 概念 | WorkBuddy `tsbx_rules.json`【源码】 | Trae `SandboxConfig`【二进制】 |
|---|---|---|
| 默认动作 | `default_action: deny_write`（默认禁写，读放行） | 事件枚举含 `file_no_access`，规则表定义三段权限 |
| 三态文件权限 | `no_access` / `inherit_user` / 白名单放行 | `file_no_access` / `file_read_only` / `file_inherit_user` |
| 凭证目录 | `.ssh`、`.gnupg` → `no_access` | 未见默认清单【未验证】 |
| 删除保护 | `recyclebin_backup: true` | 默认进回收站 + `directly_delete_paths` 例外 |
| 目录类型化 | 按工具链目录逐条白名单（node/python/rust/…） | **`dir_type` = workspace/work/tmp/cache/lang_deps/other**（更抽象） |
| 网络 | `default: allow`，另有 Rust LocalProxy 管 TCP | `network_allow`/`network_deny` 支持 IP/CIDR + 域名 + 端口，tcp/udp 分列 |
| 企业下发 | SecurityCenter | 云端 `config_json` + 命令黑名单 + MCP 白名单（10 分钟轮询） |

**Trae 的 `dir_type` 抽象值得抄**：把「这个目录属于工作区/临时/缓存/语言依赖」作为一等概念，
用户不必逐条写绝对路径，规则量骤降。

---

## 5. 收敛出的「四方共同设计原则」（可直接写进我们的规范）

1. **两轴正交**：隔离档位 × 审批策略，互不替代；**预设只是两轴的捆绑 UI 糖**（dsh/Trae/Codex 一致）。
2. **deny 恒定优先**，且**受保护路径在任何档位都拦**（codex 的保护元数据、WorkBuddy 的 `denyRules.sandbox` 先于 bypass）。
3. **提权只能严格变宽**，审批 **fail-closed 且先于执行**；**有 deny-read 时禁止逃逸沙箱**。
4. **删除进回收站**是办公场景最高性价比的一条（三家都有，零平台依赖）。
5. **能力是数据**：规则放文件（codex `rules/*.rules`、WorkBuddy JSON 规则、Trae config_json），加规则=加文件。
6. **诚实上报**：隔离能力要显式标注（`full`/`partial`/不支持原因），**绝不静默降级**（WorkBuddy 的 fail-open shim 是唯一反面教材）。
7. **拦截要给两条出路**：给模型（带路径的 reason + 提权申请）与给用户（改规则入口）。
8. **厂商之间已在收敛词汇**（`read-only`/`workspace-write`/`danger-full-access` 逐字相同）——**别自创方言**。

---

## 6. 对 KamiBuddy 的行动清单

**立刻做（零平台依赖，本周可交付）**

- [ ] 权限求值链按 WorkBuddy 的**短路顺序**定型（hook → deny → 可信 allow → 命令安全检查 → ask → bypass → 不可信 allow → 模式策略 → 非交互 deny → 默认 ask），deny 恒定最高。
- [ ] 加 **`BANNED_PREFIX_SUGGESTIONS` 反包装列表**（`powershell -Command`/`-EncodedCommand`/`cmd /c`/`node -e`… 不可存为规则）。
- [ ] 开 PowerShell 前先落**危险命令检查器**：抄 WorkBuddy `checkPowerShellSecurity`（`iex`/`Invoke-Expression`/`Add-Type`/`-EncodedCommand`/IWR-IEX/LOLBin）三态（block/ask/allow）。
- [ ] **删除进回收站 + 失败 fail-closed**；`directly_delete_paths` 作例外白名单。
- [ ] 权限门的 block reason 补「被拦对象 + 为什么 + 怎么办 + 提权入口」（照 Trae 文案）。
- [ ] 受保护路径分「凭证目录(no_access) / 配置目录 / 项目元数据(.git)」三档，且**任何档位都拦**。

**结构上预留（类型先立，实现后补）**

- [ ] 沙箱模式 × 审批策略两个正交轴参数化（`decide(facts, paths, cwd, mode)`），默认值 = 今天行为（向后兼容 23 个测试）。
- [ ] `GranularApprovalConfig` 五字段的**类型位**（第一版只实现 ask/never，但字段先留）。
- [ ] 目录类型化（`dir_type`）作为 `PolicyPaths` 的一层映射。
- [ ] 预设放 `resources/`（能力即数据）。

**继续搁置（附诚实声明）**

- [ ] OS 沙箱自研：A 类威胁（跑不可信代码）**仍无技术防线**，界面与文档必须写清，`SandboxEnforcement` 保持 `partial`。

**待复核的既有结论（本次调研推翻了旧笔记的若干处）**

- `09-sandbox-and-permissions.md` §四 的 **5 处更正**（Codex 稿 §8 末尾）：审批默认值随信任变化、`untrusted` 已成 config 硬错误、
  Windows 沙箱不再是实验 feature、**完全漏掉网络代理（3128/8081 + SSRF 拦截）**、漏掉 shell 提权协议与反包装列表。
- WorkBuddy 的"9 阶求值链"：严格按代码是 **10 个短路出口**（hook 在函数外，不计入）。
- WorkBuddy 的 `network_rules`/`registry_rules` **解析但不强制**（`[TSBX] TODO: … not enforced`）——**别抄死配置**。

---

## 7. 证据缺口（三家各自的"没查清"）

- **Trae**：会话档位与沙箱规则的映射、UI 默认规则表、`sandbox_impl.json` 可选实现、网络域名匹配语义、提权审批 UX、macOS/Linux 实现。
- **WorkBuddy**：统一内容去毒管线是否存在、`sitecustomize.py` 内容、`tsbx` 是否内核态驱动（未见 `.sys`）、Windows 网络强制点。
- **Codex**：`windows-sandbox-rs` 逐行 ACL 流程、`network_approval.rs`、`guardian-context` 细节。

---
*三份底稿保留原始行号/偏移引用，本文只做交叉对比；未修改任何被调研产物。*
