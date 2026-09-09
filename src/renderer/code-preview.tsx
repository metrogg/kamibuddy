/**
 * 代码预览：Monaco Editor 只读高亮（对标 WorkBuddy 的代码预览，Task 3）。
 *
 * 引入方式（最小体积路线）：不引 editor.main 全量——0.56 的 editor.main 带
 * LSP client 和 ts/css/html 语言服务，只读预览用不到，激活时还要再拖三个
 * 大 worker（ts.worker 一个就数 MB）。这里按 0.56 的 features/languages
 * 注册入口 cherry-pick（exports map 只允许 monaco-editor/<vs 内路径> 这种
 * 不带 esm/vs 前缀的深导入）：
 *   - editor.api + 少量 feature（find / folding / 右键菜单 / 剪贴板 / 括号匹配 /
 *     链接 / codicon 字体）；
 *   - 基础语言 monarch tokenizer：register 只登记元数据，tokenizer 本体在首次
 *     打开该语言时动态 import（vite 拆成各自的小 async chunk），主线程执行；
 *   - JSON 例外：没有 basic-language，tokenizer 在语言服务里 → 配 json worker
 *     （顺带得到校验与折叠）。
 *
 * worker 方案与 pdf-preview.tsx 同：vite `?worker` 打进本地 chunk，零网络依赖
 * （办公场景可能离线，不走 CDN）。MonacoEnvironment.getWorker 按 label 分发：
 * json → json worker，其余（链接检测等后台计算）一律 editor worker。
 */

import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/editor/editor.api";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/languages/features/json/json.worker?worker";

import "monaco-editor/features/codicon/register";
import "monaco-editor/features/find/register";
import "monaco-editor/features/folding/register";
import "monaco-editor/features/contextmenu/register";
import "monaco-editor/features/clipboard/register";
import "monaco-editor/features/bracketMatching/register";
import "monaco-editor/features/links/register";

import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/languages/definitions/python/register";
import "monaco-editor/languages/definitions/css/register";
import "monaco-editor/languages/definitions/html/register";
import "monaco-editor/languages/definitions/xml/register";
import "monaco-editor/languages/definitions/yaml/register";
import "monaco-editor/languages/definitions/markdown/register";
import "monaco-editor/languages/definitions/shell/register";
import "monaco-editor/languages/definitions/ini/register";
import "monaco-editor/languages/features/json/register";

globalThis.MonacoEnvironment = {
	getWorker: (_workerId, label) => (label === "json" ? new JsonWorker() : new EditorWorker()),
};

export function CodePreview({
	content,
	language,
}: {
	readonly content: string;
	readonly language: string;
}): React.JSX.Element {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);

	// 编辑器实例只建一次：换文件走换 model，比销毁重建便宜。
	// model 必须随换/随弃——monaco 的 model 是全局注册表，不 dispose 会泄漏。
	useEffect(() => {
		const host = hostRef.current;
		if (host === null) return;
		const editor = monaco.editor.create(host, {
			readOnly: true,
			minimap: { enabled: false },
			wordWrap: "on",
			fontSize: 13,
			scrollBeyondLastLine: false,
			// 面板拖拽调宽/全屏靠它跟随容器 resize，不用自己挂 ResizeObserver。
			automaticLayout: true,
			// 浅色，对齐 WorkBuddy 浅色主题。
			theme: "vs",
		});
		editorRef.current = editor;
		return () => {
			editorRef.current = undefined;
			editor.getModel()?.dispose();
			editor.dispose();
		};
	}, []);

	useEffect(() => {
		const editor = editorRef.current;
		if (editor === undefined) return;
		// 先挂新 model 再弃旧的：dispose 挂在编辑器上的 model 时编辑器会瞬时无 model。
		const old = editor.getModel();
		editor.setModel(monaco.editor.createModel(content, language));
		old?.dispose();
	}, [content, language]);

	return <div className="preview-code" ref={hostRef} />;
}
