# SVG 管线（所有 SVG 类 widget 的硬性前置）

## 坐标管线：viewBox 固定 680 宽

- 根元素写 `<svg viewBox="0 0 680 H" width="100%">`，其中 **680 是所有坐标计算的基准宽度，不许改**；宿主按 `width="100%"` 把整幅图缩放到卡片宽度，你只需要在 680 宽的坐标系里做绝对定位。
- **H = 最底部元素的 y + 该元素自身高度 + 20**（底部留白）。先排内容、再算 H，不要倒过来先拍一个整百数再往里塞。
- 片段里恰好只能有一个 `<svg>`。

## 安全区（safe area）

- 所有可见元素（含文字基线、连线端点、箭头）必须落在 **x ∈ [40, 640]、y ∈ [40, H−40]** 的矩形内。
- 左右各 40、上下各 40 是呼吸区，不是可用画布；贴边排版在卡片里会显得顶格。

## 背景

- **背景透明**：不要铺整幅底色 rect——宿主卡片自带底色，再铺一层会露出色差和圆角缺口。
- 需要底色强调的小块（节点、标签、容器），用 colors 模块的浅底色，配 10–24px 圆角。

## 预置 class（宿主注入样式，直接引用，不要自己重复定义同名类）

| class | 用途 |
| --- | --- |
| `t` | 正文文字（13px，主文字色） |
| `ts` | 辅助小字（弱化色，刻度、注释、来源） |
| `th` | 标题文字（14px，字重 500） |
| `box` | 容器框（圆角、浅底、细描边） |
| `node` | 流程节点（在 box 基础上带节点语义配色） |
| `arr` | 连接线与箭头（描边色，`fill: none`） |
| `leader` | 引导线/标注线（更细更弱） |

## 连线与箭头

- 所有 `path` / `polyline` / `line` 一律 `fill="none"`，描边宽 1–1.5px；折线拐点用直角或 `stroke-linejoin="round"`。
- 箭头用 marker，defs 里声明一次、所有连线复用；连线元素设 `color` 与 `stroke` 同色，marker 填 `currentColor`，箭头颜色即自动跟随连线：

```svg
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor"/>
  </marker>
</defs>
<!-- 连线：stroke 与 color 同色，末端挂箭头 -->
<path class="arr" d="M 120 80 H 240" stroke="currentColor" color="#6e7683" fill="none" marker-end="url(#arrow)"/>
```

- 同一 widget 只有一个 marker id；多个不同色箭头时用 `arrow-blue`、`arrow-gray` 这类带色后缀的 id，不许重复定义同 id。

## 尺寸估算（排布前先算账）

- **盒宽估算**：盒宽 ≈ 标题字符数 × 7 + 内边距（左右各 16，即 +32）。全角字符（中文、全角标点）按 2 个字符计。算完再检查整排是否超出 safe area 的 640 右界。
- **文字定位**：盒内单行文字用 `text-anchor="middle"`、x 取盒中心 x；y ≈ 盒中心 y + 4.5（13px 字号的视觉中线补偿）。
- **盒高**：单行文字节点 40px，需要两行文字时 56px；文字行距 18px。

## 自检清单（提交前过一遍）

1. viewBox 是 `0 0 680 H`，且 H 由最底元素 +20 算出；
2. 所有元素在 safe area 内；
3. 没有背景 rect、没有第二个 `<svg>`；
4. 连线全部 `fill="none"`，箭头走 marker；
5. 文字全部用 `t` / `ts` / `th` 预置 class，没有内联 font-size。
