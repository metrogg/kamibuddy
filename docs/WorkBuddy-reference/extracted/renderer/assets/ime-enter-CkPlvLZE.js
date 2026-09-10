import { n as __esmMin } from "./rolldown-runtime-D5a2oYpF.js";
//#region ../../packages/agent-ui/src/utils/ime-enter.ts
function createImeEnterGuard(now = () => Date.now()) {
	let composing = false;
	let consumeEnterUntil = 0;
	return {
		onCompositionStart() {
			composing = true;
		},
		onCompositionEnd() {
			composing = false;
			consumeEnterUntil = now() + 100;
		},
		isComposing() {
			return composing;
		},
		shouldBlockSendOnEnter(event) {
			if (event.key !== "Enter") return false;
			if (composing || event.isComposing || event.keyCode === 229) return true;
			if (now() < consumeEnterUntil) {
				consumeEnterUntil = 0;
				return true;
			}
			return false;
		}
	};
}
/** 从 React 键盘事件判断这次 Enter 是否属于输入法确认候选。 */
function shouldBlockImeEnter(event, guard) {
	return guard.shouldBlockSendOnEnter({
		key: event.key,
		isComposing: event.nativeEvent?.isComposing,
		keyCode: event.keyCode
	});
}
var init_ime_enter = __esmMin((() => {}));
//#endregion
export { init_ime_enter as n, shouldBlockImeEnter as r, createImeEnterGuard as t };
