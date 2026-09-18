# 首页预设（能力胶囊 + 最佳实践案例）

首页输入框上方那一横条**能力胶囊**，和下方**最佳实践案例**卡片的数据。

加载器：`src/core/resources.ts` 的 `loadWelcome`（坏数据抛错，不静默少一块）；
下发链路：daemon 随会话快照的 `welcome` 字段给 renderer；渲染见
`src/renderer/home-view.tsx`，选取逻辑（过滤/分页/下钻）在 `src/renderer/home-presets.ts`。

## 来源与来历（AGENTS.md §6）

素材**照搬 WorkBuddy**（内部使用阶段允许；正式上线前由专人做风险置换），
两个公开数据源：

| 文件 | 来源 | 取法 |
|---|---|---|
| `cases.json` | WorkBuddy 案例库静态站 `https://static.workbuddy.cn/workbuddy/playbook/` | `registry.json`（1053 条）里按 id 取 12 条：标题/副标题/提示词/封面**原文照搬** |
| `chips.json`（work 4 个） | 同上 registry 的 `scenario` / `scenario_id` 分组 | WorkBuddy 首页胶囊就是按 `scenario_id` 分组的案例（100 文档处理 / 102 数据分析及可视化 / 103 深度研究 / 105 幻灯片） |
| `chips.json`（code 4 个） | `https://copilot.tencent.com/v2/as/support/scenes?locale=zh-CN`（**不鉴权**） | WorkBuddy 代码场景没有云端胶囊，它的胶囊来自这份本地场景模板，提示词原文照搬 |

抓取时间：2026-09（对应 registry `updated_at = 2026-09-14`）。

**照搬的边界**：胶囊名、案例标题/副标题/提示词/封面都是原文；`description`
（胶囊 tooltip）与 `icon` 键是我们自己写的（WorkBuddy 的胶囊只有名字）。

## 字段

`chips.json`（数组）：

| 字段 | 说明 |
|---|---|
| `id` | 唯一标识，`cases.json` 的 `chipId` 指向它 |
| `scene` | 归属场景轴，必须是 `resources/scenes/<id>/` 里存在的场景（写错加载即报错） |
| `label` / `description` | 胶囊文字与 tooltip |
| `icon` | 图标键（`doc`/`chart`/`slide`/`research`/`code`/`web`/`terminal`），组件映射在 `home-view.tsx` 的 `CHIP_ICONS` |
| `chipKind` | `playbook` 或 `scene`，只决定提示词从哪来 |
| `prompts` | 仅 `chipKind: "scene"` 用：内联提示词数组 |

`cases.json`（数组）：`id` / `chipId` / `title` / `subtitle` / `prompt` / `expert` / `cover`。

## 案例绑定的专家（已随包预装）

WorkBuddy 的每条案例都带一个专家（上游字段 `experts[0].id`，如 `TechnicalDocumentationEngineer`）。
这些专家已搬进 `resources/experts/`（人设 + 各自私有技能，来源见各专家目录的 README.md），
`cases.json` 的 `expert` 存的是**我们的专家目录名**：

| 案例 | WorkBuddy 专家 id | 我们的目录 |
|---|---|---|
| doc-book-summary-notes / doc-api-reference | TechnicalDocumentationEngineer | `technical-documentation-engineer` |
| doc-meeting-decision-digest | OpenSpecDocTeam | `openspec-doc-team` |
| data-global-population-structure / data-ecommerce-rfm-value | DataAnalyticsReporter | `data-analytics-reporter` |
| data-gdp-hdi-explorer | VisualStorytellingExpert | `visual-storytelling-expert` |
| research-cheetah-conservation | DeepResearchExpert | `deep-research` |
| research-gold-price-drivers | FsiMarketResearcher | `market-researcher` |
| research-ai-coding-business-model | TrendResearcher | `trend-researcher` |
| ppt-popmart-brand-intro / ppt-journey-west-intro | PptCreationExpert | `ppt-creation-expert` |
| ppt-ai-history-timeline | DeveloperEvangelist | `developer-evangelist` |

`expert` 目前只进数据与校验（`resources.test.ts` 断言它指向真实存在的专家目录），
**尚未参与交互** —— WorkBuddy 是点卡片时顺带安装/启用该专家，我们还没有这一步。

## 依赖的插件（已随包预装）

WorkBuddy 在发送时会按场景模板的 `plugins` 字段自动装插件，我们没有那条市场链路，
改成**预装**：插件原样落在 `resources/plugins/`，建会话时自动纳入技能搜索路径。
对应关系（WorkBuddy 的 `plugins` 字段原文）：

| 胶囊 | 依赖插件 |
|---|---|
| 文档处理 | `document-skills` |
| 数据分析及可视化 | `data-analysis`（市场里实际叫 `data`） |
| 深度研究 | `deep-research` |
| 幻灯片 | `ppt-implement` |
| 网站开发 | `modern-webapp` |
| 日常开发 / CI/CD / 文档 | 无 |

来源、版本、许可与**待适配项**见 [../plugins/README.md](../plugins/README.md)。

## 加一个胶囊或案例

只改数据，零行代码：

- **加一个 case**：往 `cases.json` 追一条，`chipId` 指向已有胶囊即可（胶囊的下钻列表
  与卡片列表共用这份数据，不会漂移）；
- **加一个胶囊**：`chips.json` 追一条；`playbook` 类型必须至少配一条 case（否则点开是
  空列表，加载器会报错），`scene` 类型必须给非空 `prompts`。

## 已知差异 / 待办（对比测试时注意）

- **work 胶囊只取了 4 个**（WorkBuddy 日常办公下共 8 个：还有金融服务 / 产品管理 /
  视频生成 / 个人工作台）。补的话按 `scenario_id` 101 / 106 / 104 / 122 再取。
- **案例只取了 12 条**（每胶囊 3 条），筛选条件是「无 skills / 无 mcps 依赖」，
  其余 1041 条在 CDN 上可按需再取。
- **代码场景的提示词带云端依赖**：WorkBuddy 的「网站开发」胶囊原文里写「数据使用云端
  数据库存储」——我们还没有这条路，照搬保留原文；真的跑不通时按 §6 做兼容改写
  （这正是「照搬优先、跑不通再适配」的顺序）。
- **封面是远程图**：直接引它的 CDN 地址（CSP `img-src` 已放行 `https:`），加载失败
  回落图标底。WorkBuddy 为断网场景单独做了主进程 `wb-cover://` 磁盘缓存 + 降采样
  （COS 响应不带 Cache-Control），我们暂未做 —— 需要离线可用时照它补。
- **胶囊点击后的「插件自动安装」没搬**：改成随包预装（见上一节）——数据里因此不含
  `plugins` 字段，插件版本固定在本仓库，不跟它的市场变。
