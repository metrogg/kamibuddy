/**
 * 模态焦点管理（全仓 9 处模态共用一份）。
 *
 * 为什么要有这个 hook：9 处模态都写了 `role="dialog"` / `aria-modal="true"`，此前却
 * 没有任何一处做焦点陷阱与焦点归还 —— `aria-modal="true"` 于是成了空声明：读屏被告知
 * 「这是模态」，键盘却能 Tab 到模态背后的界面；关闭后焦点掉回 `<body>`，键盘用户丢失
 * 位置。最要紧的是权限审批弹窗（daemon 侧正 await 的阻塞式安全闸，见
 * permission-dialog.tsx 头注），语义与行为不符的代价最高。
 *
 * 用法（ref 挂**模态卡片本身**，不是背板 `.modal-backdrop` —— 要圈住的是卡片）：
 *   const cardRef = useModalFocus();
 *   const cardRef = useModalFocus({ initialFocus: () => (risk === "high" ? denyRef.current : allowRef.current) });
 *   <div className="permission-card" role="alertdialog" aria-modal="true" ref={cardRef}>
 *
 * 只认「节点挂上 / 摘下」，不认 props 变化：模态内部的重渲染（勾选、展开详情）不该把
 * 焦点抢回去。需要「换了请求就重新聚焦」的模态由宿主挂 `key` 重挂载承接
 * （App.tsx：`<PermissionDialog key={approvals[0].id}>`）。
 */

import { useCallback, useEffect, useRef } from "react";

export interface ModalFocusOptions {
	/**
	 * 打开时优先聚焦的元素；返回 null 则退回容器内第一个可聚焦元素。
	 * 传 getter 而不是元素本身：它在节点挂上时才被调用，那时 ref 才有值。
	 */
	readonly initialFocus?: () => HTMLElement | null;
}

/*
 * 已打开模态的容器栈：Tab 只由**栈顶**（最后挂上的那个）处理。
 *
 * 嵌套是真实存在的：models-section 的「添加模型」弹层就渲染在 .settings-card 内部。
 * 两个 hook 都在 document 上听 keydown，若都处理，外层会按「设置卡全境」的可聚焦元素
 * 移动焦点（外层容器的 querySelectorAll 会穿透进内层弹层），于是 Tab 能从内层弹层跳到
 * 被它遮住的设置导航上 —— 陷阱反被外层拆掉。按挂载先后建栈，即天然对应层叠次序。
 */
const openModals: HTMLElement[] = [];

/** 容器内的可聚焦元素，按文档顺序。 */
function tabbablesWithin(container: HTMLElement): readonly HTMLElement[] {
	const found: HTMLElement[] = [];
	// 遍历全部后代逐个判定，不写 "button, input, a" 这类选择器清单：清单一定会漏
	// （自定义控件、contenteditable、以后新增的元素形态），漏掉的那个就是陷阱的出口。
	for (const element of container.querySelectorAll<HTMLElement>("*")) {
		if (isTabbable(element)) found.push(element);
	}
	return found;
}

function isTabbable(element: HTMLElement): boolean {
	// tabIndex < 0 一举排掉三类：显式 tabindex="-1" 的、默认就不可聚焦的（div、无 href 的
	// a…）、以及禁用控件（浏览器的默认值正是 -1）。
	if (element.tabIndex < 0) return false;
	// 再兜一层 :disabled（伪类，不列举标签名）：个别控件/浏览器上 tabIndex 的默认值不完全
	// 等于「能 Tab 到」，而 :disabled 还覆盖 fieldset[disabled] 的后代。
	if (element.matches(":disabled")) return false;
	// inert 子树里的元素浏览器不会聚焦（背景隔离给背板兄弟加的 inert 也走这条被排除）。
	if (element.closest("[inert]") !== null) return false;
	// 可见性不用 offsetParent 判：它对 position: fixed 的元素同样是 null，而固定定位
	// （浮层/模态）恰是这里的常态，用它会把整片内容误判为不可见。getClientRects() 问的是
	// 「生成了盒子没有」，display: none（含祖先 display: none）返回空。
	if (element.getClientRects().length === 0) return false;
	// visibility: hidden 仍然生成盒子，得单独看计算样式（它是继承属性，后代一并排掉）。
	const { visibility } = window.getComputedStyle(element);
	return visibility !== "hidden" && visibility !== "collapse";
}

/*
 * 背景隔离：给背板的**兄弟节点**（模态链之外的部分）标 inert，返回标过的节点供摘下时还原。
 *
 * 为什么还要 inert：Tab 陷阱只挡键盘，读屏仍会把背景当可用内容念出来，而 `aria-modal="true"`
 * 只是声明、不改浏览器的可访问性树 —— inert 才是真隔离（inert 子树既不响应交互，也整个
 * 被移出无障碍树）。
 *
 * 只碰背板的兄弟：背板自身与卡片在模态链上，inert 它们等于把模态也冻住。
 * 本来就是 inert 的兄弟（外层模态标的）跳过且**不记录** —— 记了就会在摘下时把外层的 inert
 * 一并清掉，等于内层把外层的背景隔离关掉。
 *
 * 例外：**toast 容器不标**（`.toast-stack`，见 toast.tsx）。全局模态（权限弹窗、设置卡）
 * 挂在 App 根，与它同级：标了 inert 就连 `role="status"` 的实时播报一起掐掉 ——
 * 而后台任务失败这类错误提示恰恰可能出现在模态开着的时候，提示「看不见也听不见」。
 * toast 高悬在模态之上（--z-toast）、只有文本与图标，不属于「模态背后的界面」。
 */
function isolateBackground(container: HTMLElement): readonly HTMLElement[] {
	// 背板类名取自 index.css：居中模态统一是 .modal-backdrop，专家详情是 .ex-modal-mask。
	const backdrop = container.closest(".modal-backdrop, .ex-modal-mask");
	const parent = backdrop?.parentElement ?? null;
	if (parent === null) return [];
	const marked: HTMLElement[] = [];
	for (const sibling of parent.children) {
		// 非 HTMLElement 的兄弟（SVG 等）没有 inert 这个能力，标不了，跳过。
		if (!(sibling instanceof HTMLElement)) continue;
		if (sibling === backdrop || sibling.inert) continue;
		if (sibling.matches(".toast-stack")) continue;
		sibling.inert = true;
		marked.push(sibling);
	}
	return marked;
}

export function useModalFocus(options: ModalFocusOptions = {}): React.RefCallback<HTMLDivElement> {
	/*
	 * 用 callback ref 而不是 `useRef` 对象：模态常常**先挂组件、后挂节点** —— chat-view 的
	 * 图片预览浮层与它所在的消息气泡同生命周期，要等用户点开图片才渲染出节点。ref 对象只在
	 * 组件挂载/卸载时可观察，「先无后有」的节点会被整段漏掉，陷阱与焦点归还一起静默失效。
	 * callback ref 恰好在节点挂上时跑，正好对齐「模态打开」。
	 */
	// 回调 identity 必须稳定（变了 React 会在每次重渲染时重挂 ref，于是每次都抢一次焦点），
	// 所以 options 不能进 deps；用「最新值 ref」让回调读得到当前渲染的 initialFocus。
	const latest = useRef(options);
	useEffect(() => {
		latest.current = options;
	});

	return useCallback((node: HTMLDivElement | null): (() => void) | undefined => {
		if (node === null) return undefined;

		// 打开它的元素，关闭时要还给它。必须此刻记下 —— 焦点一移进模态就再找不回来了。
		const opener = document.activeElement;
		const marked = isolateBackground(node);

		// ① 移入焦点：调用方指定的优先（指定节点已被条件渲染摘掉时退回），否则容器内第一个
		// 可聚焦元素。
		const preferred = latest.current.initialFocus?.() ?? null;
		const entry = preferred !== null && preferred.isConnected ? preferred : tabbablesWithin(node)[0];
		entry?.focus();

		openModals.push(node);

		// ② Tab 焦点陷阱。
		/*
		 * 拦截 keydown 而不是插哨兵元素：哨兵要在首尾各放一个可聚焦空节点，会污染 DOM 与
		 * 卡片内的选择器（`querySelectorAll` 也会数到它们），且被 Tab 到时会有可见的焦点跳动。
		 * 监听挂 document 而非容器：焦点万一不在容器内（打开瞬间、或鼠标点了非可聚焦处），
		 * 挂在容器上的监听根本收不到这次 keydown，Tab 就漏到背景去了。
		 */
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key !== "Tab") return;
			// 已有处理者的（组件自己的键盘逻辑）不抢。
			if (event.defaultPrevented) return;
			// 嵌套模态只由最上层处理（理由见 openModals 的注释）。
			if (openModals[openModals.length - 1] !== node) return;

			const items = tabbablesWithin(node);
			const first = items[0];
			const last = items[items.length - 1];
			if (first === undefined || last === undefined) {
				// 卡片里没有可聚焦元素：唯一能做的是不让这次 Tab 落到背景（焦点原地不动）。
				event.preventDefault();
				return;
			}

			const at = items.findIndex((item) => item === document.activeElement);
			if (at === -1) {
				// 焦点此刻不在卡片内（刚打开还没移入、或被鼠标点到非可聚焦处）：拉回边界 ——
				// Tab 给首元素、Shift+Tab 给末元素。
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
				return;
			}

			// 首尾回绕：末元素 Tab → 首元素、首元素 Shift+Tab → 末元素。
			// 反向步长写成 length - 1，回绕与「+1 取模」共用同一处下标运算。
			const next = items[(at + (event.shiftKey ? items.length - 1 : 1)) % items.length];
			if (next === undefined) return; // 清单非空时不可达，仅为类型收窄
			event.preventDefault();
			next.focus();
		};
		document.addEventListener("keydown", onKeyDown);

		// ③ 节点摘下即模态关闭。返回清理函数（React 19 的 callback ref 语义：返回了清理函数
		// 就不会再拿 null 调回调，见 react-dom 的 safelyDetachRef）。
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			const at = openModals.lastIndexOf(node);
			if (at !== -1) openModals.splice(at, 1);
			// 先摘 inert 再还焦点：要还给的按钮往往正是被标了 inert 的那批（「添加模型」按钮
			// 就是 add-model 背板的兄弟），inert 期间 focus() 不生效。
			for (const element of marked) element.inert = false;
			// 元素还在文档里才 focus：触发按钮随列表重建/条件渲染消失时，把焦点塞回已脱离文档
			// 的节点等于丢焦点，不如什么都不做、让浏览器自己决定落点。
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	}, []);
}
