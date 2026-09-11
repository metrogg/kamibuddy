# chart 模块：数据统计图表（HTML + Chart.js）

## 骨架模板

wrapper div 定高 + 唯一 id 的 canvas（无障碍三件套：role、aria-label、fallback 文本）+ cdnjs 的 Chart.js 4.x UMD 脚本 + 初始化脚本：

```html
<div style="position:relative;height:260px">
  <canvas id="chart-sales" role="img" aria-label="近六个月销售额柱状图">近六个月销售额柱状图：一月 120 万，二月 150 万……</canvas>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<script>
  new Chart(document.getElementById("chart-sales"), {
    type: "bar",
    data: { labels: ["一月","二月","三月","四月","五月","六月"], datasets: [{ data: [120,150,138,167,182,195], backgroundColor: "#2f6de0" }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
</script>
```

## 硬性规则

1. **必须 UMD + 普通 script 标签**：文件路径含 `chart.umd`，且 script 标签**不带** `type="module"`——module 脚本不会把 Chart 挂到 window，后面的 `new Chart(...)` 直接 ReferenceError。
2. **canvas id 全局唯一**：同一 widget 多张图时，id 加业务前缀区分（`chart-sales-trend`、`chart-sales-share`）；复用 id 会让后面的 `new Chart` 渲染到第一张图上。
3. **高度由 wrapper 决定，不由 canvas 决定**：wrapper div 写死 `height`，options 固定带 `responsive: true, maintainAspectRatio: false`——这样图表精确撑满容器，卡片高度也才能被宿主正确测量。
4. **配色硬编码 hex**：canvas 是位图，读不到 CSS 变量。图形颜色从 colors 模块速查表按数据系列顺序取主色；刻度、网格、标签文字按主题二选一：亮主题用灰 `#6e7683`，暗主题用 `#9aa1ab`。明暗分叉用 JS 判断：
   ```js
   const dark = matchMedia("(prefers-color-scheme: dark)").matches;
   const tickColor = dark ? "#9aa1ab" : "#6e7683";
   ```
5. **legend 默认关闭**：`plugins.legend.display: false`。需要区分多数据系列时，在 canvas 外做自定义 HTML 图例（一排"小色块 + 系列名"，色块 10×10 圆角 2px，文字 13px），别用 Chart.js 内置图例——它的样式与卡片格格不入。单数据系列不需要图例。

## 高度公式

- 垂直柱状图 / 折线图 / 雷达图：wrapper 高 **260px**。
- 饼图 / 环形图：wrapper 高 **240px**。
- **水平条形图（`indexAxis: "y"`）：wrapper 高 = 条数 × 40 + 80（px）**——每条 40px 含标签，80px 留给上下边距与坐标轴。条数超过 8 条就先合并尾部为"其他"。

## 表达规范

- 动画：保留 Chart.js 默认入场动画即可，时长不超过 800ms；不要写循环动画。
- 刻度与标签字号 11–12px；网格线用低透明灰（亮主题 `rgba(0,0,0,0.06)`，暗主题 `rgba(255,255,255,0.1)`），x 轴网格通常关闭。
- 数据标签（tooltip 之外的常驻数值）只在柱/条顶端需要时开启，字号 11px，颜色跟随刻度色。
- 图表标题、单位、数据来源写在 canvas 外的 HTML 里（`h2` 14px / 说明 13px），不要把标题画进 canvas。
- 一组对比关系只选一种图型：占比用饼/环，趋势用折线，对比用柱/条；同一份数据不要在一张卡片里画两遍。
