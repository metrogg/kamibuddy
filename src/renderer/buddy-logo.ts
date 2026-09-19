/**
 * 应用 logo 在界面里的唯一入口（两处用同一份图：侧栏底部的品牌徽标、回合头的 agent 头像）。
 *
 * **来源与规格**：用户提供的 `docs/buddy.png`（1254×1254，1.1 MB）——与应用图标
 * `build/icon.png`（electron-builder 的 `win.icon`）同源。这里放的是它的 **96×96 缩放件**：
 * 界面里最大只用到 24px（回合头头像 24、侧栏徽标 22），96 已覆盖 4 倍屏；把 1.1 MB 原图
 * 直接当 renderer 资产引进来是无谓的包体（缩放件 9.4 KB）。
 *
 * 换 logo 时改的是 `docs/buddy.png`，这份缩放件要跟着重出（同一张图只有一个真源，
 * 与 `build/icon.png` 的口径一致）。为什么要单独一个模块而不是各自 `import` 那张 PNG：
 * 光栅图自身带不了「它从哪来、该多大」这两条信息，两处各写一遍注释必然漂移。
 */
import buddyUrl from "./assets/buddy.png";

export const BUDDY_LOGO = buddyUrl;
