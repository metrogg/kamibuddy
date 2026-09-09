/**
 * 扩展名 → Monaco 语言 ID 的映射（代码预览，Task 3）。
 *
 * 语言 ID 以 monaco 0.56 为准：基础语言在 languages/definitions/<lang>/register
 * （monarch tokenizer，主线程懒加载）；**json 例外**——它没有 basic-language，
 * tokenizer 挂在语言服务上，走 languages/features/json（code-preview.tsx 配 json worker）。
 * 没有对应语言的格式（toml / env / prisma…）用语义最近的近似或 plaintext。
 */

const LANGUAGE_BY_EXT: Readonly<Record<string, string>> = {
	".js": "javascript",
	".mjs": "javascript",
	".cjs": "javascript",
	".jsx": "javascript",
	".ts": "typescript",
	".tsx": "typescript",
	".py": "python",
	".json": "json",
	".css": "css",
	// html 在 artifact-panel 的 kindOf 里先被 iframe 分支拦截，这两条映射
	// 只在「将来要看源码」的路径上才用得到。
	".html": "html",
	".htm": "html",
	".md": "markdown",
	".markdown": "markdown",
	".yaml": "yaml",
	".yml": "yaml",
	".xml": "xml",
	// Monaco 没有 toml：ini 的 section 头 + key=value 高亮是最接近的近似。
	".toml": "ini",
	".ini": "ini",
	// KEY=VALUE 与 ini 同构（.env 走 extOf 得到的扩展名就是 ".env"）。
	".env": "ini",
	".sh": "shell",
	".bash": "shell",
	// Monaco 0.56 无 prisma / csv / log / gitignore 语言，按纯文本进 Monaco
	//（要的是行号与只读视图，不是高亮）。
	".prisma": "plaintext",
	".csv": "plaintext",
	".log": "plaintext",
	".gitignore": "plaintext",
};

/**
 * 不进 Monaco 的扩展名：.txt/.log 保持裸 <pre>（不高亮，没必要拖编辑器）；
 * .md/.markdown 走 Markdown 富文本预览（MARKDOWN_EXTS 先拦截，同 Task 4）；
 * .csv 走 Office 表格预览（OFFICE_FORMATS 先拦截）。表里的 markdown/csv 映射
 * 只是数据完备性，路由到不了这里。
 */
const PLAIN_TEXT_EXTS: ReadonlySet<string> = new Set([".txt", ".md", ".markdown", ".csv", ".log"]);

/** 代码预览（Monaco）接管的扩展名。 */
export function isCodePreviewExt(ext: string): boolean {
	return LANGUAGE_BY_EXT[ext] !== undefined && !PLAIN_TEXT_EXTS.has(ext);
}

/** 扩展名 → Monaco 语言 ID；表外一律 plaintext（Monaco 内置）。 */
export function codeLanguageOf(ext: string): string {
	return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}
