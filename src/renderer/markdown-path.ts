/**
 * 行内 code 的文件路径检测（纯函数，可单测）。
 *
 * 机制对标 WorkBuddy 的 path-detector（lib-chat-ui path-detector.ts）：
 * 只对行内 code 文本做形态判定 —— 正则判「长得像路径」，真实存在性由
 * 调用方另行校验（WorkBuddy 比对会话资源列表，我们走 artifact:stat 探测），
 * 两步都过才渲染成可点徽章。少了存在性这一步，`application/json` 这类
 * 相对路径形态的普通文本都会被误判成徽章。
 *
 * 与 WorkBuddy 的差异：不做 symbol 类型（那是 IDE 代码符号跳转，
 * 它的 openPath 对 symbol 直接 return，桌面办公场景没有消费方）。
 */

/** 检测结果的路径类型。 */
export type PathKind = "file" | "directory";

export interface PathDetection {
	/** 形态上是否像路径（存在性不在此处判断）。 */
	readonly isPath: boolean;
	readonly kind: PathKind;
	/** 剥掉 #L 行号后缀的纯路径。 */
	readonly purePath: string;
	/** `#L10-L20` 行号范围（仅文件有意义）。 */
	readonly range?: { readonly start: number; readonly end?: number };
}

/** Windows 盘符或 POSIX 根开头的绝对路径。 */
const ABSOLUTE_PATH_PATTERN = /^(?:[a-zA-Z]:[\\/]|[\\/])(?:[^\\/]+[\\/])*[^\\/]+[\\/]?$/;
/** 含分隔符的相对路径（可带结尾分隔符的目录形态），或带扩展名的纯文件名。 */
const RELATIVE_PATH_PATTERN = /^(?![.\\/]$)(?!^$)(?:[^\\/]+(?:[\\/][^\\/]+)+[\\/]?|(?:[^\\/]+)\.(?:[a-zA-Z0-9]+))$/;
/** 纯文件名（name.ext）。 */
const FILENAME_PATTERN = /^(?:[^\\/]+)\.(?:[a-zA-Z0-9]+)$/;
/** 行号后缀：`file.ts#L10` 或 `file.ts#L10-L20`。 */
const CODE_RANGE_PATTERN = /^(.+?)#L(\d+)(?:-L(\d+))?$/;

function baseName(path: string): string {
	return path.split(/[\\/]/).pop() ?? path;
}

/** 形态判定：像不像路径、是文件还是目录。存在性由调用方校验。 */
export function detectPath(code: string): PathDetection {
	const notPath: PathDetection = { isPath: false, kind: "file", purePath: code };

	const rangeMatch = CODE_RANGE_PATTERN.exec(code);
	const purePath = rangeMatch?.[1] ?? code;
	const range =
		rangeMatch === null
			? undefined
			: {
					start: Number(rangeMatch[2]),
					...(rangeMatch[3] !== undefined ? { end: Number(rangeMatch[3]) } : {}),
				};

	const isAbsolute = ABSOLUTE_PATH_PATTERN.test(purePath);
	const isRelative = RELATIVE_PATH_PATTERN.test(purePath);
	if (!isAbsolute && !isRelative) return notPath;

	// 以分隔符结尾的是目录；否则看最后一段：带扩展名是文件，不带是目录。
	const kind: PathKind =
		/[\\/]$/.test(purePath) || !FILENAME_PATTERN.test(baseName(purePath))
			? "directory"
			: "file";
	return { isPath: true, kind, purePath, ...(range === undefined ? {} : { range }) };
}

/**
 * 徽章显示文本：路径超长时保留「目录开头…文件名」，再放不下就中段省略。
 * 截断在文本层做（WorkBuddy 同口径），不靠 CSS max-width —— 内联徽章
 * 折行时 max-width 会让两行各缺一块。
 */
export function truncatePathDisplay(code: string, maxLen = 40): string {
	if (code.length <= maxLen) return code;
	const name = baseName(code);
	const dirPart = code.slice(0, code.length - name.length);
	const dirBudget = maxLen - name.length - 3; // 3 = "..."
	if (name.length > 0 && dirBudget >= 4) {
		return `${dirPart.slice(0, dirBudget)}...${name}`;
	}
	// 文件名本身就占满预算：中段省略。
	const head = Math.ceil((maxLen - 3) / 2);
	const tail = Math.floor((maxLen - 3) / 2);
	return `${code.slice(0, head)}...${code.slice(code.length - tail)}`;
}
