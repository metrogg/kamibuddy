/**
 * 专家市场页（WorkBuddy ExpertCenterPage 同构，spec: rework-expert-center-and-chip）。
 *
 * 结构：顶栏（搜索框 + 我的专家入口）→「专家 | 专家团（占位）」子 tab →
 * tags 聚合的分类 chips 行 → 专家卡片网格 → 点击卡片开详情弹窗。
 * 「我的专家」是页内整页切换的子页（非路由），顶栏变「< 全部专家」。
 *
 * 数据口径：
 * - experts 由 App 启动时经 listExperts 拉取（含用户级 ~/.kamibuddy/experts/ 覆盖，
 *   source 字段区分内置/用户级），本页纯展示不自带拉取。
 * - 分类行没有服务端下发（WorkBuddy 的分类是后端配置），本地等价物就是
 *   全量专家 tags 按首次出现顺序聚合去重。
 * - 不做精选场景/运营排序（spec 明确不做：无使用计数数据）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExpertListItem } from "@shared/ipc.ts";
import { ExpertAvatar } from "./expert-avatar.tsx";
import {
	IconAssistant,
	IconChevronLeft,
	IconClose,
	IconGraduationCap,
	IconPlus,
	IconResearch,
	IconUser,
} from "./icons.tsx";

interface ExpertsViewProps {
	/** 全量专家（内置 + 用户级覆盖，App 层 listExperts 缓存）。 */
	readonly experts: readonly ExpertListItem[];
	/**
	 * 启用专家：选中该专家并进入新任务对话页；prefill 有值时把文本填入
	 * 输入框待发送（详情弹窗里点 quickPrompt 的路径）。
	 */
	readonly onUseExpert: (expertId: string, prefill?: string) => void;
	/** 创建专家：跳回主页并把引导语填入输入框（App 层组合 prefill + 路由）。 */
	readonly onCreateExpert: () => void;
}

/** 搜索防抖（WorkBuddy ExpertSearchBar 同档位）。 */
const SEARCH_DEBOUNCE_MS = 200;

/** 搜索命中的字段集（spec：本地五字段过滤）。 */
function matchKeyword(expert: ExpertListItem, keyword: string): boolean {
	return [expert.name, expert.displayName, expert.profession, expert.description, expert.displayDescription]
		.some((field) => field.toLowerCase().includes(keyword));
}

export function ExpertsView({ experts, onUseExpert, onCreateExpert }: ExpertsViewProps): React.JSX.Element {
	const [searchInput, setSearchInput] = useState("");
	const [keyword, setKeyword] = useState("");
	const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
	const [listTab, setListTab] = useState<"experts" | "teams">("experts");
	const [detail, setDetail] = useState<ExpertListItem | undefined>(undefined);
	const [myExperts, setMyExperts] = useState(false);
	/**
	 * IME composition 守卫（WorkBuddy ExpertSearchBar 同款语义）：拼音候选期间
	 * 不做过滤 —— 候选串不是最终文本，边拼边过滤会让列表随击键乱跳；
	 * compositionEnd 时用最终文本同步一次。
	 */
	const composingRef = useRef(false);
	const debounceRef = useRef<number | undefined>(undefined);

	const scheduleKeyword = useCallback((value: string) => {
		window.clearTimeout(debounceRef.current);
		debounceRef.current = window.setTimeout(() => setKeyword(value), SEARCH_DEBOUNCE_MS);
	}, []);

	// 卸载清掉在途防抖：组件随 tab 切换卸载后不能再 setState。
	useEffect(() => () => window.clearTimeout(debounceRef.current), []);

	/** 分类行数据源：全量专家的 tags 按首次出现顺序聚合去重。 */
	const allTags = useMemo(() => {
		const seen = new Set<string>();
		const ordered: string[] = [];
		for (const expert of experts) {
			for (const tag of expert.tags) {
				if (!seen.has(tag)) {
					seen.add(tag);
					ordered.push(tag);
				}
			}
		}
		return ordered;
	}, [experts]);

	const userExperts = useMemo(() => experts.filter((e) => e.source === "user"), [experts]);

	/**
	 * 过滤链：搜索优先且全局（搜索时分类行隐藏，若仍暗中被选中的 tag 过滤，
	 * 用户看不见这个过滤条件，结果少得莫名其妙），无关键词时才按选中分类过滤。
	 */
	const kw = keyword.trim().toLowerCase();
	const visibleExperts = useMemo(() => {
		if (kw !== "") return experts.filter((e) => matchKeyword(e, kw));
		if (selectedTag === undefined) return experts;
		return experts.filter((e) => e.tags.includes(selectedTag));
	}, [experts, kw, selectedTag]);

	if (myExperts) {
		return (
			<div className="ex">
				<div className="ex-topbar">
					<button type="button" className="ex-back" onClick={() => setMyExperts(false)}>
						<IconChevronLeft size={15} />
						全部专家
					</button>
				</div>
				{userExperts.length === 0 ? (
					<div className="ex-empty">
						<IconGraduationCap size={44} className="ex-empty-icon" />
						<p className="ex-empty-title">还没有创建任何专家</p>
						<p className="ex-empty-sub">创建属于你的专家，分享专业知识</p>
						<button type="button" className="ex-create-btn" onClick={onCreateExpert}>
							创建专家
						</button>
					</div>
				) : (
					<div className="ex-grid">
						{userExperts.map((expert) => (
							<ExpertCard key={expert.name} expert={expert} onOpen={setDetail} onUse={onUseExpert} />
						))}
						<button type="button" className="ex-card ex-create-card" onClick={onCreateExpert}>
							<IconPlus size={20} />
							创建专家
						</button>
					</div>
				)}
				{detail !== undefined && (
					<ExpertDetailModal expert={detail} onClose={() => setDetail(undefined)} onUse={onUseExpert} />
				)}
			</div>
		);
	}

	return (
		<div className="ex">
			<div className="ex-topbar">
				<div className="ex-search">
					<IconResearch size={14} className="ex-search-icon" />
					<input
						type="text"
						className="ex-search-input"
						placeholder="搜索专家职称或描述"
						value={searchInput}
						onChange={(e) => {
							const value = e.currentTarget.value;
							setSearchInput(value);
							if (!composingRef.current) scheduleKeyword(value);
						}}
						onCompositionStart={() => {
							composingRef.current = true;
						}}
						onCompositionEnd={(e) => {
							composingRef.current = false;
							scheduleKeyword(e.currentTarget.value);
						}}
					/>
				</div>
				<button type="button" className="ex-mine" onClick={() => setMyExperts(true)}>
					<IconUser size={14} />
					我的专家
				</button>
			</div>

			<div className="ex-subtabs">
				<button
					type="button"
					className={`ex-subtab${listTab === "experts" ? " active" : ""}`}
					onClick={() => setListTab("experts")}
				>
					专家
				</button>
				<button
					type="button"
					className={`ex-subtab${listTab === "teams" ? " active" : ""}`}
					onClick={() => setListTab("teams")}
				>
					专家团
				</button>
			</div>

			{listTab === "teams" ? (
				<div className="ex-empty">
					<IconAssistant size={40} className="ex-empty-icon" />
					<p className="ex-empty-title">专家团即将上线</p>
				</div>
			) : (
				<>
					{/* 搜索时分类行隐藏（spec）：关键词是全局面过滤，分类行失去意义。 */}
					{kw === "" && (
						<div className="ex-cats">
							<button
								type="button"
								className={`ex-cat${selectedTag === undefined ? " active" : ""}`}
								onClick={() => setSelectedTag(undefined)}
							>
								全部
							</button>
							{allTags.map((tag) => (
								<button
									key={tag}
									type="button"
									className={`ex-cat${selectedTag === tag ? " active" : ""}`}
									onClick={() => setSelectedTag(selectedTag === tag ? undefined : tag)}
								>
									{tag}
								</button>
							))}
						</div>
					)}
					{visibleExperts.length === 0 ? (
						<div className="ex-empty">
							<p className="ex-empty-title">没有找到与「{keyword.trim()}」匹配的专家，试试其他关键词</p>
						</div>
					) : (
						<div className="ex-grid">
							{visibleExperts.map((expert) => (
								<ExpertCard key={expert.name} expert={expert} onOpen={setDetail} onUse={onUseExpert} />
							))}
						</div>
					)}
				</>
			)}

			{detail !== undefined && (
				<ExpertDetailModal expert={detail} onClose={() => setDetail(undefined)} onUse={onUseExpert} />
			)}
		</div>
	);
}

/* ── 专家卡片 ───────────────────────────────────────────────────── */

function ExpertCard({
	expert,
	onOpen,
	onUse,
}: {
	readonly expert: ExpertListItem;
	readonly onOpen: (expert: ExpertListItem) => void;
	readonly onUse: (expertId: string) => void;
}): React.JSX.Element {
	return (
		<div
			className="ex-card"
			role="button"
			tabIndex={0}
			onClick={() => onOpen(expert)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onOpen(expert);
				}
			}}
		>
			<div className="ex-card-head">
				<ExpertAvatar displayName={expert.displayName} className="ex-card-avatar" />
				<div className="ex-card-title">
					<span className="ex-card-name">{expert.displayName}</span>
					<span className="ex-card-profession">{expert.profession}</span>
				</div>
			</div>
			<p className="ex-card-desc">{expert.displayDescription}</p>
			<div className="ex-card-tags">
				{expert.tags.map((tag) => (
					<span key={tag} className="ex-tag">
						{tag}
					</span>
				))}
			</div>
			{/* hover 浮现的「使用」：直接启用不弹详情；stopPropagation 防冒泡开弹窗。 */}
			<button
				type="button"
				className="ex-card-use"
				onClick={(e) => {
					e.stopPropagation();
					onUse(expert.name);
				}}
			>
				使用
			</button>
		</div>
	);
}

/* ── 详情弹窗 ───────────────────────────────────────────────────── */

function ExpertDetailModal({
	expert,
	onClose,
	onUse,
}: {
	readonly expert: ExpertListItem;
	readonly onClose: () => void;
	readonly onUse: (expertId: string, prefill?: string) => void;
}): React.JSX.Element {
	// Esc 关闭：遮罩点击对键盘/读屏用户不可达，弹窗必须有键盘关闭路径。
	useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		// 遮罩点击即关闭（WorkBuddy 同款：轻量弹窗不强制点按钮）。
		<div className="ex-modal-mask" onClick={onClose}>
			{/* 卡片本体拦冒泡：点内容区不关闭。 */}
			<div className="ex-modal" role="dialog" aria-label={`专家详情：${expert.displayName}`} onClick={(e) => e.stopPropagation()}>
				<div className="ex-modal-head">
					<ExpertAvatar displayName={expert.displayName} className="ex-detail-avatar" />
					<div className="ex-modal-title">
						<span className="ex-modal-name">{expert.displayName}</span>
						<span className="ex-modal-profession">{expert.profession}</span>
					</div>
					{/* 可见关闭钮：遮罩点击关闭不可发现，指针用户也需要实体出口。 */}
					<button type="button" className="bar-btn ex-modal-close" aria-label="关闭" onClick={onClose}>
						<IconClose size={16} />
					</button>
				</div>
				<p className="ex-modal-desc">{expert.displayDescription}</p>
				<div className="ex-modal-tags">
					{expert.tags.map((tag) => (
						<span key={tag} className="ex-tag">
							{tag}
						</span>
					))}
				</div>
				<div className="ex-modal-prompts">
					<p className="ex-modal-prompts-title">专家帮你做</p>
					{expert.quickPrompts.map((prompt) => (
						<button
							key={prompt}
							type="button"
							className="ex-modal-prompt"
							onClick={() => onUse(expert.name, prompt)}
						>
							{prompt}
						</button>
					))}
				</div>
				<button type="button" className="ex-modal-use" onClick={() => onUse(expert.name)}>
					使用专家
				</button>
			</div>
		</div>
	);
}
