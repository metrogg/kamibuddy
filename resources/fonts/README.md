# MiSans 随包字体说明

## 为什么随包

界面大量 `font-weight:600` 在微软雅黑上只能合成加粗（雅黑无真 600 字重），笔画发虚，
12-14px 小字号尤其明显。MiSans 有真 Semibold 字重且针对小字号屏显优化，故随包其
子集作为 Windows 中文 UI 字体；macOS 仍用系统苹方，雅黑降级为兜底。

## 字体文件位置与接入

实际 woff2 在 `src/renderer/fonts/`（renderer 是 vite 构建根，CSS `url()` 相对引用
才会被打包进产物；`resources/` 是主进程运行时读取的目录，不进 renderer bundle）：

- `MiSans-Regular.woff2`（@font-face `font-weight: 400`）
- `MiSans-Semibold.woff2`（@font-face `font-weight: 600`）

`src/renderer/index.css` 顶部声明 @font-face（`font-display: swap`），body 字体栈中
`"MiSans"` 位于 `"PingFang SC"` 之后、`"Segoe UI"` 之前。

## 来源

- 上游字体：小米 MiSans（小米科技有限责任公司，联合汉仪/蒙纳制作），
  官方发布页 https://hyperos.mi.com/font/download
- 实际下载点：开源镜像仓库 dsrkafuu/misans 的全量 TTF
  - https://raw.githubusercontent.com/dsrkafuu/misans/main/raw/Normal/ttf/MiSans-Regular.ttf
  - https://raw.githubusercontent.com/dsrkafuu/misans/main/raw/Normal/ttf/MiSans-Semibold.ttf
  - 下载日期 2026-09-12，字节数与 GitHub API 列出的一致（8073152 / 7984932）

## 许可证（《MiSans 字体知识产权许可协议》）

关键条款（摘自小米官方协议文本，经 misans-webfont npm README 转录核对）：

- 「MiSans Global 所有的字体都是供全球免费商用，您可以在任何平台、任何商业项目中
  使用所有字体。」
- 嵌入式使用：「可以。但您应在软件中特别注明使用了 MiSans 字体。」
  —— 本 README 即仓库内的注明；应用内注明位置待「关于」页落地时补（当前无关于页）。
- 义务三条：
  1. 在软件中特别注明使用了 MiSans 字体；
  2. 不得对字体字形外观改编或二次开发（子集化只删字形不改外观，
     与各家 webfont 分包实践一致）；
  3. 不得单独分发/售卖字体本身（随应用整体分发、用于渲染界面不受此限；
     用字体创作的作品可自由分发）。

## 子集口径（复现方法）

字符集 3876 字 = ASCII 可打印（0x20-0x7E）+ GB2312 一级汉字 3755 字
（区位 16-55；末区 0xD7 只到 0xF9）+ 常用中文标点
（，。、；：？！""''（）《》—…·！～【】「」￥）+ 常用符号（→←↑↓✓✗）。
未覆盖的字（二级汉字/生僻字）由系统雅黑兜底渲染，不影响可用性。

```sh
pip install fonttools brotli
pyftsubset MiSans-Regular.ttf --text-file=charset.txt --flavor=woff2 \
  --output-file=MiSans-Regular.woff2 --layout-features='*'
# Semibold 同理
```

产物大小：Regular 483904 B（≈473 KB）、Semibold 489152 B（≈478 KB），远低于 2MB 上限。
`--layout-features='*'` 保留全部 OpenType 特性（tnum 等，`font-variant-numeric` 依赖）。
