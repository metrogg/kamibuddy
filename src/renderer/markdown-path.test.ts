import { describe, expect, it } from "vitest";
import { detectPath, truncatePathDisplay } from "./markdown-path.ts";

describe("detectPath（行内 code 路径形态判定）", () => {
	it("Windows 绝对路径（反斜杠/正斜杠）→ file", () => {
		expect(detectPath(String.raw`C:\Users\wzd\KamiBuddy\调研.md`)).toMatchObject({
			isPath: true,
			kind: "file",
			purePath: String.raw`C:\Users\wzd\KamiBuddy\调研.md`,
		});
		expect(detectPath("C:/Users/wzd/report.docx").kind).toBe("file");
	});

	it("POSIX 绝对路径 → file", () => {
		expect(detectPath("/home/wzd/notes/todo.txt")).toMatchObject({
			isPath: true,
			kind: "file",
		});
	});

	it("以分隔符结尾 → directory", () => {
		// 反引号模板不能以 \ 结尾（\` 是转义），这条用普通转义字符串。
		expect(detectPath("C:\\Users\\wzd\\KamiBuddy\\").kind).toBe("directory");
		expect(detectPath("src/renderer/").kind).toBe("directory");
	});

	it("最后一段无扩展名 → directory", () => {
		expect(detectPath("src/renderer").kind).toBe("directory");
	});

	it("相对路径与纯文件名", () => {
		expect(detectPath("docs/spec.md")).toMatchObject({ isPath: true, kind: "file" });
		expect(detectPath("README.md")).toMatchObject({ isPath: true, kind: "file" });
	});

	it("#L 行号后缀：剥出行号范围，purePath 不含后缀", () => {
		expect(detectPath("src/main.ts#L10-L20")).toMatchObject({
			isPath: true,
			kind: "file",
			purePath: "src/main.ts",
			range: { start: 10, end: 20 },
		});
		expect(detectPath(String.raw`C:\a\b.ts#L5`).range).toEqual({ start: 5 });
	});

	it("普通文本不误判：符号、URL、孤立词", () => {
		for (const text of ["user_id", "https://example.com", "hello", ".", "./"]) {
			expect(detectPath(text).isPath, text).toBe(false);
		}
	});

	// 「application/json」这类媒体类型形态上就是相对路径 —— 形态判定放行，
	// 靠调用方的存在性校验（artifact:stat）挡掉，这正是检测分两步的原因。
	it("媒体类型形态像相对路径：形状放行、留给存在性校验过滤", () => {
		expect(detectPath("application/json").isPath).toBe(true);
	});

	it("空串与纯分隔符不是路径", () => {
		expect(detectPath("").isPath).toBe(false);
		expect(detectPath("/").isPath).toBe(false);
	});
});

describe("truncatePathDisplay（徽章显示截断）", () => {
	it("不超长长原样返回", () => {
		expect(truncatePathDisplay("a/b.md")).toBe("a/b.md");
	});

	it("超长保留目录开头与文件名", () => {
		const out = truncatePathDisplay(String.raw`C:\Users\wzd\KamiBuddy\临时任务\AI-Agent记忆模块调研.md`);
		expect(out.startsWith(String.raw`C:\Users`)).toBe(true);
		expect(out).toContain("...");
		expect(out.endsWith("AI-Agent记忆模块调研.md")).toBe(true);
		expect(out.length).toBeLessThanOrEqual(40);
	});

	it("文件名占满预算时中段省略", () => {
		const long = `${"x".repeat(50)}.md`;
		const out = truncatePathDisplay(long);
		expect(out).toContain("...");
		expect(out.length).toBeLessThanOrEqual(40);
	});
});
