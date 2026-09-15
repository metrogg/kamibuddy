/**
 * xlsx / xls / csv 预览：fortune-sheet 只认自己的数据模型（<Workbook data>），
 * 不解析文件，转换链路与 WorkBuddy 同机制：
 *   .xlsx            → @corbe30/fortune-excel 的 transformExcelToFortune 解 ZIP 转数据
 *   .csv / .xls(旧)  → SheetJS 先重写成 xlsx 字节（fortune-excel 的 HandleZip 只认
 *                      ZIP 结构，旧 OLE2 与纯文本都得先换皮），再走同一条转换链
 *
 * 独立成文件是 React.lazy 拆 chunk 的需要（见 office-preview.tsx 头注释）；
 * SheetJS 与 fortune-excel 在 effect 里二次动态 import，csv/xls 才会拉 SheetJS。
 */

import { useEffect, useRef, useState, type ComponentProps, type ComponentRef } from "react";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { ErrorState, Skeleton } from "./state-views.tsx";

type SheetData = ComponentProps<typeof Workbook>["data"];
type WorkbookHandle = ComponentRef<typeof Workbook>;

/** fortune-excel 产物的最小形状（库的签名全是 any，这里只窄化我们要碰的字段）。 */
interface RawSheet {
	row?: unknown;
	column?: unknown;
	celldata?: { r: number; c: number; v: unknown }[];
}

function positiveInt(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
	return Math.floor(value);
}

/** 行/列数缺省时从单元格数据推导下限，再兜一个够滚动的网格（84×60 与库默认对齐）。 */
function derivedCount(celldata: RawSheet["celldata"], key: "r" | "c", fallback: number): number {
	let max = -1;
	for (const entry of celldata ?? []) max = Math.max(max, entry[key]);
	return Math.max(max + 1, fallback);
}

/**
 * fortune-excel 把带 quotePrefix（qp=1）的文本单元格在 v/m 前补了字面量 `'`，
 * fortune-sheet 会把它当内容渲染出来。Excel 语义里 quotePrefix 永不显示，剥掉。
 */
function stripQuotePrefixes(sheet: RawSheet): void {
	for (const entry of sheet.celldata ?? []) {
		if (typeof entry.v !== "object" || entry.v === null) continue;
		const cell = entry.v as Record<string, unknown>;
		if (cell["qp"] !== 1) continue;
		for (const key of ["v", "m"] as const) {
			const value = cell[key];
			if (typeof value === "string" && value.startsWith("'")) cell[key] = value.slice(1);
		}
	}
}

/**
 * fortune-excel 有时产出 row/column 为 0 或缺省，fortune-sheet 拿到会渲染成空表。
 * 除行列数外其余字段原样透传——产物本来就是 fortune-sheet 的数据模型，
 * 库签名是 any，只能在此处做一次受控断言。
 */
function normalizeSheets(raw: unknown): SheetData {
	if (!Array.isArray(raw) || raw.length === 0) throw new Error("表格内容为空");
	return raw.map((entry) => {
		const sheet = entry as RawSheet;
		stripQuotePrefixes(sheet);
		return {
			...sheet,
			row: positiveInt(sheet.row) ?? derivedCount(sheet.celldata, "r", 84),
			column: positiveInt(sheet.column) ?? derivedCount(sheet.celldata, "c", 60),
		} as SheetData[number];
	});
}

function fileNameOf(url: string): string {
	const path = url.split(/[?#]/)[0] ?? url;
	return decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
}

/**
 * 解析期表格骨架。与 docx/pdf 的"纸张"骨架不同，这里要对齐的不是纸、而是**满区**：
 * fortune-sheet 的根节点是 100%×100%（`.office-sheet-host` 只给死尺寸），真实表格是
 * 铺满内容区的滚动网格，没有纸、没有居中留边、也没有厚度 —— 所以骨架只承诺同一件事：
 * 一块 `--bg` 白面铺满内容区（白面必须铺满：容器底色是 `--bg-raised` 灰，露灰就不像表格了）。
 *
 * 行列数要解析完才知道，故行数写死、格子按列对齐（真实表格的列宽也是常量，列对齐才像表）。
 * 行高是骨架自己的节奏，不追真实行高：单元格的实际高度由列宽/字号/换行共同决定，且表格到达时
 * 整块替换（`.office-sheet-host` 是 overflow:hidden 的死尺寸容器），不存在"到达后位移"的面。
 */
const SHEET_SKELETON_ROWS = 12;
const SHEET_ROW_HEIGHT = 24;
/** 每列一档宽度（px）：同一列等宽，纵向才对得上格子。 */
const SHEET_COLUMN_WIDTHS = [22, 56, 40, 132];

const SHEET_STYLE: React.CSSProperties = {
	flex: "1 1 auto",
	minHeight: 0,
	overflow: "hidden",
	background: "var(--bg)",
	display: "flex",
	flexDirection: "column",
};

/** 数据行与列头带共用同一套格子排版，列头带只多一层底色（真实表格的列头就是抬升面）。 */
const SHEET_ROW_STYLE: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "var(--space-5)",
	height: SHEET_ROW_HEIGHT,
	padding: "0 var(--space-3)",
	borderBottom: "1px solid var(--border)",
};

const SHEET_HEADER_STYLE: React.CSSProperties = {
	...SHEET_ROW_STYLE,
	background: "var(--bg-raised)",
};

export default function XlsxPreview({ url }: { readonly url: string }): React.JSX.Element {
	const hostRef = useRef<HTMLDivElement>(null);
	const workbookRef = useRef<WorkbookHandle>(null);
	const [sheets, setSheets] = useState<SheetData | undefined>(undefined);
	const [renderKey, setRenderKey] = useState(0);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		let disposed = false;
		setSheets(undefined);
		setError(undefined);

		(async () => {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`读取文件失败（HTTP ${response.status}）`);
			let bytes: ArrayBuffer | Uint8Array<ArrayBuffer> = await response.arrayBuffer();
			let name = fileNameOf(url);
			const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
			if (ext === ".csv" || ext === ".xls") {
				const XLSX = await import("xlsx");
				const book =
					ext === ".csv"
						? XLSX.read(new TextDecoder("utf-8").decode(bytes), { type: "string" })
						: XLSX.read(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), {
								type: "array",
							});
				bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as Uint8Array<ArrayBuffer>;
				name = name.replace(/\.(csv|xls)$/i, ".xlsx");
			}
			if (disposed) return;
			const { transformExcelToFortune } = await import("@corbe30/fortune-excel");
			// 库的 setKey 回调用于触发 Workbook 重挂载（列宽/行高在挂载后经 ref 应用）。
			await transformExcelToFortune(
				new File([bytes], name),
				(raw: unknown) => {
					if (!disposed) setSheets(normalizeSheets(raw));
				},
				(updater: (k: number) => number) => {
					if (!disposed) setRenderKey(updater);
				},
				workbookRef,
			);
		})().catch((cause: unknown) => {
			if (!disposed) setError(cause instanceof Error ? cause.message : String(cause));
		});

		return () => {
			disposed = true;
		};
	}, [url]);

	// fortune-sheet 只监听 window resize 重排；面板拖宽时容器变了 window 没动，
	// 观察到容器尺寸变化就补发一次 window resize（rAF 合帧，拖拽不刷爆）。
	useEffect(() => {
		const host = hostRef.current;
		if (host === null || sheets === undefined) return;
		let rafId: number | undefined;
		const observer = new ResizeObserver(() => {
			if (rafId !== undefined) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				rafId = undefined;
				window.dispatchEvent(new Event("resize"));
			});
		});
		observer.observe(host);
		return () => {
			observer.disconnect();
			if (rafId !== undefined) cancelAnimationFrame(rafId);
		};
	}, [sheets]);

	return (
		<div ref={hostRef} className="preview-office-content office-sheet-host">
			{error !== undefined && <ErrorState message={`表格解析失败：${error}`} />}
			{sheets === undefined && error === undefined && (
				<div style={SHEET_STYLE} role="status" aria-label="正在解析表格">
					<div style={SHEET_HEADER_STYLE}>
						{SHEET_COLUMN_WIDTHS.map((width) => (
							<Skeleton key={width} width={width} height={8} />
						))}
					</div>
					{Array.from({ length: SHEET_SKELETON_ROWS }, (_, row) => (
						<div key={row} style={SHEET_ROW_STYLE}>
							{SHEET_COLUMN_WIDTHS.map((width, column) => (
								<Skeleton key={column} width={width} height={8} />
							))}
						</div>
					))}
				</div>
			)}
			{sheets !== undefined && (
				<Workbook
					key={renderKey}
					ref={workbookRef}
					data={sheets}
					lang="zh"
					allowEdit={false}
					showToolbar={false}
					showFormulaBar={false}
				/>
			)}
		</div>
	);
}
