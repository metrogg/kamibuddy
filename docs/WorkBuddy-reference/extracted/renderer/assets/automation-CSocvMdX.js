import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { $z as TemplateAlarmClockIcon, AB as DeleteIcon, BL as ConversationsContext, BR as DatePicker, DB as TaskFilterIcon, Dg as init_expert, F_ as getCachedBuiltinExperts, Fz as UnarchiveIcon, GB as AutomationEmptyAlarmIcon, GI as init_useTheme, Gd as useSharedWbInputProviders, Gz as TemplateMessagesSquareIcon, HB as BackChevronIcon, HR as import_dayjs_min, Hz as TemplateWeeklyReportIcon, It as init_app_core, JB as ArchiveIcon, JO as useOpenSettings, Jz as TemplateLanguagesIcon, KI as useTheme, Kz as TemplateListTodoIcon, LB as ChevronDownIcon, LL as AdapterContext, LR as Segmented, Ll as init_input_providers, MB as ClockIcon, MR as init_src, NB as CirclePauseIcon, QB as AtmScheduledTaskIcon, Qz as TemplateCalendarIcon, RB as CheckIcon, RL as init_adapter_context, RR as Switch, Rs as init_contexts, Rt as wb, Uz as TemplateNewsIcon, VR as TimePicker, WB as AutomationEmptyRecordsIcon, W_ as useExpertApi, Wz as TemplateMoonIcon, Xz as TemplateHospitalIcon, Yz as TemplateImageIcon, ZB as AtmRunRecordIcon, Zy as automationExpertSummon$, Zz as TemplateFilmIcon, _V as getLocale, _v as isMac, aB as RunningStatusIcon, aV as Button, az as Tooltip, bz as XCloseIcon, cC as init_use_latest_ref, cL as init_useI18n, cc as init_auth_context, cz as Popconfirm, dl as useConversationRenderLocale, dv as SidebarNewTaskButton, fj as init_telemetry, gz as Input, hj as useAgentTelemetry, hz as Tag, iB as SearchIcon, iz as Dropdown, kB as ErrorCircleIcon, lC as useLatestRef, lc as useAccountService, ll as init_use_conversation_render_event_bus, lz as Popover, mv as useDesktopWindowState, mz as Card, nb as init_task_starter_store, nz as Checkbox, oB as RunPlayIcon, pv as init_workbuddy_topbar, pz as Loading, qO as init_SettingsContext, qz as TemplateLightbulbIcon, rb as isAutomationPayloadExpired, sB as ResumeCircleIcon, sz as Modal, tV as AddIcon, tz as Select, uL as useTranslation, uv as SidebarExpandButton, uz as init_floating, wR as init_file_path, yB as MoreDotsIcon, yR as formatAutomationCwdLabel, yV as init_i18n, yz as WarningOutlineIcon, zB as CheckBoldIcon, zL as useAdapter, zR as message } from "./ui-docs-viewer-C2jT2eXi.js";
import { Ou as require_jsx_runtime, bc as useChatInput, bi as MarkdownRenderer, ec as InputBoxRoot, hi as ConfirmDialog, ku as require_react, pn as init_src$2, sc as ConversationRenderConfigProvider, su as createPhraseBlock, t as init_src$1 } from "./lib-chat-ui-ChIVprRk.js";
var init_automation_edit_mode_view = __esmMin((() => {
	require_react();
	require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/automation-history-detail-dialog.less
var init_automation_history_detail_dialog$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/utils/history-detail-utils.ts
function isAutomationRecordRunning(record) {
	return record.status === "running" && !record.finishedAt;
}
function isAutomationRecordQueued(record) {
	return record.status === "queued" && !record.finishedAt;
}
function shouldOpenAutomationHistoryDetailFirst(record) {
	if (isAutomationRecordQueued(record) || isAutomationRecordRunning(record)) return false;
	return record.status !== "success" || record.resultState === "partial_delivered";
}
function getAutomationHistoryStatusLabel(record, t) {
	if (isAutomationRecordQueued(record)) return t("automation.row.queued");
	if (isAutomationRecordRunning(record)) return t("automation.row.inProgress");
	const resultState = record.resultState;
	const runKind = record.runKind ?? record.kind;
	if (runKind === "interrupted") return t("automation.result.interrupted");
	if (resultState === "partial_delivered" && record.status !== "failed") return t("automation.result.partialDelivered");
	if (resultState === "side_effect_only") return t("automation.result.sideEffectOnly");
	if (runKind === "missed") return isRecordDelivered(record) ? t("automation.result.catchUpSucceeded") : t("automation.result.catchUpFailed");
	if (runKind === "manual" || runKind === "manual_test") return isRecordDelivered(record) ? t("automation.result.manualTest") : t("automation.row.failed");
	return isRecordDelivered(record) ? t("automation.row.succeeded") : t("automation.row.failed");
}
function getAutomationHistoryStatusClass(record) {
	if (isAutomationRecordQueued(record)) return "queued";
	if (isAutomationRecordRunning(record)) return "running";
	if ((record.runKind ?? record.kind) === "interrupted") return "failed";
	if (record.resultState === "partial_delivered" && record.status !== "failed") return "neutral";
	if (record.resultState === "side_effect_only" || record.resultState === "delivered") return "success";
	if (record.resultState === "failed") return "failed";
	return record.status === "success" ? "success" : "failed";
}
function getAutomationHistoryReasonKey(record, rawText) {
	if (isAutomationRecordQueued(record)) return "automation.detail.reason.queued";
	if (isAutomationRecordRunning(record)) return "automation.detail.reason.running";
	if (record.resultState === "partial_delivered" && record.status !== "failed") return "automation.detail.reason.partialDelivered";
	if (!shouldOpenAutomationHistoryDetailFirst(record)) return "automation.detail.reason.historyMissing";
	const normalizedRawText = rawText?.trim() || record.error?.trim();
	if (normalizedRawText && AUTH_ERROR_PATTERN.test(normalizedRawText)) return "automation.detail.reason.auth";
	if (normalizedRawText && NETWORK_ERROR_PATTERN.test(normalizedRawText)) return "automation.detail.reason.network";
	if ((record.runKind ?? record.kind) === "interrupted" || /cancelled|canceled|aborted|interrupted|stopped before completion/i.test(normalizedRawText || "")) return "automation.detail.reason.interrupted";
	return "automation.detail.reason.failed";
}
function isRecordDelivered(record) {
	if (record.resultState === "delivered" || record.resultState === "side_effect_only") return true;
	if (record.resultState === "failed" || record.resultState === "partial_delivered") return false;
	return record.success ?? record.status === "success";
}
async function openLinkedAutomationConversation(options) {
	if (!options.conversationId) {
		options.onMissingConversation();
		return false;
	}
	try {
		await options.onOpenConversation(options.conversationId, options.cwd, options.title);
		return true;
	} catch (error) {
		options.onOpenFailed(error);
		return false;
	}
}
var AUTH_ERROR_PATTERN, NETWORK_ERROR_PATTERN;
var init_history_detail_utils = __esmMin((() => {
	AUTH_ERROR_PATTERN = /(auth|authentication|unauthori[sz]ed|login did not recover|login|token|owner changed|owner mismatch|no user id|missing user id|user id required)/i;
	NETWORK_ERROR_PATTERN = /(econnrefused|econnreset|enotfound|eai_again|etimedout|timed out|timeout|502|503|504|network error|proxy:|http_proxy|https_proxy|socket hang up|fetch failed|connection reset)/i;
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/utils/history-error-display.ts
function getAutomationDisplayText(value, maxLength = MAX_AUTOMATION_ERROR_DISPLAY_LENGTH) {
	if (!value) return;
	return value.length > maxLength ? {
		text: `${value.slice(0, maxLength)}…`,
		isTruncated: true
	} : {
		text: value,
		isTruncated: false
	};
}
function getAutomationDisplayError(value) {
	const displayText = getAutomationDisplayText(value);
	return displayText ? {
		...displayText,
		fullText: value || ""
	} : void 0;
}
function getConciseAutomationTechnicalSummary(value) {
	const trimmed = value?.trim();
	if (!trimmed) return;
	const jsonStart = trimmed.indexOf("{");
	if (jsonStart >= 0) {
		const message = extractJsonMessage(trimmed.slice(jsonStart));
		if (message) return truncateSummaryLine(message);
	}
	return truncateSummaryLine(trimmed.replace(/^Automation prompt stopped before completion:\s*/i, "").replace(/^refusal:\s*/i, "").split("\n").map((line) => line.trim()).find(Boolean));
}
function extractJsonMessage(value) {
	try {
		const parsed = JSON.parse(value);
		if (typeof parsed.message === "string") return parsed.message;
		if (typeof parsed.data?.details === "string") return parsed.data.details;
	} catch {
		const match = value.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
		if (match?.[1]) return decodeJsonString(match[1]);
	}
}
function decodeJsonString(value) {
	try {
		return JSON.parse(`"${value}"`);
	} catch {
		return value;
	}
}
function truncateSummaryLine(value) {
	return value && value.length > 160 ? `${value.slice(0, 159)}…` : value;
}
var MAX_AUTOMATION_ERROR_DISPLAY_LENGTH;
var init_history_error_display = __esmMin((() => {
	MAX_AUTOMATION_ERROR_DISPLAY_LENGTH = 4096;
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/mappers/automation-history-detail-mapper.ts
function toAutomationHistoryDetailViewModel(record, options) {
	const title = options.automationName || record.automationId;
	const opensDetailFirst = shouldOpenAutomationHistoryDetailFirst(record);
	const isPending = isPendingRecord(record);
	const isFailure = record.status === "failed";
	const userFacingReason = options.t(getAutomationHistoryReasonKey(record));
	const technicalSummary = isPending || isFailure ? void 0 : record.summary?.trim() || record.error?.trim();
	const displayError = getAutomationDisplayError(record.error);
	const runs = "runs" in record && Array.isArray(record.runs) ? record.runs : [];
	const artifacts = "artifacts" in record && Array.isArray(record.artifacts) ? record.artifacts : runs.flatMap((run) => run.artifacts ?? []);
	return {
		id: record.id,
		automationId: record.automationId,
		title,
		subtitleKey: opensDetailFirst ? "automation.detail.failureHint" : "automation.detail.historyMissingHint",
		statusClass: getAutomationHistoryStatusClass(record),
		statusLabel: getAutomationHistoryStatusLabel(record, options.t),
		timeLabel: formatTime(record.finishedAt),
		primarySummary: opensDetailFirst || isPending ? userFacingReason : technicalSummary,
		technicalSummary: opensDetailFirst && technicalSummary && technicalSummary !== userFacingReason ? getConciseAutomationTechnicalSummary(technicalSummary) : void 0,
		error: displayError,
		evidenceLabelKey: getEvidenceLabelKey(record.resultEvidence),
		runs,
		artifacts,
		conversation: record.sessionId ? {
			conversationId: record.sessionId,
			cwd: record.cwd,
			title
		} : void 0,
		canOpenConversation: Boolean(record.sessionId)
	};
}
function isPendingRecord(record) {
	return (record.status === "running" || record.status === "queued") && !record.finishedAt;
}
function getEvidenceLabelKey(evidence) {
	if (evidence === "assistant_output") return "automation.evidence.assistantOutput";
	if (evidence === "artifact") return "automation.evidence.artifact";
	if (evidence === "local_file_mutation") return "automation.evidence.localFileMutation";
	if (evidence === "external_action") return "automation.evidence.externalAction";
}
function formatTime(value) {
	return value ? new Date(value).toLocaleString() : "-";
}
var init_automation_history_detail_mapper = __esmMin((() => {
	init_history_detail_utils();
	init_history_error_display();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/automation-history-detail-dialog.tsx
/** History detail dialog for a single AutomationRecord, preserving legacy detail modal class contracts. */
function AutomationHistoryDetailDialog({ record, automationName, onClose, onOpenConversation, onMissingConversation, onOpenConversationFailed }) {
	const t = useTranslation();
	const [showFullError, setShowFullError] = (0, import_react$29.useState)(false);
	const viewModel = (0, import_react$29.useMemo)(() => toAutomationHistoryDetailViewModel(record, {
		automationName,
		t
	}), [
		automationName,
		record,
		t
	]);
	const isFailureDetail = viewModel.statusClass === "failed";
	async function handleOpenConversation() {
		if (!onOpenConversation) return;
		await openLinkedAutomationConversation({
			conversationId: viewModel.conversation?.conversationId,
			cwd: viewModel.conversation?.cwd,
			title: viewModel.conversation?.title,
			onOpenConversation,
			onMissingConversation: onMissingConversation || (() => void 0),
			onOpenFailed: onOpenConversationFailed || (() => void 0)
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)(Modal, {
		open: true,
		onOpenChange: (nextOpen) => {
			if (!nextOpen) onClose();
		},
		className: "atm-detail-modal",
		centered: true,
		footer: null,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("div", {
				className: "atm-inbox-detail-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
					className: "atm-detail-title",
					title: viewModel.title,
					children: viewModel.title
				}), /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)(Button, {
					type: "button",
					variant: "ghost",
					size: "medium",
					shape: "circle",
					iconOnly: true,
					leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)(XCloseIcon, {}),
					"aria-label": t("common.close"),
					className: "atm-detail-close",
					onClick: onClose
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
				className: "atm-detail-subtitle-row",
				children: /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("span", {
					className: "atm-detail-subtitle",
					children: t(viewModel.subtitleKey)
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("div", {
				className: "atm-detail-status-row",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("span", {
						className: `atm-detail-status ${viewModel.statusClass}`,
						children: viewModel.statusLabel
					}),
					viewModel.evidenceLabelKey ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("span", {
						className: "atm-detail-evidence",
						children: t(viewModel.evidenceLabelKey)
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("span", {
						className: "atm-detail-time",
						children: viewModel.timeLabel
					})
				]
			}),
			viewModel.primarySummary || viewModel.technicalSummary ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("section", {
				className: "atm-detail-section",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
					className: "atm-detail-section-title",
					children: t("automation.detail.summary")
				}), /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("div", {
					className: "atm-detail-text",
					children: [viewModel.primarySummary ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
						className: "atm-detail-summary-main",
						children: /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)(MarkdownRenderer, {
							complete: true,
							children: viewModel.primarySummary
						})
					}) : null, viewModel.technicalSummary ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("pre", {
						className: "atm-detail-summary-technical",
						children: viewModel.technicalSummary
					}) : null]
				})]
			}) : null,
			viewModel.error && !isFailureDetail ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("section", {
				className: "atm-detail-section",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
						className: "atm-detail-section-title",
						children: t("automation.detail.technicalDetails")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("div", {
						className: "atm-detail-run-error",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("pre", {
							className: "atm-detail-run-block error",
							children: viewModel.error.text
						}), viewModel.error.isTruncated ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)(import_jsx_runtime$21.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
							className: "atm-detail-run-truncated",
							children: t("automation.detail.errorTruncated", { count: MAX_AUTOMATION_ERROR_DISPLAY_LENGTH })
						}), !showFullError ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)(Button, {
							type: "button",
							variant: "secondary",
							size: "small",
							className: "atm-detail-run-expand-btn",
							onClick: () => setShowFullError(true),
							children: t("automation.detail.viewFullError")
						}) : null] }) : null]
					}),
					showFullError ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("div", {
						className: "atm-detail-run-technical",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
							className: "atm-detail-run-technical-title",
							children: t("automation.detail.technicalDetails")
						}), /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("pre", {
							className: "atm-detail-run-block",
							children: viewModel.error.fullText
						})]
					}) : null
				]
			}) : null,
			viewModel.artifacts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("section", {
				className: "atm-detail-section",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
					className: "atm-detail-section-title",
					children: t("automation.detail.artifacts")
				}), /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
					className: "atm-detail-artifacts",
					children: viewModel.artifacts.map((artifact) => /* @__PURE__ */ (0, import_jsx_runtime$21.jsxs)("div", {
						className: "atm-detail-artifact",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
							className: "atm-detail-artifact-name",
							children: artifact.fileName
						}), /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
							className: "atm-detail-artifact-path",
							children: artifact.localPath || artifact.url || artifact.objectKey
						})]
					}, artifact.localPath || artifact.url || artifact.objectKey || artifact.fileName))
				})]
			}) : null,
			viewModel.canOpenConversation && onOpenConversation ? /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)("div", {
				className: "atm-detail-footer",
				children: /* @__PURE__ */ (0, import_jsx_runtime$21.jsx)(Button, {
					type: "button",
					variant: "primary",
					className: "atm-detail-primary-btn",
					onClick: () => {
						handleOpenConversation().catch(() => void 0);
					},
					children: t("automation.detail.retryConversation")
				})
			}) : null
		]
	});
}
var import_react$29, import_jsx_runtime$21;
var init_automation_history_detail_dialog = __esmMin((() => {
	init_automation_history_detail_dialog$1();
	init_src$1();
	init_src();
	import_react$29 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_automation_history_detail_mapper();
	init_history_detail_utils();
	init_history_error_display();
	import_jsx_runtime$21 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/automation-history-status-icon.less
var init_automation_history_status_icon$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/automation-history-status-icon.tsx
function AutomationHistoryStatusIcon({ statusClass }) {
	if (statusClass === "queued") return /* @__PURE__ */ (0, import_jsx_runtime$20.jsx)(ClockIcon, {
		size: 16,
		color: "var(--wb-color-text-disabled)"
	});
	if (statusClass === "running") return /* @__PURE__ */ (0, import_jsx_runtime$20.jsx)(RunningStatusIcon, {
		className: "atm-status-icon-spinning",
		size: 16,
		color: "#00C29A"
	});
	if (statusClass === "success") return /* @__PURE__ */ (0, import_jsx_runtime$20.jsx)(CheckBoldIcon, {
		size: 16,
		color: "var(--wb-color-text-disabled)"
	});
	if (statusClass === "failed") return /* @__PURE__ */ (0, import_jsx_runtime$20.jsx)(ErrorCircleIcon, { size: 16 });
	return /* @__PURE__ */ (0, import_jsx_runtime$20.jsx)(CheckIcon, {
		size: 16,
		color: "var(--atm-result-neutral-text)"
	});
}
var import_jsx_runtime$20;
var init_automation_history_status_icon = __esmMin((() => {
	init_automation_history_status_icon$1();
	init_src();
	require_react();
	import_jsx_runtime$20 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/automation-permission-confirm-dialog.less
var init_automation_permission_confirm_dialog$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/automation-permission-confirm-dialog.tsx
var import_react$27, import_jsx_runtime$19, AutomationPermissionConfirmDialog;
var init_automation_permission_confirm_dialog = __esmMin((() => {
	init_automation_permission_confirm_dialog$1();
	init_src();
	import_react$27 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	import_jsx_runtime$19 = require_jsx_runtime();
	AutomationPermissionConfirmDialog = ({ open, onConfirm, onCancel, onFallbackToDefault }) => {
		const t = useTranslation();
		const [acknowledged, setAcknowledged] = (0, import_react$27.useState)(false);
		const handleAcknowledgeChange = (0, import_react$27.useCallback)((event) => {
			setAcknowledged(event.currentTarget.checked);
		}, []);
		const handleConfirm = (0, import_react$27.useCallback)(() => {
			if (!acknowledged) return;
			onConfirm();
			setAcknowledged(false);
		}, [acknowledged, onConfirm]);
		const handleCancel = (0, import_react$27.useCallback)(() => {
			onCancel();
			setAcknowledged(false);
		}, [onCancel]);
		const handleFallback = (0, import_react$27.useCallback)(() => {
			onFallbackToDefault?.();
			setAcknowledged(false);
		}, [onFallbackToDefault]);
		return /* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)(Modal, {
			open,
			onOpenChange: (nextOpen) => {
				if (!nextOpen) handleCancel();
			},
			className: "automation-permission-confirm__dialog",
			width: 440,
			centered: true,
			closable: false,
			footer: null,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("div", {
					className: "automation-permission-confirm__header",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("span", {
						className: "automation-permission-confirm__icon",
						children: /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(WarningOutlineIcon, { size: "lg" })
					}), /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("h3", {
						className: "automation-permission-confirm__title",
						children: t("automation.permission.confirmTitle")
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("p", {
					className: "automation-permission-confirm__desc",
					children: t("automation.permission.confirmDesc")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("ul", {
					className: "automation-permission-confirm__list",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("li", { children: t("automation.permission.confirmItem1") }),
						/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("li", { children: t("automation.permission.confirmItem2") }),
						/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)("li", { children: t("automation.permission.confirmItem3") })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(Checkbox, {
					className: "automation-permission-confirm__checkbox",
					checked: acknowledged,
					onChange: handleAcknowledgeChange,
					label: t("automation.permission.confirmCheckbox")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("div", {
					className: "automation-permission-confirm__actions",
					children: [onFallbackToDefault ? /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(Button, {
						type: "button",
						variant: "ghost",
						size: "small",
						className: "automation-permission-confirm__fallback-link",
						onClick: handleFallback,
						children: t("automation.permission.confirmFallback")
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime$19.jsxs)("div", {
						className: "automation-permission-confirm__actions-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(Button, {
							type: "button",
							variant: "secondary",
							onClick: handleCancel,
							children: t("common.cancel")
						}), /* @__PURE__ */ (0, import_jsx_runtime$19.jsx)(Button, {
							type: "button",
							variant: "primary",
							danger: true,
							disabled: !acknowledged,
							onClick: handleConfirm,
							children: t("automation.permission.confirmButton")
						})]
					})]
				})
			]
		});
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/automation-permission-picker.less
var init_automation_permission_picker$1 = __esmMin((() => {}));
var init_automation_permission_picker = __esmMin((() => {
	init_automation_permission_picker$1();
	init_src();
	require_react();
	init_useI18n();
	require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/automation-template-grid.tsx
function AutomationTemplateGrid({ sectionTitle, templates, onSelectTemplate, variant = "list", getScheduleSummary, addButtonLabel, AddButtonIcon }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("div", {
		className: `atm-template-section atm-template-section--${variant}`,
		children: [sectionTitle ? /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("div", {
			className: "atm-section-title",
			children: sectionTitle
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("div", {
			className: `atm-template-list atm-template-list--${variant}`,
			children: templates.map((template) => /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(AutomationTemplateGridCard, {
				template,
				variant,
				onSelectTemplate,
				getScheduleSummary,
				addButtonLabel,
				AddButtonIcon
			}, template.id))
		})]
	});
}
function AutomationTemplateGridCard({ template, variant, onSelectTemplate, getScheduleSummary, addButtonLabel, AddButtonIcon }) {
	if (variant === "card") return /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)(Card, {
		hoverable: true,
		padding: "none",
		className: "atm-template-card atm-template-card--card",
		"data-track-id": "automation_add_from_template",
		"data-track-name": "模板添加自动化",
		"data-track-props": JSON.stringify({
			source: template.id,
			type: "template"
		}),
		onClick: () => onSelectTemplate(template),
		children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("div", {
			className: "atm-template-card-main",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("div", {
				className: "atm-template-card-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(Tooltip, {
					content: template.title,
					placement: "top",
					maxWidth: 280,
					children: /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
						className: "atm-template-card-title",
						children: template.title
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("span", {
					className: "atm-template-card-add",
					"aria-hidden": true,
					children: [AddButtonIcon ? /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(AddButtonIcon, { className: "atm-template-card-add-icon" }) : /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
						className: "atm-template-card-add-plus",
						children: "+"
					}), addButtonLabel ? /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", { children: addButtonLabel }) : null]
				})]
			}), getScheduleSummary ? /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("div", {
				className: "atm-template-card-schedule",
				children: getScheduleSummary(template)
			}) : null]
		}), /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(Tooltip, {
			content: template.content,
			placement: "bottom",
			maxWidth: 280,
			children: /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("div", {
				className: "atm-template-card-desc",
				children: template.content
			})
		})]
	});
	if (variant === "compact") return /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)(Card, {
		hoverable: true,
		padding: "none",
		className: "atm-template-card atm-template-card--compact",
		"data-track-id": "automation_add_from_template",
		"data-track-name": "模板添加自动化",
		"data-track-props": JSON.stringify({
			source: template.id,
			type: "template"
		}),
		onClick: () => onSelectTemplate(template),
		children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
			className: "atm-template-compact-avatar",
			children: /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(template.Icon, { className: "atm-template-compact-icon" })
		}), /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("span", {
			className: "atm-template-compact-texts",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
				className: "atm-template-compact-title",
				children: template.title
			}), /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(Tooltip, {
				content: template.content,
				placement: "bottom",
				maxWidth: 280,
				children: /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
					className: "atm-template-compact-desc",
					children: template.content
				})
			})]
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)(Card, {
		hoverable: true,
		padding: "none",
		className: "atm-template-card",
		"data-track-id": "automation_add_from_template",
		"data-track-name": "模板添加自动化",
		"data-track-props": JSON.stringify({
			source: template.id,
			type: "template"
		}),
		onClick: () => onSelectTemplate(template),
		children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
			className: "atm-template-icon-wrap",
			children: /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)(template.Icon, { className: "atm-template-icon" })
		}), /* @__PURE__ */ (0, import_jsx_runtime$17.jsxs)("span", {
			className: "atm-template-texts",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
				className: "atm-template-name",
				children: template.title
			}), /* @__PURE__ */ (0, import_jsx_runtime$17.jsx)("span", {
				className: "atm-template-content",
				children: template.content
			})]
		})]
	});
}
var import_jsx_runtime$17;
var init_automation_template_grid = __esmMin((() => {
	init_src();
	require_react();
	import_jsx_runtime$17 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/connector-selector.less
var init_connector_selector$1 = __esmMin((() => {}));
var init_connector_selector = __esmMin((() => {
	init_connector_selector$1();
	init_src();
	init_floating();
	require_react();
	init_useI18n();
	require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/components/expert-selector.less
var init_expert_selector$1 = __esmMin((() => {}));
var init_expert_selector = __esmMin((() => {
	init_expert_selector$1();
	init_src();
	init_floating();
	require_react();
	init_useI18n();
	require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/workspace.less
var init_workspace$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/hooks/use-automation-actions.ts
function getAutomations$1() {
	return wb.automations;
}
function getActionErrorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
function useAutomationActions(options = {}) {
	const onChanged = options.onChanged;
	const [unscopedBusyCount, setUnscopedBusyCount] = (0, import_react$22.useState)(0);
	const [busyCountsByAutomationId, setBusyCountsByAutomationId] = (0, import_react$22.useState)({});
	const [error, setError] = (0, import_react$22.useState)();
	const updateBusyCount = (0, import_react$22.useCallback)((automationId, delta) => {
		if (!automationId) {
			setUnscopedBusyCount((count) => Math.max(0, count + delta));
			return;
		}
		setBusyCountsByAutomationId((prev) => {
			const nextCount = (prev[automationId] ?? 0) + delta;
			if (nextCount <= 0) {
				const next = { ...prev };
				delete next[automationId];
				return next;
			}
			return {
				...prev,
				[automationId]: nextCount
			};
		});
	}, []);
	const notifyChanged = (0, import_react$22.useCallback)(() => {
		try {
			Promise.resolve(onChanged?.()).catch(() => void 0);
		} catch {}
	}, [onChanged]);
	const clearError = (0, import_react$22.useCallback)(() => setError(void 0), []);
	const run = (0, import_react$22.useCallback)(async (action, automationId) => {
		updateBusyCount(automationId, 1);
		setError(void 0);
		try {
			const value = await action();
			notifyChanged();
			return {
				ok: true,
				value
			};
		} catch (err) {
			const message = getActionErrorMessage(err);
			setError(message);
			return {
				ok: false,
				error: message
			};
		} finally {
			updateBusyCount(automationId, -1);
		}
	}, [notifyChanged, updateBusyCount]);
	const create = (0, import_react$22.useCallback)(async (draft) => {
		const result = await run(() => getAutomations$1().create(draft));
		return result.ok ? result.value.id : void 0;
	}, [run]);
	const update = (0, import_react$22.useCallback)(async (id, patch) => {
		return (await run(() => getAutomations$1().update(id, patch), id)).ok;
	}, [run]);
	const remove = (0, import_react$22.useCallback)(async (id) => {
		return (await run(() => getAutomations$1().delete(id), id)).ok;
	}, [run]);
	const archiveRecord = (0, import_react$22.useCallback)(async (id) => {
		return (await run(() => getAutomations$1().archiveRecord(id))).ok;
	}, [run]);
	const unarchiveRecord = (0, import_react$22.useCallback)(async (id) => {
		return (await run(() => getAutomations$1().unarchiveRecord(id))).ok;
	}, [run]);
	const deleteRecord = (0, import_react$22.useCallback)(async (id) => {
		return (await run(() => getAutomations$1().deleteRecord(id))).ok;
	}, [run]);
	const trigger = (0, import_react$22.useCallback)(async (id) => {
		setError(void 0);
		try {
			await getAutomations$1().trigger(id);
			notifyChanged();
			return { ok: true };
		} catch (err) {
			const message = getActionErrorMessage(err);
			setError(message);
			return {
				ok: false,
				error: message
			};
		}
	}, [notifyChanged]);
	const updateAndTrigger = (0, import_react$22.useCallback)(async (id, patch) => {
		const result = await run(() => getAutomations$1().update(id, patch), id);
		if (!result.ok) return {
			ok: false,
			error: result.error
		};
		return trigger(id);
	}, [run, trigger]);
	const busyAutomationIds = (0, import_react$22.useMemo)(() => new Set(Object.keys(busyCountsByAutomationId)), [busyCountsByAutomationId]);
	const unscopedBusy = unscopedBusyCount > 0;
	const busy = unscopedBusy || busyAutomationIds.size > 0;
	return (0, import_react$22.useMemo)(() => ({
		busy,
		unscopedBusy,
		busyAutomationIds,
		error,
		clearError,
		create,
		update,
		deleteAutomation: remove,
		archiveRecord,
		unarchiveRecord,
		deleteRecord,
		trigger,
		updateAndTrigger
	}), [
		archiveRecord,
		busy,
		busyAutomationIds,
		clearError,
		create,
		deleteRecord,
		error,
		remove,
		trigger,
		unarchiveRecord,
		unscopedBusy,
		update,
		updateAndTrigger
	]);
}
var import_react$22;
var init_use_automation_actions = __esmMin((() => {
	import_react$22 = /* @__PURE__ */ __toESM(require_react());
	init_app_core();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/mappers/automation-form-mapper.ts
function automationToFormState(automation) {
	return {
		name: automation.name,
		prompt: automation.prompt,
		status: automation.status ?? "ACTIVE",
		schedule: automation.schedule,
		execution: normalizeExecution(automation.execution)
	};
}
function formStateToAutomationDraft(form) {
	return {
		name: form.name,
		prompt: form.prompt,
		status: form.status,
		schedule: form.schedule,
		execution: form.execution
	};
}
function formStateToAutomationPatch(form) {
	return formStateToAutomationDraft(form);
}
function normalizeExecution(execution) {
	if (!execution) return;
	return {
		...execution,
		permissionMode: execution.permissionMode ?? "fullAccess"
	};
}
var init_automation_form_mapper = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/mappers/automation-template-mapper.ts
function templateToAutomationDraft(template) {
	return {
		...template.spec,
		execution: template.spec.execution ? { ...template.spec.execution } : void 0,
		schedule: { ...template.spec.schedule }
	};
}
function templateToCardViewModel(template) {
	return {
		id: template.id,
		title: template.spec.name,
		descriptionKey: template.descriptionKey,
		icon: template.icon,
		draft: templateToAutomationDraft(template)
	};
}
function templatesToCardViewModels(templates) {
	return templates.map(templateToCardViewModel);
}
var init_automation_template_mapper = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/hooks/use-automation-draft.ts
function useAutomationDraft() {
	const [mode, setMode] = (0, import_react$21.useState)("create");
	const [editingId, setEditingId] = (0, import_react$21.useState)();
	const [form, setForm] = (0, import_react$21.useState)();
	const startCreate = (0, import_react$21.useCallback)((seed) => {
		setMode("create");
		setEditingId(void 0);
		setForm(seed ? draftToFormState(seed) : void 0);
	}, []);
	const startEdit = (0, import_react$21.useCallback)((automation) => {
		setMode("edit");
		setEditingId(automation.id);
		setForm(automationToFormState(automation));
	}, []);
	const startFromTemplate = (0, import_react$21.useCallback)((template) => {
		startCreate(templateToAutomationDraft(template));
	}, [startCreate]);
	const clear = (0, import_react$21.useCallback)(() => {
		setMode("create");
		setEditingId(void 0);
		setForm(void 0);
	}, []);
	const toDraft = (0, import_react$21.useCallback)(() => form ? formStateToAutomationDraft(form) : void 0, [form]);
	return (0, import_react$21.useMemo)(() => ({
		mode,
		editingId,
		form,
		setForm,
		startCreate,
		startEdit,
		startFromTemplate,
		clear,
		toDraft
	}), [
		clear,
		editingId,
		form,
		mode,
		startCreate,
		startEdit,
		startFromTemplate,
		toDraft
	]);
}
function draftToFormState(draft) {
	return {
		name: draft.name,
		prompt: draft.prompt,
		status: draft.status ?? "ACTIVE",
		schedule: draft.schedule,
		execution: draft.execution
	};
}
var import_react$21;
var init_use_automation_draft = __esmMin((() => {
	import_react$21 = /* @__PURE__ */ __toESM(require_react());
	init_automation_form_mapper();
	init_automation_template_mapper();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/mappers/automation-view-model.ts
function createAutomationPageViewModel(automations = [], records = []) {
	const recordsByAutomationId = records.reduce((grouped, record) => {
		(grouped[record.automationId] ??= []).push(record);
		return grouped;
	}, {});
	const items = automations.map((automation) => toAutomationListItemViewModel(automation, recordsByAutomationId[automation.id]?.[0]));
	return {
		items,
		activeItems: items.filter((item) => item.status === "ACTIVE"),
		pausedItems: items.filter((item) => item.status === "PAUSED"),
		recordsByAutomationId,
		isEmpty: items.length === 0
	};
}
function toAutomationListItemViewModel(automation, latestRecord) {
	return {
		id: automation.id,
		name: automation.name,
		prompt: automation.prompt,
		status: automation.status ?? "ACTIVE",
		dataSource: automation.dataSource,
		schedule: automation.schedule,
		cwd: automation.execution?.cwd,
		nextRunAt: automation.nextRunAt,
		updatedAt: automation.updatedAt,
		latestRecord
	};
}
var init_automation_view_model = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/hooks/use-automation-page.ts
/** 前端筛选值 → core 状态下推值；`all` 表示不下推（返回 undefined）。 */
function toStatusFilter(filter) {
	return filter === "all" ? void 0 : filter;
}
function getAutomations() {
	return wb.automations;
}
/**
* 运行态相关字段是否变化。用于把「最新一页」markerRecords 的最新状态就地合并进分页列表 records：
* 仅当这些影响展示的字段（状态 / 结束时间 / 结果）变化时才替换该行，避免无谓渲染（#93043 回归修复）。
*/
function hasRunStateChanged(prev, next) {
	return prev.status !== next.status || prev.finishedAt !== next.finishedAt || prev.success !== next.success || prev.summary !== next.summary || prev.error !== next.error || prev.resultState !== next.resultState || prev.resultEvidence !== next.resultEvidence || prev.runKind !== next.runKind;
}
function describeRecordForLog(record) {
	return `${record.automationId}:${record.id}:${record.status}:started=${record.startedAt ?? "N/A"}:finished=${record.finishedAt ?? "N/A"}`;
}
function writeAutomationPageLog(message, payload) {
	if (payload === void 0) {
		wb.telemetry?.logger?.warn?.(message);
		return;
	}
	let serialized = "";
	try {
		serialized = JSON.stringify(payload);
	} catch {
		serialized = String(payload);
	}
	wb.telemetry?.logger?.warn?.(`${message} ${serialized}`);
}
function useAutomationPage(recordFilter = "all") {
	const [automations, setAutomations] = (0, import_react$20.useState)([]);
	const [markerRecords, setMarkerRecords] = (0, import_react$20.useState)([]);
	const [records, setRecords] = (0, import_react$20.useState)([]);
	const [loading, setLoading] = (0, import_react$20.useState)(false);
	const [recordsLoading, setRecordsLoading] = (0, import_react$20.useState)(true);
	const [recordsLoadingMore, setRecordsLoadingMore] = (0, import_react$20.useState)(false);
	const [recordsHasMore, setRecordsHasMore] = (0, import_react$20.useState)(false);
	const [error, setError] = (0, import_react$20.useState)();
	const [keyword, setKeyword] = (0, import_react$20.useState)("");
	const [status, setStatus] = (0, import_react$20.useState)();
	const statusFilter = toStatusFilter(recordFilter);
	const recordsRequestSeq = (0, import_react$20.useRef)(0);
	const loadedCountRef = (0, import_react$20.useRef)(0);
	const recordsTotalRef = (0, import_react$20.useRef)(0);
	const loadingMoreRef = (0, import_react$20.useRef)(false);
	const refreshAutomations = (0, import_react$20.useCallback)(async (options) => {
		const silent = options?.silent === true;
		if (!silent) {
			setLoading(true);
			setError(void 0);
		}
		try {
			setAutomations(await getAutomations().list({
				keyword: keyword || void 0,
				status
			}));
			setError(void 0);
		} catch (err) {
			if (!silent) setError(err instanceof Error ? err.message : String(err));
		} finally {
			if (!silent) setLoading(false);
		}
	}, [keyword, status]);
	const refreshMarkerRecords = (0, import_react$20.useCallback)(async () => {
		try {
			const page = await getAutomations().listRecords({
				offset: 0,
				limit: RECORDS_PAGE_LIMIT,
				withTotal: false
			});
			writeAutomationPageLog("[AutomationPage] markerRecords refreshed", {
				count: page.items.length,
				top: page.items.slice(0, 5).map(describeRecordForLog)
			});
			setMarkerRecords(page.items);
		} catch (error) {
			writeAutomationPageLog("[AutomationPage] markerRecords refresh failed", error);
		}
	}, []);
	const loadRecordsFirstPage = (0, import_react$20.useCallback)(async (options) => {
		const seq = ++recordsRequestSeq.current;
		const silent = options?.silent === true;
		if (!silent) setRecordsLoading(true);
		try {
			const page = await getAutomations().listRecords({
				offset: 0,
				limit: RECORDS_PAGE_LIMIT,
				status: statusFilter,
				keyword: keyword || void 0,
				withTotal: true
			});
			if (seq !== recordsRequestSeq.current) return;
			loadedCountRef.current = page.items.length;
			recordsTotalRef.current = page.total;
			setRecords(page.items);
			setRecordsHasMore(page.items.length > 0 && page.items.length < page.total);
		} catch {
			if (seq === recordsRequestSeq.current && options?.preserveOnError !== true) {
				setRecords([]);
				setRecordsHasMore(false);
				loadedCountRef.current = 0;
				recordsTotalRef.current = 0;
			}
		} finally {
			if (seq === recordsRequestSeq.current && !silent) setRecordsLoading(false);
		}
	}, [statusFilter, keyword]);
	const loadMoreRecords = (0, import_react$20.useCallback)(() => {
		if (loadingMoreRef.current) return;
		const offset = loadedCountRef.current;
		if (offset <= 0 || offset >= recordsTotalRef.current) return;
		loadingMoreRef.current = true;
		const seq = recordsRequestSeq.current;
		setRecordsLoadingMore(true);
		(async () => {
			try {
				const page = await getAutomations().listRecords({
					offset,
					limit: RECORDS_PAGE_LIMIT,
					status: statusFilter,
					keyword: keyword || void 0,
					withTotal: false
				});
				if (seq !== recordsRequestSeq.current) return;
				if (page.items.length === 0) {
					setRecordsHasMore(false);
					return;
				}
				loadedCountRef.current = offset + page.items.length;
				setRecords((prev) => [...prev, ...page.items]);
				setRecordsHasMore(loadedCountRef.current < recordsTotalRef.current);
			} catch {} finally {
				loadingMoreRef.current = false;
				if (seq === recordsRequestSeq.current) setRecordsLoadingMore(false);
			}
		})().catch(() => void 0);
	}, [statusFilter, keyword]);
	const refresh = (0, import_react$20.useCallback)(async (options) => {
		refreshMarkerRecords().catch(() => void 0);
		loadRecordsFirstPage().catch(() => void 0);
		await refreshAutomations(options);
	}, [
		refreshAutomations,
		refreshMarkerRecords,
		loadRecordsFirstPage
	]);
	(0, import_react$20.useEffect)(() => {
		refresh().catch(() => void 0);
	}, [refresh]);
	(0, import_react$20.useEffect)(() => {
		let timer;
		let disposed = false;
		const scheduleRefresh = () => {
			if (timer) return;
			timer = setTimeout(() => {
				timer = void 0;
				if (!disposed) {
					refreshMarkerRecords().catch(() => void 0);
					loadRecordsFirstPage({
						silent: true,
						preserveOnError: true
					}).catch(() => void 0);
					refreshAutomations({ silent: true }).catch(() => void 0);
				}
			}, RECORDS_CHANGED_REFRESH_THROTTLE_MS);
		};
		const unsubscribe = wb.on(AUTOMATION_RECORDS_CHANGED_EVENT$1, (event) => {
			writeAutomationPageLog("[AutomationPage] records.changed received", event);
			scheduleRefresh();
		});
		return () => {
			disposed = true;
			if (timer) clearTimeout(timer);
			unsubscribe();
		};
	}, [
		loadRecordsFirstPage,
		refreshAutomations,
		refreshMarkerRecords
	]);
	(0, import_react$20.useEffect)(() => {
		if (markerRecords.length === 0) return;
		const latestById = new Map(markerRecords.map((record) => [record.id, record]));
		setRecords((prev) => {
			let changed = false;
			const next = prev.map((record) => {
				const latest = latestById.get(record.id);
				if (latest && hasRunStateChanged(record, latest)) {
					changed = true;
					return latest;
				}
				return record;
			});
			return changed ? next : prev;
		});
	}, [markerRecords]);
	const viewModel = (0, import_react$20.useMemo)(() => createAutomationPageViewModel(automations, markerRecords), [automations, markerRecords]);
	const getAutomation = (0, import_react$20.useCallback)((id) => getAutomations().get(id), []);
	const getRecordDetail = (0, import_react$20.useCallback)((recordId) => {
		return getAutomations().getRecordDetail?.(recordId) ?? Promise.resolve(void 0);
	}, []);
	const listTemplates = (0, import_react$20.useCallback)(() => getAutomations().templates(), []);
	return (0, import_react$20.useMemo)(() => ({
		viewModel,
		records,
		loading,
		recordsLoading,
		recordsLoadingMore,
		recordsHasMore,
		loadMoreRecords,
		error,
		keyword,
		status,
		setKeyword,
		setStatus,
		refresh,
		getAutomation,
		getRecordDetail,
		listTemplates
	}), [
		error,
		getAutomation,
		getRecordDetail,
		keyword,
		listTemplates,
		loading,
		loadMoreRecords,
		records,
		recordsHasMore,
		recordsLoading,
		recordsLoadingMore,
		refresh,
		status,
		viewModel
	]);
}
var import_react$20, AUTOMATION_RECORDS_CHANGED_EVENT$1, RECORDS_PAGE_LIMIT, RECORDS_CHANGED_REFRESH_THROTTLE_MS;
var init_use_automation_page = __esmMin((() => {
	import_react$20 = /* @__PURE__ */ __toESM(require_react());
	init_app_core();
	init_automation_view_model();
	AUTOMATION_RECORDS_CHANGED_EVENT$1 = "automations.records.changed";
	RECORDS_PAGE_LIMIT = 100;
	RECORDS_CHANGED_REFRESH_THROTTLE_MS = 1e3;
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/hooks/use-automation-permission-confirm.ts
function useAutomationPermissionConfirm({ currentMode, initialMode, onConfirmedSubmit, onFallbackToDefault }) {
	const [showConfirmDialog, setShowConfirmDialog] = (0, import_react$19.useState)(false);
	const pendingActionRef = (0, import_react$19.useRef)();
	const needsConfirmation = currentMode === "fullAccess" && (!initialMode || initialMode === "default");
	const requestAction = (0, import_react$19.useCallback)((action) => {
		if (needsConfirmation) {
			pendingActionRef.current = action;
			setShowConfirmDialog(true);
			return;
		}
		action().catch(() => void 0);
	}, [needsConfirmation]);
	return {
		showConfirmDialog,
		requestSubmit: (0, import_react$19.useCallback)(() => {
			requestAction(onConfirmedSubmit);
		}, [onConfirmedSubmit, requestAction]),
		requestAction,
		handleConfirm: (0, import_react$19.useCallback)(() => {
			setShowConfirmDialog(false);
			const action = pendingActionRef.current;
			pendingActionRef.current = void 0;
			if (action) action().catch(() => void 0);
		}, []),
		handleCancel: (0, import_react$19.useCallback)(() => {
			setShowConfirmDialog(false);
			pendingActionRef.current = void 0;
		}, []),
		handleFallbackToDefault: (0, import_react$19.useCallback)(() => {
			setShowConfirmDialog(false);
			pendingActionRef.current = void 0;
			onFallbackToDefault?.();
		}, [onFallbackToDefault])
	};
}
var import_react$19;
var init_use_automation_permission_confirm = __esmMin((() => {
	import_react$19 = /* @__PURE__ */ __toESM(require_react());
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/utils/schedule-validation.ts
/** 判断给定的 ISO 时间字符串是否晚于 nowMs（用于新版表单直接持有 scheduledAt 的场景）。 */
function isFutureScheduledAt(scheduledAt, nowMs = Date.now()) {
	if (!scheduledAt) return false;
	const scheduledAtMs = Date.parse(scheduledAt);
	return Number.isFinite(scheduledAtMs) && scheduledAtMs > nowMs;
}
function getDefaultOnceScheduledAtIso(now = /* @__PURE__ */ new Date()) {
	const next = new Date(now);
	next.setMinutes(next.getMinutes() + 5, 0, 0);
	return next.toISOString();
}
/** 返回严格晚于 now 的下一整分钟，并保留本地日期，正确处理 23:59 跨日。 */
function getNextLocalMinuteInput(now = /* @__PURE__ */ new Date()) {
	const next = new Date(now);
	next.setMinutes(next.getMinutes() + 1, 0, 0);
	return {
		date: formatLocalDateInput(next),
		time: formatLocalTimeInput(next)
	};
}
/** 根据所选日期生成 TimePicker 的最小时间禁用规则。 */
function getTimePickerMinimumOptions(selectedDate, minimum) {
	if (selectedDate < minimum.date) return { disabledHours: () => numbersBelow(24) };
	if (selectedDate > minimum.date) return {};
	const [minimumHour = 0, minimumMinute = 0] = minimum.time.split(":").map(Number);
	return {
		disabledHours: () => numbersBelow(minimumHour),
		disabledMinutes: (hour) => hour === minimumHour ? numbersBelow(minimumMinute) : []
	};
}
function numbersBelow(max) {
	return Array.from({ length: Math.max(0, max) }, (_, index) => index);
}
function formatLocalDateInput(date) {
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0")
	].join("-");
}
function formatLocalTimeInput(date) {
	return [String(date.getHours()).padStart(2, "0"), String(date.getMinutes()).padStart(2, "0")].join(":");
}
function shouldValidateFutureOneTimeSchedule(_options) {
	return true;
}
var init_schedule_validation = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-editor-form.less
var init_automation_editor_form$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/wecom-bot-source/wecom-bot-source.less
var init_wecom_bot_source = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/wecom-bot-source/use-wecom-bot-channels.ts
/**
* Read the assistant connection mode from a saved channel config, mirroring
* `normalizeChannelConfig` + `inferConnectionMode` in ClawSettingsPanel:
* - explicit `connectionMode` wins;
* - otherwise a config carrying params is a legacy webhook user;
* - a config with no params is treated as websocket.
* The raw `webhook` mode is mapped to `'url'` for the source-picker contract.
*/
function readAssistantConnectionMode(config) {
	if (!config) return;
	const extra = config.extra ?? config;
	let rawMode = extra?.connectionMode;
	if (!rawMode) rawMode = Object.keys(extra).some((key) => key !== "connectionMode" && extra[key] !== void 0 && extra[key] !== "") ? "webhook" : "websocket";
	return rawMode === "webhook" ? "url" : rawMode;
}
/**
* useWecomBotChannels tracks assistant / standalone WeCom bot channel state via
* the adapter `claw:*` event protocol while `enabled` is true.
*/
function useWecomBotChannels(adapter, enabled) {
	const [state, setState] = (0, import_react$18.useState)(INITIAL_STATE);
	(0, import_react$18.useEffect)(() => {
		if (!adapter || !enabled) {
			setState(INITIAL_STATE);
			return;
		}
		const applyAssistantStatus = (statusMap) => {
			if (!statusMap) return;
			const status = statusMap[ASSISTANT_CHANNEL_TYPE];
			if (status === void 0) return;
			const connected = status === "connected" || status === "registered";
			setState((prev) => ({
				...prev,
				loading: false,
				assistant: {
					...prev.assistant,
					connected
				}
			}));
		};
		const unsubStatusResult = adapter.on("claw:channel-status-result", (data) => {
			const { statusMap } = data ?? {};
			applyAssistantStatus(statusMap);
		});
		const unsubStatusChange = adapter.on("claw:channel-status-change", (data) => {
			const { statusMap } = data ?? {};
			applyAssistantStatus(statusMap);
		});
		const unsubSavedConfigs = adapter.on("claw:saved-channel-configs-result", (data) => {
			const { configs } = data ?? {};
			const assistantConfig = configs?.[ASSISTANT_CHANNEL_TYPE];
			const connectionMode = readAssistantConnectionMode(assistantConfig);
			setState((prev) => ({
				...prev,
				loading: false,
				assistant: {
					...prev.assistant,
					connectionMode
				}
			}));
		});
		const unsubConfigSaved = adapter.on("claw:channel-config-saved", () => {
			adapter.emit("claw:get-saved-channel-configs");
		});
		const unsubPushConfig = adapter.on("claw:automation-wecom-push-config-result", (data) => {
			const config = data;
			if (config?.success === false) {
				setState((prev) => ({
					...prev,
					loading: false
				}));
				return;
			}
			const connected = Boolean(config?.botId);
			setState((prev) => ({
				...prev,
				loading: false,
				standalone: { connected }
			}));
		});
		adapter.emit("claw:get-channel-status");
		adapter.emit("claw:get-saved-channel-configs");
		adapter.emit("claw:get-automation-wecom-push-config");
		return () => {
			unsubStatusResult?.();
			unsubStatusChange?.();
			unsubSavedConfigs?.();
			unsubConfigSaved?.();
			unsubPushConfig?.();
		};
	}, [adapter, enabled]);
	return state;
}
var import_react$18, ASSISTANT_CHANNEL_TYPE, INITIAL_STATE;
var init_use_wecom_bot_channels = __esmMin((() => {
	import_react$18 = /* @__PURE__ */ __toESM(require_react());
	ASSISTANT_CHANNEL_TYPE = "wecomaibot";
	INITIAL_STATE = {
		loading: true,
		assistant: {
			connected: false,
			connectionMode: void 0
		},
		standalone: { connected: false }
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/wecom-bot-source/wecom-bot-source-guide-dialog.tsx
/**
* Guide dialog for picking which WeCom bot delivers this automation's notification.
* Clicking a card selects that source (caller routes connected → enable, otherwise → bind).
*/
function WecomBotSourceGuideDialog({ open, onOpenChange, channels, onChoose }) {
	const t = useTranslation();
	const loading = channels.loading;
	const assistantConnected = channels.assistant.connected;
	const assistantOnUrl = assistantConnected && channels.assistant.connectionMode === "url";
	const standaloneConnected = channels.standalone.connected;
	return /* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)(Modal, {
		open,
		onOpenChange,
		variant: "confirm",
		title: t("automation.modal.wecomBotSource.guideTitle"),
		description: t("automation.modal.wecomBotSource.guideSubtitle"),
		footer: null,
		children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("div", {
			className: "atm-wbs-choice-list",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("button", {
				type: "button",
				className: "atm-wbs-choice-card",
				disabled: loading,
				onClick: () => onChoose("assistant"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("div", {
					className: "atm-wbs-choice-head",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("span", {
						className: "atm-wbs-choice-title",
						children: assistantConnected ? t("automation.modal.wecomBotSource.assistantTitle") : t("automation.modal.wecomBotSource.assistantBindTitle")
					}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("span", {
						className: "atm-wbs-choice-tags",
						children: [loading ? /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Tag, { children: t("automation.modal.wecomBotSource.badgeChecking") }) : assistantConnected ? /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Tag, {
							tone: "success",
							children: t("automation.modal.wecomBotSource.badgeConnected")
						}) : /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Tag, {
							tone: "info",
							children: t("automation.modal.wecomBotSource.badgeGoBind")
						}), !loading && assistantOnUrl && /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Tooltip, {
							content: t("automation.modal.wecomBotSource.urlTagTooltip"),
							placement: "top",
							maxWidth: 360,
							children: /* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("span", {
								className: "atm-wbs-url-tag",
								children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("span", {
									className: "atm-wbs-url-tag-icon",
									"aria-hidden": "true",
									children: "!"
								}), t("automation.modal.wecomBotSource.urlTag")]
							})
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("div", {
					className: "atm-wbs-choice-desc",
					children: assistantConnected ? t("automation.modal.wecomBotSource.assistantDesc") : t("automation.modal.wecomBotSource.assistantBindDesc")
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("button", {
				type: "button",
				className: "atm-wbs-choice-card",
				disabled: loading,
				onClick: () => onChoose("standalone"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("div", {
					className: "atm-wbs-choice-head",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("span", {
						className: "atm-wbs-choice-title",
						children: standaloneConnected ? t("automation.modal.wecomBotSource.standaloneTitle") : t("automation.modal.wecomBotSource.standaloneBindTitle")
					}), loading ? /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Tag, { children: t("automation.modal.wecomBotSource.badgeChecking") }) : standaloneConnected ? /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Tag, {
						tone: "success",
						children: t("automation.modal.wecomBotSource.badgeConnected")
					}) : /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Tag, {
						tone: "info",
						children: t("automation.modal.wecomBotSource.badgeGoBind")
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("div", {
					className: "atm-wbs-choice-desc",
					children: standaloneConnected ? t("automation.modal.wecomBotSource.standaloneDesc") : t("automation.modal.wecomBotSource.standaloneBindDesc")
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("div", {
			className: "atm-wbs-choice-footer",
			children: /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(Button, {
				variant: "secondary",
				onClick: () => onOpenChange(false),
				children: t("automation.modal.wecomBotSource.guideDismiss")
			})
		})]
	});
}
var import_jsx_runtime$14;
var init_wecom_bot_source_guide_dialog = __esmMin((() => {
	init_src();
	require_react();
	init_useI18n();
	import_jsx_runtime$14 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/wecom-bot-source/wecom-bot-source-logic.ts
/**
* Decide what to do when the user picks a source from the guide dialog or the
* source pill.
*
* Contract:
* 1. `channels.loading` → `ignore` (no premature decisions).
* 2. `source === 'assistant'` + assistant on URL callback → `advise-websocket`,
*    even if `connected` is true. URL callback cannot push proactively, so
*    enabling it would silently fail at delivery time (#review).
* 3. Otherwise, if the picked source is connected → `enable`.
* 4. Otherwise (not connected):
*    - assistant → `advise-websocket` (guide user through WS bind)
*    - standalone → `bind-standalone` (deep-link to settings)
*/
function resolveWecomBotChoiceAction(source, channels) {
	if (channels.loading) return { kind: "ignore" };
	const assistantOnUrl = channels.assistant.connectionMode === "url";
	if (source === "assistant" && assistantOnUrl) return { kind: "advise-websocket" };
	if (source === "assistant" ? channels.assistant.connected : channels.standalone.connected) return {
		kind: "enable",
		source
	};
	return source === "assistant" ? { kind: "advise-websocket" } : { kind: "bind-standalone" };
}
/**
* Decide whether an auto-enable (after the user came back from settings) is
* ready to fire for a `pendingSource`.
*
* assistant 必须 **明确是 WebSocket 模式**（connected && connectionMode==='websocket'）才自动开启：
* - `'url'`：URL 回调无法主动推送，不能自动开（改由「我知道了」后提示告知）。
* - `undefined`：连接模式尚未解析（saved-channel-configs 结果还没回来）。此时即便
*   channel-status 已回 connected，也**不能**急着 auto-enable——否则会在 mode 未知时把
*   URL 回调误判为可推送、错误打开开关（issue #80568 竞态）。等 config 回来 mode 确定后再判。
* standalone 无 URL 概念，connected 即就绪。
*/
function isPendingSourceReadyForAutoEnable(pendingSource, channels) {
	if (pendingSource === "assistant") return channels.assistant.connected && channels.assistant.connectionMode === "websocket";
	return channels.standalone.connected;
}
var init_wecom_bot_source_logic = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/wecom-bot-source/wecom-bot-source-pill.tsx
function isSourceConnected(source, channels) {
	return source === "assistant" ? channels.assistant.connected : channels.standalone.connected;
}
/**
* Collapsed pill + dropdown showing the current WeCom bot source, its connection
* status, URL-callback risk hint, and a stale/rebind affordance when disconnected.
*/
function WecomBotSourcePill({ source, channels, disabled, onSwitch, onRebind }) {
	const t = useTranslation();
	const [open, setOpen] = (0, import_react$16.useState)(false);
	const assistantOnUrl = channels.assistant.connected && channels.assistant.connectionMode === "url";
	const currentStale = !channels.loading && !isSourceConnected(source, channels);
	const pillUrlRisk = source === "assistant" && assistantOnUrl;
	const assistantLabel = t("automation.modal.wecomBotSource.assistantTitle");
	const standaloneLabel = t("automation.modal.wecomBotSource.standalonePillLabel");
	const currentLabel = source === "assistant" ? assistantLabel : standaloneLabel;
	const handleSwitch = (next) => {
		setOpen(false);
		if (next === source && !currentStale) return;
		onSwitch(next);
	};
	const renderMenuItem = (itemSource, label, connected, showUrlWarn) => /* @__PURE__ */ (0, import_jsx_runtime$13.jsxs)("button", {
		type: "button",
		className: `atm-wbs-menu-item${itemSource === source ? " atm-wbs-menu-item--active" : ""}`,
		role: "option",
		"aria-selected": itemSource === source,
		onClick: () => handleSwitch(itemSource),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", {
				className: "atm-wbs-menu-check",
				children: itemSource === source ? "✓" : ""
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$13.jsxs)("span", {
				className: "atm-wbs-menu-title",
				children: [label, showUrlWarn && /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)(Tooltip, {
					content: t("automation.modal.wecomBotSource.urlTagTooltip"),
					placement: "top",
					maxWidth: 360,
					children: /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", {
						className: "atm-wbs-url-warn atm-wbs-url-warn--danger",
						children: "!"
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", {
				className: `atm-wbs-menu-status atm-wbs-menu-status--${connected ? "connected" : "disconnected"}`,
				children: connected ? t("automation.modal.wecomBotSource.badgeConnected") : t("automation.modal.wecomBotSource.badgeGoBind")
			})
		]
	});
	const menu = /* @__PURE__ */ (0, import_jsx_runtime$13.jsxs)("div", {
		className: "atm-wbs-menu",
		role: "listbox",
		children: [renderMenuItem("assistant", assistantLabel, channels.assistant.connected, assistantOnUrl), renderMenuItem("standalone", standaloneLabel, channels.standalone.connected, false)]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$13.jsxs)("span", {
		className: "atm-wbs-source-line",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)(Popover, {
			open,
			onOpenChange: setOpen,
			placement: "bottom-start",
			trigger: /* @__PURE__ */ (0, import_jsx_runtime$13.jsxs)("button", {
				type: "button",
				className: "atm-wbs-pill",
				"aria-haspopup": "listbox",
				"aria-expanded": open,
				disabled,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", { className: `atm-wbs-pill-dot${currentStale || pillUrlRisk ? " atm-wbs-pill-dot--stale" : ""}` }),
					/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", {
						className: "atm-wbs-pill-label",
						children: currentLabel
					}),
					source === "assistant" && assistantOnUrl && /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)(Tooltip, {
						content: t("automation.modal.wecomBotSource.urlTagTooltip"),
						placement: "top",
						maxWidth: 360,
						children: /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", {
							className: "atm-wbs-url-warn atm-wbs-url-warn--danger",
							children: "!"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", {
						className: "atm-wbs-pill-caret",
						children: /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)(ChevronDownIcon, { size: 14 })
					})
				]
			}),
			children: menu
		}), currentStale && /* @__PURE__ */ (0, import_jsx_runtime$13.jsxs)("span", {
			className: "atm-wbs-pill-hint",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", { children: t("automation.modal.wecomBotSource.pillStaleHint") }),
				/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("span", {
					className: "atm-wbs-hint-sep",
					children: "·"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("button", {
					type: "button",
					className: "atm-wbs-rebind-link",
					onClick: (event) => {
						event.stopPropagation();
						onRebind();
					},
					children: t("automation.modal.wecomBotSource.pillRebind")
				})
			]
		})]
	});
}
var import_react$16, import_jsx_runtime$13;
var init_wecom_bot_source_pill = __esmMin((() => {
	init_src();
	import_react$16 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	import_jsx_runtime$13 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/wecom-bot-source/wecom-websocket-suggestion-dialog.tsx
/**
* Advisory dialog shown before binding the assistant's WeCom channel:
* recommends WebSocket long connection over URL callback for reliable delivery.
*
* 样式对齐设置页「确认解绑」弹窗（复用 cb-chat-ui 的 ConfirmDialog：无右上角关闭、
* 紧凑标准形态）。两种形态由 `boundViaUrl` 区分：
* - 已绑定 URL 回调：精简提示（无 detailContent）。
* - 尚未绑定：detailContent 展示 WebSocket / URL 回调对比说明。
*/
function WecomWebsocketSuggestionDialog({ open, onOpenChange, boundViaUrl = false, onGoBind }) {
	const t = useTranslation();
	const detailContent = boundViaUrl ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime$12.jsxs)("div", {
		className: "atm-wbs-advice-box",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$12.jsxs)("div", {
			className: "atm-wbs-advice-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$12.jsx)("span", {
				className: "atm-wbs-advice-tick",
				children: "✓"
			}), /* @__PURE__ */ (0, import_jsx_runtime$12.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime$12.jsx)("div", {
				className: "atm-wbs-advice-title",
				children: t("automation.modal.wecomBotSource.wsAdviceRecommendTitle")
			}), /* @__PURE__ */ (0, import_jsx_runtime$12.jsx)("div", {
				className: "atm-wbs-advice-desc",
				children: t("automation.modal.wecomBotSource.wsAdviceRecommendDesc")
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime$12.jsxs)("div", {
			className: "atm-wbs-advice-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$12.jsx)("span", {
				className: "atm-wbs-advice-cross",
				children: "!"
			}), /* @__PURE__ */ (0, import_jsx_runtime$12.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime$12.jsx)("div", {
				className: "atm-wbs-advice-title",
				children: t("automation.modal.wecomBotSource.wsAdviceAvoidTitle")
			}), /* @__PURE__ */ (0, import_jsx_runtime$12.jsx)("div", {
				className: "atm-wbs-advice-desc",
				children: t("automation.modal.wecomBotSource.wsAdviceAvoidDesc")
			})] })]
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$12.jsx)(ConfirmDialog, {
		visible: open,
		title: t("automation.modal.wecomBotSource.wsAdviceTitle"),
		content: boundViaUrl ? t("automation.modal.wecomBotSource.wsAdviceSubtitleBound") : t("automation.modal.wecomBotSource.wsAdviceSubtitle"),
		detailContent,
		confirmText: t("automation.modal.wecomBotSource.wsAdviceGoBind"),
		cancelText: t("automation.modal.wecomBotSource.wsAdviceCancel"),
		onConfirm: onGoBind,
		onClose: () => onOpenChange(false)
	});
}
var import_jsx_runtime$12;
var init_wecom_websocket_suggestion_dialog = __esmMin((() => {
	init_src$1();
	require_react();
	init_useI18n();
	import_jsx_runtime$12 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/wecom-bot-source/wecom-bot-delivery-row.tsx
/**
* "推送到企业微信 bot" toggle row with source selection.
*
* Turning on opens the guide dialog (assistant vs standalone). Once enabled, a
* source pill lets the user switch channels and shows connection status. When a
* chosen channel is not yet bound, the user is routed to settings (or the
* WebSocket suggestion dialog for the assistant channel) and the toggle is
* auto-enabled once the channel becomes connected.
*/
function WecomBotDeliveryRow({ adapter, pushToWecomBot, wecomBotSource, saving, onChange }) {
	const t = useTranslation();
	const { openSettings: openAssistantSettings } = useOpenSettings();
	const [guideOpen, setGuideOpen] = (0, import_react$14.useState)(false);
	const [wsAdviceOpen, setWsAdviceOpen] = (0, import_react$14.useState)(false);
	const [pendingSource, setPendingSource] = (0, import_react$14.useState)(null);
	const channels = useWecomBotChannels(adapter, pushToWecomBot || guideOpen || wsAdviceOpen || pendingSource !== null);
	const latestRef = (0, import_react$14.useRef)({
		onChange,
		t
	});
	latestRef.current = {
		onChange,
		t
	};
	(0, import_react$14.useEffect)(() => {
		if (!pendingSource) return;
		if (!isPendingSourceReadyForAutoEnable(pendingSource, channels)) return;
		const source = pendingSource;
		setPendingSource(null);
		latestRef.current.onChange({
			pushToWecomBot: true,
			wecomBotSource: source
		});
		message.success(source === "assistant" ? latestRef.current.t("automation.modal.wecomBotSource.toastEnabledAssistant") : latestRef.current.t("automation.modal.wecomBotSource.toastEnabledStandalone"));
	}, [channels, pendingSource]);
	const goBindStandalone = (0, import_react$14.useCallback)(() => {
		setPendingSource("standalone");
		openAssistantSettings("claw", "automation-push");
	}, [openAssistantSettings]);
	const goBindAssistant = (0, import_react$14.useCallback)(() => {
		setPendingSource("assistant");
		setWsAdviceOpen(false);
		setGuideOpen(false);
		openAssistantSettings("claw", "wecomaibot");
	}, [openAssistantSettings]);
	const handleToggle = (0, import_react$14.useCallback)((event) => {
		if (!event.currentTarget.checked) {
			setPendingSource(null);
			onChange({
				pushToWecomBot: false,
				wecomBotSource: void 0
			});
			message.info(t("automation.modal.wecomBotSource.toastDisabled"));
			return;
		}
		setGuideOpen(true);
	}, [onChange, t]);
	const handleChoose = (0, import_react$14.useCallback)((source) => {
		const action = resolveWecomBotChoiceAction(source, channels);
		switch (action.kind) {
			case "ignore": return;
			case "enable":
				setGuideOpen(false);
				onChange({
					pushToWecomBot: true,
					wecomBotSource: action.source
				});
				message.success(action.source === "assistant" ? t("automation.modal.wecomBotSource.toastEnabledAssistant") : t("automation.modal.wecomBotSource.toastEnabledStandalone"));
				return;
			case "advise-websocket":
				setWsAdviceOpen(true);
				return;
			case "bind-standalone":
				setGuideOpen(false);
				goBindStandalone();
				return;
			default: return action;
		}
	}, [
		channels,
		onChange,
		t,
		goBindStandalone
	]);
	const handleSwitch = (0, import_react$14.useCallback)((source) => {
		const action = resolveWecomBotChoiceAction(source, channels);
		switch (action.kind) {
			case "ignore": return;
			case "enable":
				onChange({
					pushToWecomBot: true,
					wecomBotSource: action.source
				});
				message.success(action.source === "assistant" ? t("automation.modal.wecomBotSource.toastSwitchedAssistant") : t("automation.modal.wecomBotSource.toastSwitchedStandalone"));
				return;
			case "advise-websocket":
				setWsAdviceOpen(true);
				return;
			case "bind-standalone":
				goBindStandalone();
				return;
			default: return action;
		}
	}, [
		channels,
		onChange,
		t,
		goBindStandalone
	]);
	const effectiveSource = wecomBotSource ?? "standalone";
	const handleRebind = (0, import_react$14.useCallback)(() => {
		if (effectiveSource === "assistant") setWsAdviceOpen(true);
		else goBindStandalone();
	}, [effectiveSource, goBindStandalone]);
	const showPill = pushToWecomBot;
	return /* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("div", {
		className: "atm-schedule-push-toggle atm-schedule-push-toggle--wecom",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("div", {
				className: "atm-push-toggle-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("div", {
					className: "atm-push-toggle-head",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("div", {
						className: "atm-push-toggle-left",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("span", {
							className: "atm-toggle-text",
							children: t("automation.modal.pushToWecomBot")
						}), /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(Tooltip, {
							content: t("automation.modal.pushToWecomBotHint"),
							placement: "top",
							textAlign: "left",
							maxWidth: 320,
							children: /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("span", {
								className: "atm-push-info-icon",
								children: /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("svg", {
									width: "14",
									height: "14",
									viewBox: "0 0 16 16",
									fill: "currentColor",
									xmlns: "http://www.w3.org/2000/svg",
									children: /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("path", {
										transform: "translate(0.667, 0.667)",
										d: INFO_ICON_PATH$1
									})
								})
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(Switch, {
						className: "atm-push-switch",
						checked: pushToWecomBot,
						onChange: handleToggle,
						disabled: saving
					})]
				}), showPill && /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(WecomBotSourcePill, {
					source: effectiveSource,
					channels,
					disabled: saving,
					onSwitch: handleSwitch,
					onRebind: handleRebind
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(WecomBotSourceGuideDialog, {
				open: guideOpen,
				onOpenChange: setGuideOpen,
				channels,
				onChoose: handleChoose
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(WecomWebsocketSuggestionDialog, {
				open: wsAdviceOpen,
				onOpenChange: setWsAdviceOpen,
				boundViaUrl: channels.assistant.connected && channels.assistant.connectionMode === "url",
				onGoBind: goBindAssistant
			})
		]
	});
}
var import_react$14, import_jsx_runtime$11, INFO_ICON_PATH$1;
var init_wecom_bot_delivery_row = __esmMin((() => {
	init_wecom_bot_source();
	init_src();
	import_react$14 = /* @__PURE__ */ __toESM(require_react());
	init_SettingsContext();
	init_useI18n();
	init_use_wecom_bot_channels();
	init_wecom_bot_source_guide_dialog();
	init_wecom_bot_source_logic();
	init_wecom_bot_source_pill();
	init_wecom_websocket_suggestion_dialog();
	import_jsx_runtime$11 = require_jsx_runtime();
	INFO_ICON_PATH$1 = "M7.3333 13.3333C10.647 13.3333 13.3333 10.647 13.3333 7.3333C13.3333 4.0196 10.647 1.3333 7.3333 1.3333C4.0196 1.3333 1.3333 4.0196 1.3333 7.3333C1.3333 10.647 4.0196 13.3333 7.3333 13.3333ZM14.6667 7.3333C14.6667 11.3834 11.3834 14.6667 7.3333 14.6667C3.2832 14.6667 0 11.3834 0 7.3333C0 3.2832 3.2832 0 7.3333 0C11.3834 0 14.6667 3.2832 14.6667 7.3333ZM6.6667 11L6.6667 6L8 6L8 11L6.6667 11ZM8 5L6.6641 5L6.6641 3.6641L8 3.6641L8 5Z";
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-delivery-options.tsx
function AutomationDeliveryOptions({ variant, execution, saving, onChange }) {
	const t = useTranslation();
	const adapter = useAdapter();
	return /* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("div", {
		className: `atm-delivery-options atm-delivery-options--${variant === "modal" ? "inline" : "stacked"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("label", {
			className: "atm-schedule-push-toggle",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$10.jsxs)("span", {
				className: "atm-push-toggle-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("span", {
					className: "atm-toggle-text",
					children: t("automation.modal.pushToBot")
				}), /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)(Tooltip, {
					content: t("automation.modal.pushToBotHint"),
					placement: "top",
					textAlign: "left",
					maxWidth: 320,
					children: /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("span", {
						className: "atm-push-info-icon",
						children: /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("svg", {
							width: "14",
							height: "14",
							viewBox: "0 0 16 16",
							fill: "currentColor",
							xmlns: "http://www.w3.org/2000/svg",
							children: /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)("path", {
								transform: "translate(0.667, 0.667)",
								d: INFO_ICON_PATH
							})
						})
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)(Switch, {
				className: "atm-push-switch",
				checked: !!execution?.pushToWeChat,
				disabled: saving,
				onChange: (event) => onChange({ pushToWeChat: event.currentTarget.checked })
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)(WecomBotDeliveryRow, {
			adapter,
			pushToWecomBot: !!execution?.pushToWecomBot,
			wecomBotSource: execution?.wecomBotSource,
			saving,
			onChange: (next) => onChange({
				pushToWecomBot: next.pushToWecomBot,
				wecomBotSource: next.wecomBotSource
			})
		})]
	});
}
var import_jsx_runtime$10, INFO_ICON_PATH;
var init_automation_delivery_options = __esmMin((() => {
	init_src();
	require_react();
	init_adapter_context();
	init_useI18n();
	init_wecom_bot_delivery_row();
	import_jsx_runtime$10 = require_jsx_runtime();
	INFO_ICON_PATH = "M7.3333 13.3333C10.647 13.3333 13.3333 10.647 13.3333 7.3333C13.3333 4.0196 10.647 1.3333 7.3333 1.3333C4.0196 1.3333 1.3333 4.0196 1.3333 7.3333C1.3333 10.647 4.0196 13.3333 7.3333 13.3333ZM14.6667 7.3333C14.6667 11.3834 11.3834 14.6667 7.3333 14.6667C3.2832 14.6667 0 11.3834 0 7.3333C0 3.2832 3.2832 0 7.3333 0C11.3834 0 14.6667 3.2832 14.6667 7.3333ZM6.6667 11L6.6667 6L8 6L8 11L6.6667 11ZM8 5L6.6641 5L6.6641 3.6641L8 3.6641L8 5Z";
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/utils/prompt-blocks.ts
function buildPromptBlocks(prompt, skills) {
	const blocks = [];
	const seen = /* @__PURE__ */ new Set();
	for (const rawSkill of skills || []) {
		const skillName = `${rawSkill || ""}`.trim();
		if (!skillName || seen.has(skillName)) continue;
		seen.add(skillName);
		blocks.push(createSkillBlock(skillName));
	}
	if (prompt) blocks.push({
		type: "text",
		text: prompt
	});
	return blocks;
}
function extractPromptFromBlocks(blocks) {
	return (blocks || []).map((block) => {
		if (block.type === "text") return typeof block.text === "string" ? block.text : "";
		return extractLongText(block);
	}).join("");
}
function extractLongText(block) {
	if (block.type !== "resource_link") return "";
	if (!block.uri?.startsWith("longtext://")) return "";
	return typeof block._meta?.fullText === "string" ? block._meta.fullText : "";
}
function extractSkillsFromBlocks(blocks) {
	const result = [];
	const seen = /* @__PURE__ */ new Set();
	for (const block of blocks || []) {
		if (block.type !== "resource_link") continue;
		const skillName = readSkillNameFromBlock(block);
		if (!skillName || seen.has(skillName)) continue;
		seen.add(skillName);
		result.push(skillName);
	}
	return result;
}
/**
* 从技能块解析技能名，兼容两种来源，缺一不可：
*
* 1. 回填 / seed 格式（{@link buildPromptBlocks} → {@link createSkillBlock}）：
*    `uri = skill://<name>`。
* 2. 技能选择器实际插入格式：conversation-render 把技能当作 slash 命令处理，
*    插入的块是 `uri = command://<name>`，并以 `_meta.type / mentionType === 'skill'`
*    标记为技能，技能名优先取 `_meta.commandName`（即所选技能项的 name）。
*
* 若只认 `skill://`（历史实现），用户从「+」菜单实际选中的技能（command:// 块）
* 会被整块漏掉，导致保存时 `execution.skills` 为空、重新打开编辑页技能块 chip
* 丢失（Issue #94193）。
*/
function readSkillNameFromBlock(block) {
	if (block.type !== "resource_link") return "";
	const uri = typeof block.uri === "string" ? block.uri : "";
	if (uri.startsWith("skill://")) return decodeURIComponent(uri.slice(8)).trim();
	const meta = block._meta;
	if (!(meta?.type === "skill" || meta?.mentionType === "skill")) return "";
	if (typeof meta?.commandName === "string" && meta.commandName.trim()) return meta.commandName.trim();
	if (uri.startsWith("command://")) return decodeURIComponent(uri.slice(10)).trim();
	return "";
}
function createSkillBlock(skillName) {
	return createPhraseBlock(skillName, `skill://${skillName}`, {
		title: `Use skill ${skillName}.`,
		meta: {
			type: "skill",
			mentionType: "skill",
			displayText: skillName
		},
		icon: "skill"
	});
}
var init_prompt_blocks = __esmMin((() => {
	init_src$1();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/use-automation-input-providers.ts
/**
* 自动化编辑器输入框的 provider 装配。
*
* 与首页 `useHomeInputProviders` 同构：复用共享 `useSharedWbInputProviders`
* 装配 model / skill / expert / connector / workspace，并把权限入口作为内置
* provider 注入。自动化因此与会话共享同一套模型选择器（思考强度档位、自定义模型
* 入口、动态分组、能力 badge 等），不再维护自建的浅层模型映射（Issue #88473）。
*
* 无会话场景：`conversationId` 不传，`persistNewTaskModel=false` 避免污染主对话
* 新任务模型偏好。
*
* 数据源固定走**本地**（transport 缺省，即 `wb.models` / `adapter.getModels`），
* 不能用 `transport='cloud'`：自动化任务在**本地进程**执行，通过共享的本地
* Conversations service → `LocalConfigManager.setModel` → `session/set_model` 下发给
* 本地 CLI worker，执行侧认的是本地 CLI 的模型集合（企业模型 + 本地自定义模型的全集）。
* 用本地源产出的 `modelId` 与执行侧同源、必然匹配；若改走 `wb.cloud.*`（纯云端企业
* 集合），不仅 model 可能与本地 CLI 集合有细微差异导致 `setModel` 抛错任务不运行，
* 还会把 skill / connector / expert 一并错误切到云端数据源（Issue #88473）。
*
* 模型选中态（id + 思考开关 + 思考强度档位）不走 provider 的 `onModelChange`
* （该回调只回传 `{id, name}`），而由宿主组件订阅 store 的 `onSelectionsChange`
* 读取完整 `model` selection 后回写，保证思考强度能持久化到定时任务配置。
*/
function useAutomationInputProviders(options) {
	const { store, cwd, selectedModelId, selectedExpertId, selectedConnectorIds, permissionMode, canSelectSkills, skillStorageScope, onExpertChange, onConnectorSelectionChange, onWorkspaceChange, onPermissionModeChange, onSummonMoreExperts } = options;
	const sharedProviders = useSharedWbInputProviders({
		store,
		hasHistory: false,
		enabledProviders: (0, import_react$12.useMemo)(() => {
			const keys = [
				"model",
				"expert",
				"connector",
				"workspace"
			];
			if (canSelectSkills) keys.push("skill");
			return keys;
		}, [canSelectSkills]),
		cwd,
		selectedModelId,
		persistNewTaskModel: false,
		selectedExpertId,
		includeTeamExperts: true,
		selectedConnectorIds,
		connectorSelectionOnlyToggle: true,
		skillInput: (0, import_react$12.useMemo)(() => skillStorageScope ? { storageScope: skillStorageScope } : void 0, [skillStorageScope]),
		onExpertChange,
		onConnectorSelectionChange,
		onWorkspaceChange,
		onSummonMoreExperts
	});
	const modelProvider = sharedProviders.model;
	const selectedModel = (0, import_react$12.useMemo)(() => {
		if (modelProvider?.selectedModel) return modelProvider.selectedModel;
		if (selectedModelId) return;
		const fallback = modelProvider?.options?.[0];
		return fallback ? {
			id: fallback.id,
			isThinking: false
		} : void 0;
	}, [modelProvider, selectedModelId]);
	(0, import_react$12.useLayoutEffect)(() => {
		if (!selectedModel) return;
		const current = store.getSnapshot().draft.selections.model;
		if (current?.id !== selectedModel.id || current.isThinking !== selectedModel.isThinking || current.reasoningEffort !== selectedModel.reasoningEffort) store.setSelection("model", selectedModel);
	}, [selectedModel, store]);
	const selectedExpert = sharedProviders.expert?.selectedExpert;
	return {
		inputProviders: (0, import_react$12.useMemo)(() => ({
			...sharedProviders,
			permission: { onModeChange: onPermissionModeChange }
		}), [sharedProviders, onPermissionModeChange]),
		selections: (0, import_react$12.useMemo)(() => ({
			...cwd ? { cwd } : {},
			permissionMode,
			...selectedModel ? { model: selectedModel } : {},
			...selectedExpert ? { expert: selectedExpert } : {}
		}), [
			cwd,
			permissionMode,
			selectedExpert,
			selectedModel
		]),
		selectedModel
	};
}
var import_react$12;
var init_use_automation_input_providers = __esmMin((() => {
	import_react$12 = /* @__PURE__ */ __toESM(require_react());
	init_input_providers();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-prompt-input.tsx
function toInputPermissionMode(mode) {
	return mode === "default" ? "default-sandbox" : "full-access";
}
function fromInputPermissionMode(mode) {
	return mode === "default-sandbox" ? "default" : "fullAccess";
}
/**
* 自动化编辑器的提示词输入框。
*
* 复用会话/首页同款的 `InputBoxRoot` + 共享 provider 层（`useAutomationInputProviders`），
* 取代原先基于 cb-chat-ui `ChatInput` 的自建装配，使自动化与会话共享同一套
* 模型选择器、专家、连接器、工作区与权限能力，避免两端各自迭代（Issue #88473）。
*
* 语义：编辑即保存——输入框内容不「发送」，而是实时回写到自动化表单。
* 因此不传 `onSend`（发送按钮保持禁用并由样式隐藏），改为订阅 store 的内容变更。
*
* 换行行为：该页面没有发送按钮，产品预期 Enter 直接换行（区别于会话输入框的
* Enter 发送 / Shift+Enter 换行）。故传 `enterInsertsNewline`，让底层编辑器把
* Enter 归为换行；会话/首页等复用同款 `InputBoxRoot` 的场景不受影响（Issue #95393）。
*/
function AutomationPromptInput({ prompt, skills, execution, canSelectSkills, saving = false, placeholder, skillStorageScope, onSummonExpert, onPromptChange, onExecutionChange }) {
	const renderLocale = useConversationRenderLocale();
	const { theme } = useTheme();
	const { store } = useChatInput({
		sessionId: "__automation__",
		name: "automation-editor-input"
	});
	const onPromptChangeRef = useLatestRef(onPromptChange);
	const onExecutionChangeRef = useLatestRef(onExecutionChange);
	const lastSyncedRef = (0, import_react$11.useRef)();
	(0, import_react$11.useEffect)(() => {
		const skillsKey = skills.join("\0");
		if (lastSyncedRef.current?.prompt === prompt && lastSyncedRef.current?.skills === skillsKey) return;
		lastSyncedRef.current = {
			prompt,
			skills: skillsKey
		};
		store.api.setBlocks(buildPromptBlocks(prompt, skills));
	}, [
		prompt,
		skills,
		store
	]);
	(0, import_react$11.useEffect)(() => {
		const disposable = store.events.on("draft-changed", (event) => {
			if (event.type !== "draft-changed" || !event.changed.content) return;
			const blocks = event.draft.content.blocks;
			const nextPrompt = extractPromptFromBlocks(blocks);
			const nextSkills = extractSkillsFromBlocks(blocks);
			lastSyncedRef.current = {
				prompt: nextPrompt,
				skills: nextSkills.join("\0")
			};
			onPromptChangeRef.current(nextPrompt, nextSkills);
		});
		return () => disposable.dispose();
	}, [store, onPromptChangeRef]);
	const selectedConnectorIds = (0, import_react$11.useMemo)(() => new Set(execution.connectorIds ?? []), [execution.connectorIds]);
	const handleExpertChange = (0, import_react$11.useCallback)((selection) => {
		onExecutionChangeRef.current({ expertId: selection?.marketExpertId || selection?.id });
	}, [onExecutionChangeRef]);
	const handleConnectorSelectionChange = (0, import_react$11.useCallback)((items) => {
		onExecutionChangeRef.current({ connectorIds: items.filter((item) => item.enabled).map((item) => item.id) });
	}, [onExecutionChangeRef]);
	const handleWorkspaceChange = (0, import_react$11.useCallback)((cwd) => {
		onExecutionChangeRef.current({ cwd: cwd || void 0 });
	}, [onExecutionChangeRef]);
	const handlePermissionModeChange = (0, import_react$11.useCallback)((mode) => {
		onExecutionChangeRef.current({ permissionMode: fromInputPermissionMode(mode) });
	}, [onExecutionChangeRef]);
	const { inputProviders, selections } = useAutomationInputProviders({
		store,
		cwd: execution.cwd,
		selectedModelId: execution.modelId,
		selectedExpertId: execution.expertId,
		selectedConnectorIds,
		permissionMode: toInputPermissionMode(execution.permissionMode),
		canSelectSkills,
		skillStorageScope,
		onExpertChange: handleExpertChange,
		onConnectorSelectionChange: handleConnectorSelectionChange,
		onWorkspaceChange: handleWorkspaceChange,
		onPermissionModeChange: handlePermissionModeChange,
		onSummonMoreExperts: onSummonExpert
	});
	const lastModelKeyRef = (0, import_react$11.useRef)();
	const handleSelectionsChange = (0, import_react$11.useCallback)((next) => {
		const model = next.model;
		const key = model ? `${model.id}|${model.isThinking ?? false}|${model.reasoningEffort ?? ""}` : "";
		if (key === lastModelKeyRef.current) return;
		lastModelKeyRef.current = key;
		if (!model) return;
		onExecutionChangeRef.current({
			modelId: model.id,
			modelThinking: model.isThinking ?? false,
			reasoningEffort: model.isThinking ? model.reasoningEffort : void 0
		});
	}, [onExecutionChangeRef]);
	return /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(ConversationRenderConfigProvider, {
		locale: renderLocale,
		children: /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(InputBoxRoot, {
			store,
			disabled: saving,
			placeholder,
			theme: theme === "dark" ? "dark" : "light",
			providers: inputProviders,
			selections,
			onSelectionsChange: handleSelectionsChange,
			enterInsertsNewline: true,
			className: "automation-editor-input"
		})
	});
}
var import_react$11, import_jsx_runtime$9;
var init_automation_prompt_input = __esmMin((() => {
	init_src$2();
	import_react$11 = /* @__PURE__ */ __toESM(require_react());
	init_use_conversation_render_event_bus();
	init_use_latest_ref();
	init_useTheme();
	init_prompt_blocks();
	init_use_automation_input_providers();
	import_jsx_runtime$9 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-schedule-controls.less
var init_automation_schedule_controls$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-schedule-controls.tsx
function ScheduleControls({ mode, preset, scheduleTime, intervalHours, scheduleMonth, scheduleMonthDay, schedule, saving, onModeChange, onPresetChange, onTimeChange, onPeriodicWeekdaysChange, onIntervalChange, onIntervalWeekdaysChange, onMonthChange, onMonthDayChange, onOnceChange, onValidityChange }) {
	const t = useTranslation();
	const [frequencyOpen, setFrequencyOpen] = (0, import_react$10.useState)(false);
	const [validityOpen, setValidityOpen] = (0, import_react$10.useState)(false);
	const selectedWeekdays = getScheduleWeekdays(schedule);
	const periodicItems = (0, import_react$10.useMemo)(() => [
		{
			value: "once",
			label: t("automation.schedule.onceTab")
		},
		{
			value: "day",
			label: t("automation.schedule.periodicDay")
		},
		{
			value: "week",
			label: t("automation.schedule.periodicWeek")
		},
		{
			value: "biweek",
			label: t("automation.schedule.periodicBiweek")
		},
		{
			value: "month",
			label: t("automation.schedule.periodicMonth")
		},
		{
			value: "year",
			label: t("automation.schedule.periodicYear")
		}
	], [t]);
	const weekdayOptions = (0, import_react$10.useMemo)(() => WEEKDAYS.map((day) => ({
		value: day,
		label: t(`automation.day.${day}`)
	})), [t]);
	const monthOptions = (0, import_react$10.useMemo)(() => MONTHS.map((month) => ({
		value: String(month),
		label: `${month}${t("automation.schedule.monthUnit")}`
	})), [t]);
	const monthDayOptions = (0, import_react$10.useMemo)(() => MONTH_DAYS.map((day) => ({
		value: String(day),
		label: `${day}${t("automation.schedule.dayUnit")}`
	})), [t]);
	const frequencySummary = getFrequencySummary(t, mode, preset, scheduleTime, intervalHours, selectedWeekdays, schedule, scheduleMonth, scheduleMonthDay);
	const validitySummary = getValiditySummary(t, schedule);
	const frequencyType = mode === "interval" ? "interval" : "periodic";
	const frequencySelectValue = mode === "once" ? "once" : preset;
	const now = /* @__PURE__ */ new Date();
	const todayLocalDate = formatLocalDate(now);
	const onceMinimum = getNextLocalMinuteInput(now);
	const onceDate = toDateInputValue(schedule.scheduledAt) || todayLocalDate;
	const onceTime = getOnceTime(schedule.scheduledAt, scheduleTime);
	const validityUntilMinDate = getLaterLocalDate(toDateInputValue(schedule.validFrom), todayLocalDate);
	function handleOnceTimeChange(nextTime) {
		if (nextTime && !isFutureLocalDateTime(onceDate, nextTime)) return;
		onOnceChange(mergeOnceDateTime(schedule.scheduledAt, nextTime));
	}
	function handleOnceDateChange(nextDate) {
		if (!nextDate) return;
		onOnceChange(mergeOnceDateTime(nextDate, nextDate === onceMinimum.date && !isFutureLocalDateTime(nextDate, onceTime) ? onceMinimum.time : onceTime));
	}
	function handleValidFromChange(nextDate) {
		if (isDateBefore(nextDate, todayLocalDate)) return;
		onValidityChange(fromDateInputValue(nextDate), schedule.validUntil);
	}
	function handleValidUntilChange(nextDate) {
		if (isDateBefore(nextDate, validityUntilMinDate)) return;
		onValidityChange(schedule.validFrom, fromDateInputValue(nextDate));
	}
	/** 一次性任务的“不早于下一整分钟”约束，同时覆盖 23:59 跨日。 */
	function getOnceDisabledTime() {
		return getTimePickerMinimumOptions(onceDate, onceMinimum);
	}
	function handleFrequencyTypeChange(nextType) {
		if (nextType === "interval") {
			onModeChange("interval");
			return;
		}
		onModeChange("once");
	}
	function handleFrequencySelectChange(value) {
		if (value === "once") {
			onModeChange("once");
			return;
		}
		onPresetChange(value);
	}
	function handleFrequencyOpenChange(nextOpen) {
		setFrequencyOpen(nextOpen);
		if (nextOpen) setValidityOpen(false);
	}
	function handleValidityOpenChange(nextOpen) {
		setValidityOpen(nextOpen);
		if (nextOpen) setFrequencyOpen(false);
	}
	(0, import_react$10.useEffect)(() => {
		if (!frequencyOpen && !validityOpen) return;
		const handlePointerDown = (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			if (target.closest(".atm-schedule-field, .atm-frequency-popover, .atm-validity-popover, .wb-select-popover, .wb-datepicker-popover, .wb-timepicker-popover")) return;
			setFrequencyOpen(false);
			setValidityOpen(false);
		};
		document.addEventListener("pointerdown", handlePointerDown, true);
		return () => document.removeEventListener("pointerdown", handlePointerDown, true);
	}, [frequencyOpen, validityOpen]);
	return /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("div", {
		className: "atm-schedule-section",
		children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
			className: "atm-schedule-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("div", {
				className: "atm-schedule-field atm-schedule-field--frequency",
				children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Popover, {
					open: frequencyOpen,
					onOpenChange: handleFrequencyOpenChange,
					placement: "top-start",
					portalRoot: "inline",
					offsetDistance: 6,
					stopClickPropagation: true,
					className: "atm-frequency-popover",
					trigger: /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)(Button, {
						type: "button",
						variant: "ghost",
						className: "atm-schedule-trigger",
						disabled: saving,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("span", {
								className: "atm-schedule-trigger-label",
								children: [t("automation.modal.schedule"), t("common.colon")]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", {
								className: "atm-schedule-trigger-text",
								children: frequencySummary
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(ChevronDownIcon, {
								className: "atm-custom-select-trigger-arrow",
								size: "sm"
							})
						]
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
						className: "atm-frequency-panel",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Segmented, {
							className: "atm-frequency-mode-tabs",
							value: frequencyType,
							onChange: handleFrequencyTypeChange,
							options: [{
								value: "periodic",
								label: t("automation.schedule.periodic")
							}, {
								value: "interval",
								label: t("automation.schedule.intervalShort")
							}]
						}), mode === "interval" ? /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
							className: "atm-frequency-panel-row atm-frequency-panel-row--interval",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", {
									className: "atm-schedule-control-label",
									children: t("automation.schedule.periodicWeek")
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Select, {
									mode: "multiple",
									className: "atm-weekday-select",
									size: "medium",
									placement: "bottom",
									value: selectedWeekdays,
									options: weekdayOptions,
									onChange: (values) => onIntervalWeekdaysChange(values)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("span", {
									className: "atm-schedule-control-label",
									children: ["，", t("automation.schedule.runEvery")]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Input, {
									type: "number",
									className: "atm-modal-input atm-schedule-interval-input",
									min: 1,
									value: String(intervalHours),
									disabled: saving,
									onChange: (event) => onIntervalChange(Number(event.target.value) || 1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", {
									className: "atm-schedule-control-label",
									children: t("automation.schedule.intervalExecuteSuffix")
								})
							]
						}) : mode === "once" ? /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
							className: "atm-frequency-panel-stack atm-frequency-panel-stack--once",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Select, {
									className: "atm-frequency-select",
									size: "large",
									placement: "bottom",
									value: frequencySelectValue,
									options: periodicItems,
									onChange: handleFrequencySelectChange,
									fullWidth: true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(DatePicker, {
									className: "atm-modal-input atm-schedule-date-input",
									placement: "bottom-start",
									value: toDayjsDate(toDateInputValue(schedule.scheduledAt)),
									minDate: toDayjsDate(onceMinimum.date) ?? void 0,
									inputReadOnly: true,
									allowClear: false,
									disabled: saving,
									onChange: (date, dateString) => handleOnceDateChange(dateString || date?.format("YYYY-MM-DD") || "")
								}),
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(TimePicker, {
									className: "atm-modal-input atm-schedule-time-input",
									format: "HH:mm",
									placement: "top-start",
									value: toDayjsTime(onceTime),
									disabledTime: getOnceDisabledTime,
									showNow: false,
									inputReadOnly: true,
									allowClear: false,
									disabled: saving,
									onChange: (_time, timeString) => handleOnceTimeChange(timeString)
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
							className: "atm-periodic-fields",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Select, {
									className: "atm-frequency-select",
									size: "large",
									placement: "bottom",
									value: frequencySelectValue,
									options: periodicItems,
									onChange: handleFrequencySelectChange
								}),
								preset === "week" || preset === "biweek" ? /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Select, {
									mode: "multiple",
									className: "atm-weekday-select",
									size: "large",
									placement: "bottom",
									value: selectedWeekdays,
									options: weekdayOptions,
									onChange: (values) => onPeriodicWeekdaysChange(values)
								}) : null,
								preset === "year" ? /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Select, {
									className: "atm-month-select",
									size: "large",
									placement: "bottom",
									value: String(scheduleMonth),
									options: monthOptions,
									onChange: (value) => onMonthChange(Number(value) || 1)
								}) : null,
								preset === "month" || preset === "year" ? /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Select, {
									className: "atm-month-day-select",
									size: "large",
									placement: "bottom",
									value: String(scheduleMonthDay),
									options: monthDayOptions,
									onChange: (value) => onMonthDayChange(Number(value) || 1)
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(TimePicker, {
									className: "atm-modal-input atm-schedule-time-input",
									format: "HH:mm",
									placement: "top-start",
									value: toDayjsTime(scheduleTime),
									inputReadOnly: true,
									allowClear: false,
									disabled: saving,
									onChange: (_time, timeString) => onTimeChange(timeString)
								})
							]
						})]
					})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("div", {
				className: "atm-schedule-field atm-schedule-field--validity",
				children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(Popover, {
					open: validityOpen,
					onOpenChange: handleValidityOpenChange,
					placement: "top-start",
					portalRoot: "inline",
					offsetDistance: 6,
					stopClickPropagation: true,
					className: "atm-validity-popover",
					trigger: /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)(Button, {
						type: "button",
						variant: "ghost",
						className: "atm-schedule-trigger",
						disabled: saving,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("span", {
								className: "atm-schedule-trigger-label",
								children: [t("automation.validity.label"), t("common.colon")]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("span", {
								className: "atm-schedule-trigger-text",
								children: validitySummary
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(ChevronDownIcon, {
								className: "atm-custom-select-trigger-arrow",
								size: "sm"
							})
						]
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
						className: "atm-validity-panel",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("label", {
								className: "atm-schedule-control-label",
								children: t("automation.validity.fromLabel")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(DatePicker, {
								className: "atm-modal-input",
								placement: "top-start",
								value: toDayjsDate(toDateInputValue(schedule.validFrom)),
								minDate: toDayjsDate(todayLocalDate) ?? void 0,
								inputReadOnly: true,
								disabled: saving,
								onChange: (date, dateString) => handleValidFromChange(dateString || date?.format("YYYY-MM-DD") || "")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)("label", {
								className: "atm-schedule-control-label",
								children: t("automation.validity.untilLabel")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(DatePicker, {
								className: "atm-modal-input",
								placement: "top-start",
								value: toDayjsDate(toDateInputValue(schedule.validUntil)),
								minDate: toDayjsDate(validityUntilMinDate) ?? void 0,
								inputReadOnly: true,
								disabled: saving,
								onChange: (date, dateString) => handleValidUntilChange(dateString || date?.format("YYYY-MM-DD") || "")
							})
						]
					})
				})
			})]
		})
	});
}
function getScheduleMode(schedule) {
	if (schedule.type === "once") return "once";
	return schedule.rrule?.includes("FREQ=HOURLY") ? "interval" : "periodic";
}
function getPeriodicPreset(schedule) {
	const rrule = schedule.rrule || "";
	if (rrule.includes("FREQ=YEARLY")) return "year";
	if (rrule.includes("FREQ=MONTHLY")) return "month";
	if (rrule.includes("FREQ=WEEKLY") && rrule.includes("INTERVAL=2")) return "biweek";
	if (rrule.includes("FREQ=WEEKLY")) return "week";
	return "day";
}
function getIntervalHours(schedule) {
	const match = /INTERVAL=(\d+)/.exec(schedule.rrule || "");
	return Math.max(1, Number(match?.[1] || 1));
}
function getScheduleTime(schedule) {
	const rrule = schedule.rrule || "";
	const hour = Number(/BYHOUR=(\d+)/.exec(rrule)?.[1] ?? 9);
	const minute = Number(/BYMINUTE=(\d+)/.exec(rrule)?.[1] ?? 0);
	return `${String(Math.max(0, Math.min(23, hour))).padStart(2, "0")}:${String(Math.max(0, Math.min(59, minute))).padStart(2, "0")}`;
}
function getScheduleWeekdays(schedule) {
	const days = /BYDAY=([^;]+)/.exec(schedule.rrule || "")?.[1]?.split(",").filter((day) => WEEKDAYS.includes(day)) ?? [];
	return days.length > 0 ? days : [...WEEKDAYS];
}
function getScheduleMonth(schedule) {
	return clampNumber$1(Number(/BYMONTH=(\d+)/.exec(schedule.rrule || "")?.[1] ?? 1), 1, 12);
}
function getScheduleMonthDay(schedule) {
	return clampNumber$1(Number(/BYMONTHDAY=(\d+)/.exec(schedule.rrule || "")?.[1] ?? 1), 1, 31);
}
function toPeriodicRrule(preset, time, weekdays, month = 1, monthDay = 1) {
	const [hour = "09", minute = "00"] = time.split(":");
	const timePart = `BYHOUR=${Number(hour) || 0};BYMINUTE=${Number(minute) || 0}`;
	if (preset === "week") return `FREQ=WEEKLY;BYDAY=${weekdays.join(",")};${timePart}`;
	if (preset === "biweek") return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${weekdays.join(",")};${timePart}`;
	if (preset === "month") return `FREQ=MONTHLY;BYMONTHDAY=${monthDay};${timePart}`;
	if (preset === "year") return `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${monthDay};${timePart}`;
	return `FREQ=DAILY;${timePart}`;
}
function toIntervalRrule(hours, weekdays) {
	return `FREQ=HOURLY;INTERVAL=${Math.max(1, hours)};BYDAY=${weekdays.join(",")}`;
}
function getFrequencySummary(t, mode, preset, scheduleTime, intervalHours, weekdays, schedule, month, monthDay) {
	if (mode === "once") return `${t("automation.schedule.onceTab")} ${formatDateTime(schedule.scheduledAt)}`.trim();
	const dayText = weekdays.map((day) => t(`automation.day.${day}`)).join("、");
	if (mode === "interval") return t("automation.schedule.intervalSummary", {
		days: dayText,
		count: String(intervalHours)
	});
	const presetLabel = t(`automation.schedule.periodic${capitalizePreset(preset)}`);
	if (preset === "year") return `${presetLabel} ${month}${t("automation.schedule.monthUnit")}${monthDay}${t("automation.schedule.dayUnit")} ${scheduleTime}`;
	if (preset === "month") return `${presetLabel} ${monthDay}${t("automation.schedule.dayUnit")} ${scheduleTime}`;
	return preset === "week" || preset === "biweek" ? `${presetLabel} ${dayText} ${scheduleTime}` : `${presetLabel} ${scheduleTime}`;
}
function getValiditySummary(t, schedule) {
	const from = formatDate(schedule.validFrom);
	const until = formatDate(schedule.validUntil);
	if (from && until) return `${from} – ${until}`;
	if (from) return t("automation.validity.from", { from });
	if (until) return t("automation.validity.until", { until });
	return t("automation.validity.longTerm");
}
function capitalizePreset(preset) {
	if (preset === "biweek") return "Biweek";
	return `${preset.slice(0, 1).toUpperCase()}${preset.slice(1)}`;
}
function toDateInputValue(value) {
	if (!value) return "";
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return formatLocalDate(date);
}
/**
* `YYYY-MM-DD` → Dayjs（DatePicker 的 value 类型）。
* 空串和非法值返回 null，明确表达“受控但为空”，避免清空时退回非受控旧值。
*/
function toDayjsDate(value) {
	if (!value) return null;
	const parsed = (0, import_dayjs_min.default)(value);
	return parsed.isValid() ? parsed : null;
}
/**
* `HH:mm` → Dayjs（TimePicker 的 value 类型）。
* 用 hour/minute 直接赋值而非按 format 解析，避免依赖调用方的 parse 插件行为；
* 日期部分取今天，TimePicker 只消费时分。
*/
function toDayjsTime(value) {
	if (!value) return;
	const [hour, minute] = value.split(":").map(Number);
	if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
	return (0, import_dayjs_min.default)().hour(hour).minute(minute).second(0).millisecond(0);
}
function fromDateInputValue(value) {
	return value ? (/* @__PURE__ */ new Date(`${value}T00:00:00`)).toISOString() : void 0;
}
function toDateTimeLocalValue(value) {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return `${formatLocalDate(date)}T${formatLocalTime(date)}`;
}
function toIsoDateTime(value) {
	return value ? new Date(value).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
}
function formatDate(value) {
	return toDateInputValue(value).replace(/-/g, "/");
}
function formatDateTime(value) {
	return toDateTimeLocalValue(value).replace("T", " ");
}
function getOnceTime(value, fallback) {
	return toDateTimeLocalValue(value).slice(11, 16) || fallback;
}
function mergeOnceDateTime(dateSource, timeSource) {
	return toIsoDateTime(`${toDateInputValue(dateSource) || formatLocalDate(/* @__PURE__ */ new Date())}T${timeSource || "09:00"}`);
}
function formatLocalDate(date) {
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0")
	].join("-");
}
function formatLocalTime(date) {
	return [String(date.getHours()).padStart(2, "0"), String(date.getMinutes()).padStart(2, "0")].join(":");
}
function isFutureLocalDateTime(dateValue, timeValue) {
	return (/* @__PURE__ */ new Date(`${dateValue}T${timeValue}:00`)).getTime() > Date.now();
}
function isDateBefore(dateValue, minDateValue) {
	return Boolean(dateValue && minDateValue && dateValue < minDateValue);
}
function getLaterLocalDate(dateValue, fallbackDateValue) {
	if (!dateValue) return fallbackDateValue;
	return dateValue > fallbackDateValue ? dateValue : fallbackDateValue;
}
function clampNumber$1(value, min, max) {
	if (!Number.isFinite(value)) return min;
	return Math.max(min, Math.min(max, value));
}
var import_react$10, import_jsx_runtime$8, WEEKDAYS, MONTHS, MONTH_DAYS;
var init_automation_schedule_controls = __esmMin((() => {
	init_automation_schedule_controls$1();
	init_src();
	import_react$10 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_schedule_validation();
	import_jsx_runtime$8 = require_jsx_runtime();
	WEEKDAYS = [
		"MO",
		"TU",
		"WE",
		"TH",
		"FR",
		"SA",
		"SU"
	];
	MONTHS = [
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		12
	];
	MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-sidebar-actions.tsx
function useAutomationTrafficLightOffset() {
	const adapter = (0, import_react$9.useContext)(AdapterContext);
	const conversationsContext = (0, import_react$9.useContext)(ConversationsContext);
	return isMac && adapter?.environmentType === "local" && !!conversationsContext?.sidebarCollapsed;
}
function AutomationSidebarActions() {
	if (!(0, import_react$9.useContext)(ConversationsContext)) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)(import_jsx_runtime$7.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(SidebarExpandButton, {}), /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(SidebarNewTaskButton, {})] });
}
var import_react$9, import_jsx_runtime$7;
var init_automation_sidebar_actions = __esmMin((() => {
	import_react$9 = /* @__PURE__ */ __toESM(require_react());
	init_workbuddy_topbar();
	init_contexts();
	import_jsx_runtime$7 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-editor-form.tsx
/** Automation create/edit detail page: restores the legacy full-page shell while writing to the new form state. */
function AutomationEditorForm({ mode, form, saving = false, error, variant = "modal", sideSlot, canSelectSkills = false, onChange, onCancel, onSave, onTest, onDelete, onDismissError, onSummonExpert }) {
	const t = useTranslation();
	const needTrafficLightOffset = useAutomationTrafficLightOffset();
	const execution = form.execution ?? { permissionMode: "fullAccess" };
	const formRef = useLatestRef(form);
	const executionRef = useLatestRef(execution);
	const scheduleMode = getScheduleMode(form.schedule);
	const periodicPreset = getPeriodicPreset(form.schedule);
	const scheduleTime = getScheduleTime(form.schedule);
	const intervalHours = getIntervalHours(form.schedule);
	const intervalWeekdays = getScheduleWeekdays(form.schedule);
	const scheduleMonth = getScheduleMonth(form.schedule);
	const scheduleMonthDay = getScheduleMonthDay(form.schedule);
	function updateForm(patch) {
		onChange({
			...formRef.current,
			...patch
		});
	}
	function updateExecution(patch) {
		updateForm({ execution: {
			...executionRef.current,
			...patch
		} });
	}
	function updateSchedule(patch) {
		updateForm({ schedule: {
			...formRef.current.schedule,
			...patch
		} });
	}
	function handlePromptChange(newPrompt, newSkills) {
		const currentSkills = executionRef.current.skills ?? [];
		if (newPrompt === formRef.current.prompt && newSkills.length === currentSkills.length && newSkills.every((s, i) => s === currentSkills[i])) return;
		updateForm({
			prompt: newPrompt,
			execution: {
				...executionRef.current,
				skills: newSkills
			}
		});
	}
	function handleScheduleModeChange(nextMode) {
		const validity = {
			validFrom: form.schedule.validFrom,
			validUntil: form.schedule.validUntil
		};
		if (nextMode === "once") {
			updateForm({ schedule: {
				...validity,
				type: "once",
				scheduledAt: form.schedule.scheduledAt || getDefaultOnceScheduledAtIso()
			} });
			return;
		}
		if (nextMode === "interval") {
			updateForm({ schedule: {
				...validity,
				type: "recurring",
				rrule: toIntervalRrule(intervalHours, intervalWeekdays)
			} });
			return;
		}
		updateForm({ schedule: {
			...validity,
			type: "recurring",
			rrule: toPeriodicRrule(periodicPreset, scheduleTime, intervalWeekdays, scheduleMonth, scheduleMonthDay)
		} });
	}
	const title = mode === "create" ? t("automation.modal.titleCreate") : form.name || t("automation.modal.title");
	const isPromptTooLong = form.prompt.length > AUTOMATION_PROMPT_MAX_LENGTH;
	const saveDisabled = saving || !form.name.trim() || !form.prompt.trim() || isPromptTooLong;
	return /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("section", {
		className: `atm-detail-page automation-editor-form automation-editor-form--${variant}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("header", {
				className: `atm-detail-header${needTrafficLightOffset ? " atm-detail-header--traffic-light-offset" : ""}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
					className: "atm-detail-header-left",
					children: [variant === "page" ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)(import_jsx_runtime$6.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(AutomationSidebarActions, {}), /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
						type: "button",
						variant: "ghost",
						iconOnly: true,
						className: "atm-detail-breadcrumb-back cb-font-size-fixed",
						onClick: onCancel,
						"aria-label": t("automation.detail.breadcrumb"),
						children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(BackChevronIcon, { size: "lg" })
					})] }) : null, /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", {
						className: "atm-detail-breadcrumb-current cb-font-size-fixed",
						children: title
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("div", {
					className: "atm-detail-header-right",
					children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
						className: "atm-detail-icon-actions",
						children: [
							mode === "edit" && onTest ? variant === "page" ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
								type: "button",
								variant: "ghost",
								iconOnly: true,
								className: "atm-detail-icon-btn atm-detail-icon-btn--play",
								disabled: saving || isPromptTooLong,
								onClick: onTest,
								"aria-label": t("automation.modal.test"),
								children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(RunPlayIcon, {
									width: 16,
									height: 16
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
								type: "button",
								variant: "ghost",
								className: "atm-detail-icon-btn",
								disabled: saving || isPromptTooLong,
								onClick: onTest,
								children: t("automation.modal.test")
							}) : null,
							mode === "edit" && onDelete ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Popconfirm, {
								title: t("automation.delete.title", { name: form.name }),
								description: t("automation.delete.description"),
								okText: t("automation.delete.confirm"),
								cancelText: t("common.cancel"),
								okType: "danger",
								onConfirm: onDelete,
								disabled: saving,
								children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
									type: "button",
									variant: "ghost",
									danger: true,
									iconOnly: true,
									className: "atm-detail-icon-btn",
									disabled: saving,
									"aria-label": t("common.delete"),
									children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(DeleteIcon, { size: "sm" })
								})
							}) : null,
							variant === "page" ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)(import_jsx_runtime$6.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
								type: "button",
								variant: "secondary",
								disabled: saving,
								onClick: onCancel,
								children: t("automation.detail.action.cancel")
							}), /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
								type: "button",
								variant: "primary",
								disabled: saveDisabled,
								loading: saving,
								onClick: onSave,
								children: t("automation.detail.action.save")
							})] }) : /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
								type: "button",
								variant: "ghost",
								iconOnly: true,
								className: "atm-detail-close-btn",
								disabled: saving,
								onClick: onCancel,
								"aria-label": t("common.close"),
								children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(XCloseIcon, { size: "sm" })
							})
						]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
				className: `atm-detail-content${sideSlot ? " atm-detail-content--with-side" : ""}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
					className: "atm-modal-body",
					children: [
						error ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("div", {
							className: "automation-workspace__error automation-workspace__error--editor",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("span", { children: error }), onDismissError ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("button", {
								type: "button",
								className: "automation-workspace__error-close",
								onClick: onDismissError,
								"aria-label": t("common.close"),
								children: "×"
							}) : null]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("label", {
							className: "atm-modal-label",
							children: t("automation.modal.name")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Input, {
							className: "atm-modal-input",
							placeholder: t("automation.modal.namePlaceholder"),
							value: form.name,
							disabled: saving,
							onChange: (event) => updateForm({ name: event.target.value })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("label", {
							className: "atm-modal-label",
							children: t("automation.modal.prompt")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)("div", {
							className: "atm-modal-chat-input",
							children: /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(AutomationPromptInput, {
								prompt: form.prompt,
								skills: execution.skills ?? [],
								execution,
								canSelectSkills,
								saving,
								placeholder: t("automation.modal.promptPlaceholder"),
								onSummonExpert,
								onPromptChange: handlePromptChange,
								onExecutionChange: updateExecution
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(ScheduleControls, {
							mode: scheduleMode,
							preset: periodicPreset,
							scheduleTime,
							intervalHours,
							scheduleMonth,
							scheduleMonthDay,
							schedule: form.schedule,
							saving,
							onModeChange: handleScheduleModeChange,
							onPresetChange: (preset) => updateSchedule({
								type: "recurring",
								rrule: toPeriodicRrule(preset, scheduleTime, intervalWeekdays, scheduleMonth, scheduleMonthDay)
							}),
							onTimeChange: (time) => updateSchedule({
								type: "recurring",
								rrule: toPeriodicRrule(periodicPreset, time, intervalWeekdays, scheduleMonth, scheduleMonthDay)
							}),
							onPeriodicWeekdaysChange: (days) => updateSchedule({
								type: "recurring",
								rrule: toPeriodicRrule(periodicPreset, scheduleTime, days, scheduleMonth, scheduleMonthDay)
							}),
							onIntervalChange: (hours) => updateSchedule({
								type: "recurring",
								rrule: toIntervalRrule(hours, intervalWeekdays)
							}),
							onIntervalWeekdaysChange: (days) => updateSchedule({
								type: "recurring",
								rrule: toIntervalRrule(intervalHours, days)
							}),
							onMonthChange: (month) => updateSchedule({
								type: "recurring",
								rrule: toPeriodicRrule(periodicPreset, scheduleTime, intervalWeekdays, month, scheduleMonthDay)
							}),
							onMonthDayChange: (day) => updateSchedule({
								type: "recurring",
								rrule: toPeriodicRrule(periodicPreset, scheduleTime, intervalWeekdays, scheduleMonth, day)
							}),
							onOnceChange: (scheduledAt) => updateSchedule({
								type: "once",
								scheduledAt
							}),
							onValidityChange: (validFrom, validUntil) => updateSchedule({
								validFrom,
								validUntil
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(AutomationDeliveryOptions, {
							variant,
							execution,
							saving,
							onChange: updateExecution
						})
					]
				}), sideSlot]
			}),
			variant === "modal" ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)("footer", {
				className: "atm-detail-footer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
					type: "button",
					variant: "secondary",
					disabled: saving,
					onClick: onCancel,
					children: t("automation.detail.action.cancel")
				}), /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
					type: "button",
					variant: "primary",
					disabled: saveDisabled,
					loading: saving,
					onClick: onSave,
					children: t("automation.detail.action.confirm")
				})]
			}) : null
		]
	});
}
var import_jsx_runtime$6, AUTOMATION_PROMPT_MAX_LENGTH;
var init_automation_editor_form = __esmMin((() => {
	init_automation_editor_form$1();
	init_src();
	require_react();
	init_use_latest_ref();
	init_useI18n();
	init_schedule_validation();
	init_automation_delivery_options();
	init_automation_prompt_input();
	init_automation_schedule_controls();
	init_automation_sidebar_actions();
	import_jsx_runtime$6 = require_jsx_runtime();
	AUTOMATION_PROMPT_MAX_LENGTH = 1e5;
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-record-filter-dropdown.tsx
function AutomationRecordFilterDropdown({ value, className = "atm-filter-btn", onChange }) {
	const t = useTranslation();
	return /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(Dropdown, {
		placement: "bottom-end",
		portalRoot: "body",
		trigger: /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(Button, {
			type: "button",
			variant: "ghost",
			iconOnly: true,
			className: `${className} ${value !== "all" ? `${className}--active` : ""}`,
			"aria-label": t("automation.record.filter"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(TaskFilterIcon, {}), value !== "all" ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("span", { className: "atm-filter-dot" }) : null]
		}),
		items: AUTOMATION_RECORD_FILTERS.map((filter) => ({
			key: filter,
			label: t(`automation.filter.${filter}`),
			selected: value === filter
		})),
		onSelect: (key) => onChange(key)
	});
}
var import_jsx_runtime$5, AUTOMATION_RECORD_FILTERS;
var init_automation_record_filter_dropdown = __esmMin((() => {
	init_src();
	require_react();
	init_useI18n();
	import_jsx_runtime$5 = require_jsx_runtime();
	AUTOMATION_RECORD_FILTERS = [
		"all",
		"success",
		"failed",
		"running",
		"archived"
	];
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-detail-history.tsx
/** Inline run-history column shown beside the Automation detail form. */
function AutomationDetailHistory({ records, automationName, onOpenRecord, onArchiveRecord, onUnarchiveRecord, onDeleteRecord }) {
	const t = useTranslation();
	const [filter, setFilter] = (0, import_react$6.useState)("all");
	const visibleRecords = (0, import_react$6.useMemo)(() => records.filter((record) => record.status !== "queued"), [records]);
	const filteredRecords = (0, import_react$6.useMemo)(() => filterRecords(visibleRecords, filter).sort(compareAutomationRecords), [filter, visibleRecords]);
	return /* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("aside", {
		className: "atm-detail-history",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("div", {
			className: "atm-detail-history-header",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
				className: "atm-detail-history-title",
				children: t("automation.detail.runHistory").replace("{count}", String(visibleRecords.length))
			}), /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(AutomationRecordFilterDropdown, {
				value: filter,
				className: "atm-detail-history-filter",
				onChange: setFilter
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("div", {
			className: "atm-detail-history-list",
			children: filteredRecords.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("div", {
				className: "atm-detail-history-empty",
				children: visibleRecords.length === 0 ? t("automation.empty.noRecords") : t("automation.empty.noFilteredRecords")
			}) : filteredRecords.map((record) => {
				const isPending = record.status === "queued" || record.status === "running";
				const canArchive = !record.archived && !isPending;
				const canUnarchive = record.archived && !isPending;
				const canDelete = !isPending;
				const statusLabel = getAutomationHistoryStatusLabel(record, t);
				const recordName = automationName || record.automationId || t("automation.detail.runs");
				return /* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("div", {
					className: `atm-detail-history-row ${record.archived ? "atm-archived" : ""}`,
					onClick: () => onOpenRecord(record),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("span", {
							className: "atm-detail-history-main",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
								className: "atm-detail-history-name",
								title: recordName,
								children: recordName
							}), /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", {
								className: "atm-detail-history-result",
								title: statusLabel,
								children: statusLabel
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("span", {
							className: "atm-detail-history-meta",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$4.jsx)("span", { children: formatRecordTime$1(record) }), record.archived ? /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(ArchiveIcon, {
								size: "sm",
								color: "var(--wb-color-text-disabled)"
							}) : /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(AutomationHistoryStatusIcon, { statusClass: getAutomationHistoryStatusClass(record) })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$4.jsxs)("span", {
							className: "atm-detail-history-actions",
							children: [
								canArchive ? /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(Tooltip, {
									content: t("automation.action.archive"),
									placement: "top",
									children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(Button, {
										type: "button",
										variant: "ghost",
										iconOnly: true,
										className: "atm-row-action-btn",
										"aria-label": t("automation.action.archive"),
										onClick: (event) => {
											event.stopPropagation();
											onArchiveRecord(record.id).then(() => void 0);
										},
										children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(ArchiveIcon, {})
									})
								}) : null,
								canUnarchive ? /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(Tooltip, {
									content: t("automation.action.unarchive"),
									placement: "top",
									children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(Button, {
										type: "button",
										variant: "ghost",
										iconOnly: true,
										className: "atm-row-action-btn",
										"aria-label": t("automation.action.unarchive"),
										onClick: (event) => {
											event.stopPropagation();
											onUnarchiveRecord(record.id).then(() => void 0);
										},
										children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(UnarchiveIcon, {})
									})
								}) : null,
								canDelete ? /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(Tooltip, {
									content: t("common.delete"),
									placement: "top",
									children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(Button, {
										type: "button",
										variant: "ghost",
										iconOnly: true,
										className: "atm-row-action-btn",
										"aria-label": t("common.delete"),
										onClick: (event) => {
											event.stopPropagation();
											onDeleteRecord(record.id).then(() => void 0);
										},
										children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(DeleteIcon, {})
									})
								}) : null
							]
						})
					]
				}, record.id);
			})
		})]
	});
}
function compareAutomationRecords(left, right) {
	const priority = (record) => {
		if (record.status === "running") return 0;
		if (record.status === "queued") return 1;
		return 2;
	};
	const priorityDiff = priority(left) - priority(right);
	if (priorityDiff !== 0) return priorityDiff;
	const leftTime = left.startedAt || 0;
	const rightTime = right.startedAt || 0;
	return left.status === "queued" ? leftTime - rightTime : rightTime - leftTime;
}
function filterRecords(records, filter) {
	return records.filter((record) => {
		if (filter === "archived") return record.archived === true;
		if (filter === "all") return true;
		return filter === "running" ? record.status === "running" : record.status === filter;
	});
}
function formatRecordTime$1(record) {
	const value = record.finishedAt || record.startedAt;
	if (!value) return "";
	const date = new Date(value);
	const time = date.toLocaleTimeString("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	});
	if (record.archived) return `${date.toLocaleDateString([], {
		month: "2-digit",
		day: "2-digit"
	})} ${time}`;
	return time;
}
var import_react$6, import_jsx_runtime$4;
var init_automation_detail_history = __esmMin((() => {
	init_src();
	import_react$6 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_automation_history_status_icon();
	init_history_detail_utils();
	init_automation_record_filter_dropdown();
	import_jsx_runtime$4 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-editor-surface.tsx
/** Reuses the same editor form in create-modal and edit-detail page shells. */
function AutomationEditorSurface({ mode, form, records, automationName, error, showConfirmDialog, onConfirmPermission, onCancelPermission, onFallbackPermission, onOpenRecord, onArchiveRecord, onUnarchiveRecord, onDeleteRecord, ...formProps }) {
	const editor = /* @__PURE__ */ (0, import_jsx_runtime$3.jsxs)(import_jsx_runtime$3.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(AutomationEditorForm, {
		...formProps,
		mode,
		form,
		error,
		variant: mode === "edit" ? "page" : "modal",
		sideSlot: mode === "edit" ? /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(AutomationDetailHistory, {
			records,
			automationName,
			onOpenRecord,
			onArchiveRecord,
			onUnarchiveRecord,
			onDeleteRecord
		}) : void 0
	}), showConfirmDialog ? /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(AutomationPermissionConfirmDialog, {
		open: true,
		onConfirm: onConfirmPermission,
		onCancel: onCancelPermission,
		onFallbackToDefault: onFallbackPermission
	}) : null] });
	if (mode === "edit") return editor;
	return /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(Modal, {
		open: true,
		onOpenChange: () => void 0,
		width: 800,
		unstyled: true,
		className: "automation-editor-modal",
		wrapClassName: "automation-editor-modal-overlay",
		closeOnOverlayClick: false,
		closeOnEscape: false,
		footer: null,
		children: editor
	});
}
var import_jsx_runtime$3;
var init_automation_editor_surface = __esmMin((() => {
	init_src();
	require_react();
	init_automation_permission_confirm_dialog();
	init_automation_detail_history();
	init_automation_editor_form();
	import_jsx_runtime$3 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-toolbar.tsx
/** Restores the legacy Automation top toolbar while delegating all actions to the new page logic. */
function AutomationToolbar({ activeTab, keyword, recordFilter, batchMode, selectedCount, selectableCount, showTemplateEntryButton, hideRightActions = false, onTabChange, onKeywordChange, onRecordFilterChange, onToggleBatchMode, onToggleSelectAll, onBatchDelete, onOpenTemplates, onCreate }) {
	const t = useTranslation();
	const { isDesktopMac, sidebarCollapsed, isFullscreen } = useDesktopWindowState();
	const needTrafficLightOffset = isDesktopMac && sidebarCollapsed && !isFullscreen;
	const isRightHidden = hideRightActions || activeTab === "records" && selectableCount === 0 && !keyword;
	let rightContent = null;
	if (batchMode) rightContent = /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Button, {
		type: "button",
		variant: "secondary",
		className: "atm-toolbar-btn",
		onClick: onToggleBatchMode,
		children: t("automation.batch.exit")
	});
	else if (!isRightHidden) rightContent = /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)(import_jsx_runtime$2.Fragment, { children: [
		activeTab === "records" ? /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
			className: "atm-filter-wrap",
			children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(AutomationRecordFilterDropdown, {
				value: recordFilter,
				onChange: onRecordFilterChange
			})
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Input, {
			className: "atm-search-input",
			variant: "filled",
			placeholder: t("automation.toolbar.search"),
			value: keyword,
			allowClear: true,
			prefix: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(SearchIcon, { size: "sm" }),
			onChange: (event) => onKeywordChange(event.target.value)
		}),
		activeTab === "tasks" ? /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)(import_jsx_runtime$2.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Button, {
			type: "button",
			variant: "secondary",
			className: "atm-toolbar-btn",
			onClick: onToggleBatchMode,
			children: t("automation.toolbar.batchManage")
		}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
			className: "atm-create-split",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Button, {
				type: "button",
				variant: "primary",
				className: "atm-create-btn",
				onClick: onCreate,
				"data-track-id": "automation_add",
				"data-track-name": "添加自动化",
				"data-track-props": "{\"type\":\"add\"}",
				children: t("automation.toolbar.addAutomation")
			}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Dropdown, {
				placement: "bottom-end",
				trigger: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Button, {
					type: "button",
					variant: "primary",
					iconOnly: true,
					className: "atm-create-menu-btn",
					"aria-label": t("automation.toolbar.addAutomation"),
					children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(ChevronDownIcon, { size: "sm" })
				}),
				items: [{
					key: "create",
					label: t("automation.toolbar.addAutomation")
				}, {
					key: "template",
					label: t("automation.toolbar.addFromTemplate"),
					disabled: !showTemplateEntryButton
				}],
				onSelect: (key) => {
					if (key === "template") {
						onOpenTemplates();
						return;
					}
					onCreate();
				}
			})]
		})] }) : null
	] });
	return /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
		className: ["atm-toolbar", needTrafficLightOffset && "atm-toolbar--traffic-light-offset"].filter(Boolean).join(" "),
		children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
			className: "atm-toolbar-left",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(SidebarExpandButton, {}),
				/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(SidebarNewTaskButton, {}),
				batchMode ? /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
					className: "atm-batch-info",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Button, {
							type: "button",
							variant: "secondary",
							size: "medium",
							onClick: onToggleSelectAll,
							children: selectedCount > 0 && selectedCount === selectableCount ? t("automation.batch.deselectAll") : t("automation.batch.selectAll")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Button, {
							type: "button",
							variant: "primary",
							danger: true,
							size: "medium",
							disabled: selectedCount === 0,
							onClick: onBatchDelete,
							children: t("automation.batch.delete")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("span", {
							className: "atm-batch-count",
							children: t("automation.batch.selected").replace("{count}", String(selectedCount))
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Segmented, {
					className: "atm-toolbar-tabs",
					value: activeTab,
					onChange: onTabChange,
					options: [{
						value: "tasks",
						label: t("automation.tab.scheduledTasks"),
						icon: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(AtmScheduledTaskIcon, { size: "md" })
					}, {
						value: "records",
						label: t("automation.tab.runRecords"),
						icon: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(AtmRunRecordIcon, { size: "md" })
					}]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
			className: "atm-toolbar-right",
			children: rightContent
		})]
	});
}
var import_jsx_runtime$2;
var init_automation_toolbar = __esmMin((() => {
	init_src();
	require_react();
	init_workbuddy_topbar();
	init_useI18n();
	init_automation_record_filter_dropdown();
	import_jsx_runtime$2 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/utils/automation-schedule-display.ts
function describeAutomationSchedule(schedule, t) {
	const scheduleText = getScheduleText(schedule, t);
	const validityText = getValidityText(schedule, t);
	if (!validityText) return scheduleText;
	return scheduleText ? `${scheduleText} · ${validityText}` : validityText;
}
function getScheduleText(schedule, t) {
	if (schedule.type === "once") {
		const scheduledLabel = formatDateTimeLabel(schedule.scheduledAt);
		return scheduledLabel ? t("automation.schedule.onceAt", { time: scheduledLabel }) : t("automation.schedule.once");
	}
	return schedule.rrule ? describeRRule(schedule.rrule, t) : "";
}
function formatRelativeTime(ms, t) {
	if (!ms) return "";
	const diff = ms - Date.now();
	if (diff <= 0) return t("automation.time.soon");
	const minutes = Math.floor(diff / 6e4);
	const hours = Math.floor(diff / 36e5);
	const days = Math.floor(hours / 24);
	if (days > 0) return t("automation.time.days", { count: days });
	if (hours > 0) return t("automation.time.hours", { count: hours });
	return t("automation.time.minutes", { count: Math.max(1, minutes) });
}
function describeRRule(rrule, t) {
	try {
		const schedule = parseRRule(rrule);
		const pad = (value) => String(value).padStart(2, "0");
		const time = `${pad(schedule.byhour)}:${pad(schedule.byminute)}`;
		if (schedule.freq === "HOURLY") {
			if (schedule.byday.length < ALL_DAYS.length) return t("automation.schedule.intervalSummary", {
				days: sortWeekdays(schedule.byday).map((day) => t(`automation.day.${day}`)).join("、"),
				count: schedule.intervalHours
			});
			return t("automation.schedule.everyNHours", { count: schedule.intervalHours });
		}
		if (schedule.freq === "DAILY") return t("automation.schedule.dailyAt", { time });
		if (schedule.freq === "WEEKLY") {
			const days = sortWeekdays(schedule.byday).map((day) => t(`automation.day.${day}`)).join("、");
			return schedule.interval === 2 ? t("automation.schedule.biweeklyAt", {
				days,
				time
			}) : t("automation.schedule.weeklyAt", {
				days,
				time
			});
		}
		if (schedule.freq === "MONTHLY") return t("automation.schedule.monthlyAt", {
			days: sortMonthDays(schedule.bymonthday).map((day) => `${day}${t("automation.schedule.dayUnit")}`).join("、"),
			time
		});
		const month = sortMonths(schedule.bymonth)[0];
		const day = sortMonthDays(schedule.bymonthday)[0];
		return month && day ? t("automation.schedule.yearlyAt", {
			month,
			day,
			time
		}) : rrule;
	} catch {
		return rrule;
	}
}
function parseRRule(rrule) {
	const map = /* @__PURE__ */ new Map();
	for (const pair of (rrule || "").split(";")) {
		const [key, value] = pair.split("=");
		if (key && value) map.set(key.trim().toUpperCase(), value.trim().toUpperCase());
	}
	const rawFreq = map.get("FREQ") || "DAILY";
	const interval = Math.max(1, Number.parseInt(map.get("INTERVAL") || "1", 10) || 1);
	const byhour = clampNumber(Number.parseInt(map.get("BYHOUR") || "0", 10) || 0, 0, 23);
	const byminute = clampNumber(Number.parseInt(map.get("BYMINUTE") || "0", 10) || 0, 0, 59);
	const byday = sortWeekdays((map.get("BYDAY") || "").split(",").map((day) => day.trim()));
	const bymonthday = sortMonthDays((map.get("BYMONTHDAY") || "").split(",").map((part) => Number.parseInt(part.trim(), 10)).filter(Number.isFinite));
	const bymonth = sortMonths((map.get("BYMONTH") || "").split(",").map((part) => Number.parseInt(part.trim(), 10)).filter(Number.isFinite));
	if (rawFreq === "HOURLY") return {
		freq: "HOURLY",
		interval,
		intervalHours: interval,
		byday: byday.length > 0 ? byday : ALL_DAYS.slice(),
		bymonthday: [],
		bymonth: [],
		byhour,
		byminute
	};
	if (rawFreq === "MONTHLY") return {
		freq: "MONTHLY",
		interval,
		intervalHours: 1,
		byday: [],
		bymonthday,
		bymonth: [],
		byhour,
		byminute
	};
	if (rawFreq === "YEARLY") return {
		freq: "YEARLY",
		interval,
		intervalHours: 1,
		byday: [],
		bymonthday,
		bymonth,
		byhour,
		byminute
	};
	if (rawFreq === "WEEKLY") return {
		freq: "WEEKLY",
		interval,
		intervalHours: 1,
		byday,
		bymonthday: [],
		bymonth: [],
		byhour,
		byminute
	};
	return {
		freq: "DAILY",
		interval: 1,
		intervalHours: 1,
		byday: ALL_DAYS.slice(),
		bymonthday: [],
		bymonth: [],
		byhour,
		byminute
	};
}
function formatDateTimeLabel(value) {
	const date = value ? new Date(value) : void 0;
	return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "";
}
function getValidityText(schedule, t) {
	const from = formatDateLabel(schedule.validFrom);
	const until = formatDateLabel(schedule.validUntil);
	if (from && until) return t("automation.validity.range", {
		from,
		until
	});
	if (from) return t("automation.validity.from", { from });
	if (until) return t("automation.validity.until", { until });
	return "";
}
function formatDateLabel(value) {
	const date = value ? new Date(value) : void 0;
	return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : "";
}
function sortWeekdays(days) {
	return [...new Set(days.filter((day) => ALL_DAYS.includes(day)))].sort((left, right) => ALL_DAYS.indexOf(left) - ALL_DAYS.indexOf(right));
}
function sortMonthDays(days) {
	return [...new Set(days)].filter((day) => day >= 1 && day <= 31).sort((left, right) => left - right);
}
function sortMonths(months) {
	return [...new Set(months)].filter((month) => month >= 1 && month <= 12).sort((left, right) => left - right);
}
function clampNumber(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
var ALL_DAYS;
var init_automation_schedule_display = __esmMin((() => {
	ALL_DAYS = [
		"MO",
		"TU",
		"WE",
		"TH",
		"FR",
		"SA",
		"SU"
	];
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/utils/automation-task-groups.ts
function splitAutomationTasks(automations, runtimeState = {}) {
	const groups = {
		running: [],
		current: [],
		paused: []
	};
	for (const automation of automations) {
		if (runtimeState[automation.id]?.running || automation.latestRecord?.status === "queued" || automation.latestRecord?.status === "running") {
			groups.running.push(automation);
			continue;
		}
		if (automation.status === "ACTIVE") {
			groups.current.push(automation);
			continue;
		}
		if (automation.status === "PAUSED") groups.paused.push(automation);
	}
	groups.running.sort((left, right) => getPendingTaskPriority(left, runtimeState) - getPendingTaskPriority(right, runtimeState));
	return groups;
}
function getPendingTaskPriority(automation, runtimeState) {
	if (runtimeState[automation.id]?.running || automation.latestRecord?.status === "running") return 0;
	return 1;
}
var init_automation_task_groups = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/automation-workspace-list.tsx
/** Scheduled task tab restored to the legacy grouped list shape while using the new action callbacks. */
function TaskTab({ items, recordsByAutomationId, selectedIds, batchMode, templateItems, showTemplateGrid, onOpenRecord, onEdit, onTrigger, onToggleStatus, onDelete, onToggleSelect, onCreate, onSelectTemplate }) {
	const t = useTranslation();
	const [collapsedGroups, setCollapsedGroups] = (0, import_react$3.useState)(/* @__PURE__ */ new Set());
	const taskItems = (0, import_react$3.useMemo)(() => items.map((item) => ({
		...item,
		latestRecord: recordsByAutomationId[item.id]?.[0] ?? item.latestRecord
	})), [items, recordsByAutomationId]);
	const taskGroupsByStatus = (0, import_react$3.useMemo)(() => splitAutomationTasks(taskItems), [taskItems]);
	const sharedGroupProps = {
		recordsByAutomationId,
		selectedIds,
		batchMode,
		onOpenRecord,
		onEdit,
		onTrigger,
		onToggleStatus,
		onDelete,
		onToggleSelect
	};
	const taskGroups = [
		{
			key: "running",
			title: t("automation.list.groupRunning"),
			items: taskGroupsByStatus.running
		},
		{
			key: "current",
			title: t("automation.list.groupCurrent"),
			items: taskGroupsByStatus.current
		},
		{
			key: "paused",
			title: t("automation.list.groupPaused"),
			items: taskGroupsByStatus.paused
		}
	];
	if (items.length === 0 && showTemplateGrid) return /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
		className: "atm-empty-state",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: "atm-empty-state-hero",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
					className: "atm-empty-state-icon",
					children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AutomationEmptyAlarmIcon, {
						width: 48,
						height: 48
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
					className: "atm-empty-state-text",
					children: t("automation.empty.firstTask")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
					className: "atm-empty-state-actions",
					children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Button, {
						type: "button",
						variant: "primary",
						className: "atm-empty-action-btn",
						leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AddIcon, { size: "md" }),
						onClick: onCreate,
						children: t("automation.toolbar.addAutomation")
					})
				})
			]
		}), templateItems.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: "atm-empty-state-templates",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "atm-empty-state-templates-title",
				children: t("automation.templates.sectionTitle")
			}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AutomationTemplateGrid, {
				templates: templateItems,
				variant: "compact",
				onSelectTemplate
			})]
		}) : null]
	});
	if (items.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
		className: "atm-empty-state",
		children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: "atm-empty-state-hero",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "atm-empty-state-icon",
				children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AutomationEmptyAlarmIcon, {
					width: 48,
					height: 48
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "atm-empty-state-text",
				children: t("automation.empty.noFilteredTasks")
			})]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
		className: "atm-task-list",
		children: taskGroups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(TaskGroup, {
			...sharedGroupProps,
			title: group.title,
			items: group.items,
			isCollapsed: collapsedGroups.has(group.key),
			onToggleCollapsed: () => setCollapsedGroups((prev) => toggleSetValue(prev, group.key))
		}, group.key))
	});
}
function TaskGroup(props) {
	if (props.items.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)(import_jsx_runtime$1.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("button", {
		type: "button",
		className: "atm-task-group-label",
		"aria-expanded": !props.isCollapsed,
		onClick: props.onToggleCollapsed,
		children: [props.title, /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ChevronDownIcon, {
			className: `atm-records-group-chevron${props.isCollapsed ? " atm-records-group-chevron--collapsed" : ""}`,
			size: "lg"
		})]
	}), !props.isCollapsed ? props.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AutomationRow, {
		item,
		latestRecord: props.recordsByAutomationId[item.id]?.[0],
		isBatchMode: props.batchMode,
		isSelected: props.selectedIds.has(item.id),
		onEdit: props.onEdit,
		onTrigger: props.onTrigger,
		onToggleStatus: props.onToggleStatus,
		onDelete: props.onDelete,
		onToggleSelect: props.onToggleSelect
	}, item.id)) : null] });
}
function AutomationRow({ item, latestRecord, isBatchMode, isSelected, onEdit, onTrigger, onToggleStatus, onDelete, onToggleSelect }) {
	const t = useTranslation();
	const [menuOpen, setMenuOpen] = (0, import_react$3.useState)(false);
	const isActive = item.status === "ACTIVE";
	const scheduleDescription = describeAutomationSchedule(item.schedule, t);
	const handleRowClick = () => {
		if (isBatchMode) {
			onToggleSelect(item.id);
			return;
		}
		onEdit(item.id);
	};
	const handleCheckboxClick = (event) => {
		event.stopPropagation();
		if (event.target === event.currentTarget) onToggleSelect(item.id);
	};
	const handleCheckboxChange = (event) => {
		event.stopPropagation();
		onToggleSelect(item.id);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
		className: `atm-row ${isBatchMode ? "atm-row--batch" : ""} ${menuOpen ? "atm-row--menu-open" : ""}`,
		onClick: handleRowClick,
		children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: "atm-row-left",
			children: [isBatchMode ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
				className: "atm-row-leading",
				onClick: handleCheckboxClick,
				children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Checkbox, {
					size: "medium",
					className: "atm-row-checkbox",
					checked: isSelected,
					onChange: handleCheckboxChange,
					onClick: (event) => event.stopPropagation()
				})
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
				className: "atm-row-content",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("button", {
					type: "button",
					className: "atm-row-main automation-workspace__name-button",
					onClick: (event) => {
						event.stopPropagation();
						if (isBatchMode) {
							onToggleSelect(item.id);
							return;
						}
						onEdit(item.id);
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
						className: "atm-row-name",
						children: item.name
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
					className: "atm-row-meta",
					children: [item.cwd ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
						className: "atm-row-workspace",
						title: item.cwd,
						children: formatAutomationCwdLabel(item.cwd, t)
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
						className: "atm-row-schedule",
						title: scheduleDescription || item.prompt,
						children: scheduleDescription || item.prompt
					})]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: "atm-row-right",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
				className: "atm-row-right-text",
				children: renderAutomationRowStatus(item, latestRecord, t)
			}), !isBatchMode ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
				className: "atm-row-hover-actions",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Tooltip, {
					content: t("automation.modal.test"),
					placement: "top",
					children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Button, {
						type: "button",
						variant: "ghost",
						iconOnly: true,
						className: "atm-row-action-btn atm-row-action-btn--play",
						"aria-label": t("automation.modal.test"),
						onClick: (event) => {
							event.stopPropagation();
							onTrigger(item.id).then(() => void 0);
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(RunPlayIcon, {
							width: 16,
							height: 16
						})
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
					onClick: (event) => event.stopPropagation(),
					children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Dropdown, {
						triggerMode: "click",
						placement: "bottom-end",
						portalRoot: "body",
						open: menuOpen,
						onOpenChange: setMenuOpen,
						trigger: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Button, {
							type: "button",
							variant: "ghost",
							iconOnly: true,
							className: "atm-row-action-btn",
							"aria-label": t("common.more"),
							title: t("common.more"),
							children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(MoreDotsIcon, {})
						}),
						items: [{
							key: "toggle",
							icon: isActive ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(CirclePauseIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ResumeCircleIcon, {}),
							label: isActive ? t("automation.modal.pause") : t("automation.modal.resume")
						}, {
							key: "delete",
							icon: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(DeleteIcon, {}),
							label: t("common.delete"),
							danger: true
						}],
						onSelect: (key) => {
							if (key === "toggle") onToggleStatus(item.id, isActive ? "PAUSED" : "ACTIVE").then(() => void 0);
							else if (key === "delete") onDelete(item.id).then(() => void 0);
						}
					})
				})]
			}) : null]
		})]
	});
}
function renderAutomationRowStatus(item, latestRecord, t) {
	if (latestRecord?.status === "queued") return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
		className: "atm-row-paused-label atm-row-display-status queued",
		children: t("automation.row.queued")
	});
	if (latestRecord?.status === "running") return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
		className: "atm-row-paused-label atm-row-display-status running",
		children: t("automation.filter.running")
	});
	if (item.status !== "ACTIVE") return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
		className: "atm-row-paused-label",
		children: t("automation.row.paused")
	});
	if (item.nextRunAt) return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
		className: "atm-row-next",
		children: t("automation.row.startsIn", { time: formatRelativeTime(item.nextRunAt, t) })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
		className: "atm-row-paused-label",
		children: t("automation.row.noUpcomingRun")
	});
}
/** Run-record tab restored as a separate legacy tab instead of a bottom section in the task list. */
function RecordsTab({ records, loading, loadingMore, hasMore, onLoadMore, automationNameById, keyword, filter, onOpenRecord, onArchiveRecord, onUnarchiveRecord, onDeleteRecord }) {
	const t = useTranslation();
	const [collapsedGroups, setCollapsedGroups] = (0, import_react$3.useState)(/* @__PURE__ */ new Set());
	const visibleRecords = (0, import_react$3.useMemo)(() => records.filter((record) => record.status !== "queued"), [records]);
	const groups = (0, import_react$3.useMemo)(() => groupRecordsByDate(visibleRecords.filter((record) => !record.archived), t), [visibleRecords, t]);
	const archivedRecords = (0, import_react$3.useMemo)(() => visibleRecords.filter((record) => record.archived), [visibleRecords]);
	const archivedLabel = t("automation.filter.archived");
	const listRef = (0, import_react$3.useRef)(null);
	const archivedGroupRef = (0, import_react$3.useRef)(null);
	const [pendingScrollToArchived, setPendingScrollToArchived] = (0, import_react$3.useState)(false);
	const suppressLoadMoreRef = (0, import_react$3.useRef)(false);
	const archivedCount = archivedRecords.length;
	(0, import_react$3.useEffect)(() => {
		if (!pendingScrollToArchived || archivedCount === 0) return;
		if (!archivedGroupRef.current) return;
		const outer = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				suppressLoadMoreRef.current = true;
				archivedGroupRef.current?.scrollIntoView({
					behavior: "smooth",
					block: "nearest"
				});
				const el = listRef.current;
				const release = () => {
					suppressLoadMoreRef.current = false;
					el?.removeEventListener("scrollend", release);
				};
				el?.addEventListener("scrollend", release, { once: true });
				window.setTimeout(release, 800);
			});
		});
		setPendingScrollToArchived(false);
		return () => cancelAnimationFrame(outer);
	}, [pendingScrollToArchived, archivedCount]);
	const handleArchiveRecord = (0, import_react$3.useCallback)(async (recordId) => {
		const ok = await onArchiveRecord(recordId);
		if (ok) {
			setCollapsedGroups((prev) => {
				if (!prev.has(archivedLabel)) return prev;
				const next = new Set(prev);
				next.delete(archivedLabel);
				return next;
			});
			setPendingScrollToArchived(true);
		}
		return ok;
	}, [onArchiveRecord, archivedLabel]);
	const handleScroll = (0, import_react$3.useCallback)((event) => {
		if (suppressLoadMoreRef.current || !hasMore || loadingMore) return;
		const el = event.currentTarget;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) onLoadMore();
	}, [
		hasMore,
		loadingMore,
		onLoadMore
	]);
	if (loading && records.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
		className: "atm-empty-state",
		children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: "atm-empty-state-hero",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "atm-empty-state-icon",
				children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Loading, { size: "small" })
			}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "atm-empty-state-text",
				children: t("common.loading")
			})]
		})
	});
	if (visibleRecords.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
		className: "atm-empty-state",
		children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: "atm-empty-state-hero",
			children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "atm-empty-state-icon",
				children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AutomationEmptyRecordsIcon, {
					width: 48,
					height: 48
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
				className: "atm-empty-state-text",
				children: keyword || filter !== "all" ? t("automation.empty.noFilteredRecords") : t("automation.empty.noRecords")
			})]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
		ref: listRef,
		className: "atm-records-list",
		onScroll: handleScroll,
		children: [
			groups.map((group) => {
				const isCollapsed = collapsedGroups.has(group.label);
				return /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
					className: "atm-records-group",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("button", {
						type: "button",
						className: "atm-records-group-label",
						onClick: () => setCollapsedGroups((prev) => toggleSetValue(prev, group.label)),
						children: [group.label, /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ChevronDownIcon, {
							className: `atm-records-group-chevron${isCollapsed ? " atm-records-group-chevron--collapsed" : ""}`,
							size: "lg"
						})]
					}), !isCollapsed ? group.items.map((record) => /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(RecordRow, {
						record,
						automationName: automationNameById.get(record.automationId) || record.automationId,
						onOpenRecord,
						onArchiveRecord: handleArchiveRecord,
						onUnarchiveRecord,
						onDeleteRecord
					}, record.id)) : null]
				}, group.label);
			}),
			archivedRecords.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
				ref: archivedGroupRef,
				className: "atm-records-group atm-records-group--archived",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("button", {
					type: "button",
					className: "atm-records-group-label",
					onClick: () => setCollapsedGroups((prev) => toggleSetValue(prev, archivedLabel)),
					children: [archivedLabel, /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ChevronDownIcon, {
						className: `atm-records-group-chevron${collapsedGroups.has(archivedLabel) ? " atm-records-group-chevron--collapsed" : ""}`,
						size: "lg"
					})]
				}), !collapsedGroups.has(archivedLabel) ? archivedRecords.map((record) => /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(RecordRow, {
					record,
					automationName: automationNameById.get(record.automationId) || record.automationId,
					onOpenRecord,
					onArchiveRecord,
					onUnarchiveRecord,
					onDeleteRecord
				}, record.id)) : null]
			}) : null,
			loadingMore ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
				className: "atm-records-load-more",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Loading, { size: "small" }), t("common.loading")]
			}) : null
		]
	});
}
function RecordRow({ record, automationName, onOpenRecord, onArchiveRecord, onUnarchiveRecord, onDeleteRecord }) {
	const t = useTranslation();
	const isPending = record.status === "queued" || record.status === "running";
	const canArchive = !record.archived && !isPending;
	const canUnarchive = record.archived && !isPending;
	const canDelete = !isPending;
	const statusLabel = getAutomationHistoryStatusLabel(record, t);
	const recordSummary = getRecordSummary(record, t);
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
		className: `atm-row automation-workspace__history-row ${record.archived ? "atm-archived" : ""}`,
		onClick: () => onOpenRecord(record),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
				className: "atm-row-name",
				children: automationName
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
				className: "atm-row-result-label",
				title: recordSummary,
				children: statusLabel
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("span", {
				className: "atm-row-right-text",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
					className: "atm-row-time",
					children: formatRecordTime(record)
				}), record.archived ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ArchiveIcon, {
					size: "sm",
					color: "var(--wb-color-text-disabled)"
				}) : /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AutomationHistoryStatusIcon, { statusClass: getAutomationHistoryStatusClass(record) })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("span", {
				className: "atm-row-record-actions",
				children: [
					canArchive ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Tooltip, {
						content: t("automation.action.archive"),
						placement: "top",
						children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Button, {
							type: "button",
							variant: "ghost",
							iconOnly: true,
							className: "atm-row-action-btn",
							"aria-label": t("automation.action.archive"),
							onClick: (event) => {
								event.stopPropagation();
								onArchiveRecord(record.id).then(() => void 0);
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ArchiveIcon, {})
						})
					}) : null,
					canUnarchive ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Tooltip, {
						content: t("automation.action.unarchive"),
						placement: "top",
						children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Button, {
							type: "button",
							variant: "ghost",
							iconOnly: true,
							className: "atm-row-action-btn",
							"aria-label": t("automation.action.unarchive"),
							onClick: (event) => {
								event.stopPropagation();
								onUnarchiveRecord(record.id).then(() => void 0);
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(UnarchiveIcon, {})
						})
					}) : null,
					canDelete ? /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Tooltip, {
						content: t("common.delete"),
						placement: "top",
						children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Button, {
							type: "button",
							variant: "ghost",
							iconOnly: true,
							className: "atm-row-action-btn",
							"aria-label": t("common.delete"),
							onClick: (event) => {
								event.stopPropagation();
								onDeleteRecord(record.id).then(() => void 0);
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(DeleteIcon, {})
						})
					}) : null
				]
			})
		]
	});
}
function getRecordSummary(record, t) {
	if (record.status === "queued") return t("automation.row.queued");
	if (record.status === "running") return t("automation.row.inProgress");
	return record.summary || record.error || t("automation.empty.noRecords");
}
function groupRecordsByDate(records, t) {
	const groupMap = /* @__PURE__ */ new Map();
	const now = /* @__PURE__ */ new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = /* @__PURE__ */ new Date(today.getTime() - 864e5);
	for (const record of records) {
		const time = record.finishedAt || record.startedAt;
		const date = new Date(time);
		const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		let label;
		if (dateDay.getTime() === today.getTime()) label = t("automation.dateGroup.today");
		else if (dateDay.getTime() === yesterday.getTime()) label = t("automation.dateGroup.yesterday");
		else label = `${date.getMonth() + 1}/${date.getDate()}`;
		(groupMap.get(label) ?? groupMap.set(label, []).get(label)).push(record);
	}
	return Array.from(groupMap, ([label, items]) => ({
		label,
		items
	}));
}
function toggleSetValue(values, value) {
	const next = new Set(values);
	if (next.has(value)) next.delete(value);
	else next.add(value);
	return next;
}
function formatRecordTime(record) {
	const value = record.finishedAt || record.startedAt;
	if (!value) return "";
	const date = new Date(value);
	const time = date.toLocaleTimeString("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	});
	if (record.archived) return `${date.toLocaleDateString([], {
		month: "2-digit",
		day: "2-digit"
	})} ${time}`;
	return time;
}
var import_react$3, import_jsx_runtime$1;
var init_automation_workspace_list = __esmMin((() => {
	init_src();
	import_react$3 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_file_path();
	init_automation_history_status_icon();
	init_automation_template_grid();
	init_automation_schedule_display();
	init_automation_task_groups();
	init_history_detail_utils();
	import_jsx_runtime$1 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/use-automation-delete-confirm.ts
function useAutomationDeleteConfirm({ items, deleteAutomation, archiveRecord, deleteRecord, onBatchDeleted }) {
	const t = useTranslation();
	return {
		confirmDeleteAutomation: (0, import_react$2.useCallback)((id) => {
			const name = items.find((item) => item.id === id)?.name || "";
			return new Promise((resolve) => {
				Modal.confirm({
					title: t("automation.delete.title", { name }),
					content: t("automation.delete.description"),
					okText: t("automation.delete.confirm"),
					cancelText: t("common.cancel"),
					okType: "danger",
					onCancel: () => resolve(false),
					onOk: async () => {
						const ok = await deleteAutomation(id);
						resolve(ok);
						return ok ? void 0 : false;
					}
				});
			});
		}, [
			deleteAutomation,
			items,
			t
		]),
		confirmArchiveRecord: (0, import_react$2.useCallback)((id) => new Promise((resolve) => {
			Modal.confirm({
				title: t("automation.archive.confirmTitle"),
				content: t("automation.archive.confirmDescription"),
				okText: t("automation.action.archive"),
				cancelText: t("common.cancel"),
				onCancel: () => resolve(false),
				onOk: async () => {
					const ok = await archiveRecord(id);
					resolve(ok);
					return ok ? void 0 : false;
				}
			});
		}), [archiveRecord, t]),
		confirmDeleteRecord: (0, import_react$2.useCallback)((id) => new Promise((resolve) => {
			Modal.confirm({
				title: t("automation.record.delete.title"),
				content: t("automation.record.delete.description"),
				okText: t("common.delete"),
				cancelText: t("common.cancel"),
				okType: "danger",
				onCancel: () => resolve(false),
				onOk: async () => {
					const ok = await deleteRecord(id);
					resolve(ok);
					return ok ? void 0 : false;
				}
			});
		}), [deleteRecord, t]),
		confirmBatchDelete: (0, import_react$2.useCallback)((ids) => {
			const targetIds = [...ids];
			if (targetIds.length === 0) return;
			Modal.confirm({
				title: t("automation.batch.deleteConfirm.title", { count: targetIds.length }),
				content: t("automation.batch.deleteConfirm.description"),
				okText: t("common.delete"),
				cancelText: t("common.cancel"),
				okType: "danger",
				onOk: async () => {
					let allDeleted = true;
					for (const id of targetIds) {
						const ok = await deleteAutomation(id);
						allDeleted = allDeleted && ok;
					}
					if (allDeleted) onBatchDeleted();
					return allDeleted ? void 0 : false;
				}
			});
		}, [
			deleteAutomation,
			onBatchDeleted,
			t
		])
	};
}
var import_react$2;
var init_use_automation_delete_confirm = __esmMin((() => {
	init_src();
	import_react$2 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/use-automation-editor-resources.ts
function useAutomationEditorResources(runtime) {
	const canSelectSkills = runtime?.canSelectSkills() ?? false;
	return (0, import_react$1.useMemo)(() => ({ canSelectSkills }), [canSelectSkills]);
}
var import_react$1;
var init_use_automation_editor_resources = __esmMin((() => {
	import_react$1 = /* @__PURE__ */ __toESM(require_react());
}));
//#endregion
//#region ../../packages/agent-ui/src/modules/automation/pages/workspace/index.tsx
/** 安全解析 I18nText：取指定 locale，fallback zh / en / 空串 */
function resolveI18nText(value, locale) {
	if (typeof value === "string") return value;
	if (value && typeof value === "object") {
		const obj = value;
		return String(obj[locale] || obj.zh || obj.en || "");
	}
	return "";
}
/** 上报专家实际使用事件（缓存优先 + API 兜底），供创建/编辑保存路径复用 */
async function reportExpertActualUseForForm(form, context) {
	if (!form.execution?.expertId) return;
	const expertId = form.execution.expertId;
	const marketplace = form.execution.expertMarketplace;
	const locale = getLocale().startsWith("en") ? "en" : "zh";
	let expertInfo;
	if (marketplace !== "my-experts") expertInfo = getCachedBuiltinExperts(context.account?.enterpriseId ?? "")?.find((e) => e.id === expertId);
	if (expertInfo) context.reportEvent(context.Events.ExpertActualUse, {
		id: expertInfo.id || expertId,
		name: resolveI18nText(expertInfo.name, locale) || expertId,
		expertTitle: resolveI18nText(expertInfo.profession, locale),
		type: expertInfo.categoryId || "",
		expertType: expertInfo.expertType || "",
		source: "builtin",
		version: expertInfo.version || "",
		cost: 0,
		characterCount: form.prompt?.length || 0,
		requestModelId: form.execution?.modelId || ""
	});
	else try {
		const expert = await context.expertApi.getExpert({
			expertId,
			source: marketplace === "my-experts" ? "custom" : "builtin",
			locale
		});
		context.reportEvent(context.Events.ExpertActualUse, {
			id: expert.id || expertId,
			name: resolveI18nText(expert.name, locale) || expertId,
			expertTitle: resolveI18nText(expert.profession, locale),
			type: expert.categoryId || "",
			expertType: expert.expertType || "",
			source: marketplace === "my-experts" ? "my-experts" : "builtin",
			version: expert.version || "",
			cost: 0,
			characterCount: form.prompt?.length || 0,
			requestModelId: form.execution?.modelId || ""
		});
	} catch {
		context.reportEvent(context.Events.ExpertActualUse, {
			id: expertId,
			name: expertId,
			expertTitle: "",
			type: "",
			source: marketplace === "my-experts" ? "my-experts" : "builtin",
			version: "",
			cost: 0,
			characterCount: form.prompt?.length || 0,
			requestModelId: form.execution?.modelId || ""
		});
	}
}
/** Route-safe Automation workspace shell. It wires Automation API data into migrated presentational slices. */
function AutomationWorkspacePage({ editorRuntime, initialEditId, onInitialEditHandled, onOpenConversation, onSummonExpert }) {
	const t = useTranslation();
	const needTrafficLightOffset = useAutomationTrafficLightOffset();
	const [recordFilter, setRecordFilter] = (0, import_react.useState)("all");
	const { viewModel, records: pagedRecords, loading, recordsLoading, recordsLoadingMore, recordsHasMore, loadMoreRecords, error: pageError, keyword, setKeyword, refresh, getAutomation, getRecordDetail, listTemplates } = useAutomationPage(recordFilter);
	const draft = useAutomationDraft();
	const actions = useAutomationActions({ onChanged: refresh });
	const { reportEvent, Events } = useAgentTelemetry();
	const { account } = useAccountService();
	const expertApi = useExpertApi();
	const [templates, setTemplates] = (0, import_react.useState)([]);
	const [selectedRecord, setSelectedRecord] = (0, import_react.useState)();
	const [initialPermissionMode, setInitialPermissionMode] = (0, import_react.useState)();
	const [initialSchedule, setInitialSchedule] = (0, import_react.useState)();
	const [formError, setFormError] = (0, import_react.useState)();
	const [workspaceError, setWorkspaceError] = (0, import_react.useState)();
	const [activeTab, setActiveTab] = (0, import_react.useState)("tasks");
	const [showTemplatePage, setShowTemplatePage] = (0, import_react.useState)(false);
	const [batchMode, setBatchMode] = (0, import_react.useState)(false);
	const [selectedIds, setSelectedIds] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const navigatingAwayRef = (0, import_react.useRef)(false);
	const { canSelectSkills } = useAutomationEditorResources(editorRuntime);
	(0, import_react.useEffect)(() => {
		const payload = automationExpertSummon$.getValue();
		if (!payload) return;
		if (isAutomationPayloadExpired(payload)) {
			automationExpertSummon$.next(null);
			setFormError(t("automation.draftExpired"));
			return;
		}
		const payloadDraft = payload.draft;
		const restoredForm = {
			...payloadDraft,
			...payload.selectedExpert ? { execution: {
				...payloadDraft.execution ?? {},
				expertId: payload.selectedExpert.id,
				expertMarketplace: payload.selectedExpert.marketplace
			} } : {}
		};
		if (payload.mode === "edit" && payload.automationId) getAutomation(payload.automationId).then((automation) => {
			if (!automation) {
				draft.startCreate(restoredForm);
				setInitialSchedule(void 0);
				return;
			}
			draft.startEdit(automation);
			draft.setForm(restoredForm);
			setInitialPermissionMode(automation.execution?.permissionMode ?? DEFAULT_PERMISSION_MODE);
			setInitialSchedule({
				type: automation.schedule.type,
				scheduledAt: automation.schedule.scheduledAt
			});
		}).catch(() => {
			draft.startCreate(restoredForm);
			setInitialSchedule(void 0);
		});
		else {
			draft.startCreate(restoredForm);
			setInitialSchedule(void 0);
		}
		automationExpertSummon$.next(null);
	}, [
		draft,
		getAutomation,
		t
	]);
	(0, import_react.useEffect)(() => () => {
		if (!navigatingAwayRef.current) automationExpertSummon$.next(null);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!initialEditId || automationExpertSummon$.getValue()) return;
		openEdit(initialEditId).finally(() => onInitialEditHandled?.());
	}, [initialEditId, onInitialEditHandled]);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		listTemplates().then((result) => {
			if (!cancelled) setTemplates(result);
		}).catch(() => void 0);
		return () => {
			cancelled = true;
		};
	}, [listTemplates]);
	const templateItems = (0, import_react.useMemo)(() => templatesToCardViewModels(templates).map((template) => ({
		...template,
		Icon: TEMPLATE_ICON_MAP[template.icon],
		content: t(template.descriptionKey)
	})), [t, templates]);
	const records = pagedRecords;
	const runningAutomationIds = (0, import_react.useMemo)(() => new Set(Object.entries(viewModel.recordsByAutomationId).filter(([, records]) => isLatestAutomationRecordPending(records)).map(([automationId]) => automationId)), [viewModel.recordsByAutomationId]);
	const automationNameById = (0, import_react.useMemo)(() => new Map(viewModel.items.map((item) => [item.id, item.name])), [viewModel.items]);
	const editingRecords = (0, import_react.useMemo)(() => draft.editingId ? viewModel.recordsByAutomationId[draft.editingId] ?? [] : [], [draft.editingId, viewModel.recordsByAutomationId]);
	const editingAutomationName = draft.editingId ? automationNameById.get(draft.editingId) : void 0;
	(0, import_react.useEffect)(() => {
		if (!selectedRecord || !isRecordPendingForDetail(selectedRecord)) return;
		let cancelled = false;
		const syncRecordDetail = async () => {
			const detail = await getRecordDetail(selectedRecord.id);
			if (cancelled || !detail) return;
			setSelectedRecord((current) => current?.id === detail.id ? detail : current);
		};
		const unsubscribe = wb.on(AUTOMATION_RECORDS_CHANGED_EVENT, (event) => {
			if (event.recordId && event.recordId !== selectedRecord.id) return;
			syncRecordDetail().catch(() => void 0);
		});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [
		getRecordDetail,
		selectedRecord?.finishedAt,
		selectedRecord?.id,
		selectedRecord?.status
	]);
	const selectableIds = (0, import_react.useMemo)(() => viewModel.items.map((item) => item.id), [viewModel.items]);
	const isTasksEmptyState = activeTab === "tasks" && !showTemplatePage && !keyword && viewModel.items.length === 0;
	function clearActionError() {
		setFormError(void 0);
		setWorkspaceError(void 0);
		actions.clearError();
	}
	function openRecordDetail(record) {
		const title = automationNameById.get(record.automationId) || record.automationId;
		if (shouldOpenRecordConversationDirectly(record) && record.sessionId && onOpenConversation) {
			Promise.resolve(onOpenConversation(record.sessionId, record.cwd, title)).catch(() => void 0);
			return;
		}
		setSelectedRecord(record);
		getRecordDetail(record.id).then((detail) => {
			if (detail) setSelectedRecord((current) => current?.id === record.id ? detail : current);
		}).catch(() => void 0);
	}
	function rejectDeleteIfAutomationRunning(id) {
		if (!runningAutomationIds.has(id)) return false;
		const error = t("batch.disabled.running");
		setWorkspaceError(error);
		if (draft.editingId === id) setFormError(error);
		actions.clearError();
		return true;
	}
	async function deleteAutomationIfIdle(id) {
		if (rejectDeleteIfAutomationRunning(id)) return false;
		return actions.deleteAutomation(id);
	}
	function confirmBatchDeleteIfIdle(ids) {
		const targetIds = [...ids];
		if (targetIds.some((id) => runningAutomationIds.has(id))) {
			setWorkspaceError(t("batch.disabled.running"));
			actions.clearError();
			return;
		}
		confirmBatchDelete(targetIds);
	}
	function closeDraft() {
		draft.clear();
		clearActionError();
	}
	async function openEdit(id) {
		const automation = await getAutomation(id);
		if (!automation) return;
		draft.startEdit(automation);
		setInitialPermissionMode(automation.execution?.permissionMode ?? DEFAULT_PERMISSION_MODE);
		setInitialSchedule({
			type: automation.schedule.type,
			scheduledAt: automation.schedule.scheduledAt
		});
		clearActionError();
	}
	function startCreate(seed) {
		draft.startCreate(seed ?? createDefaultDraft());
		setShowTemplatePage(false);
		setInitialPermissionMode(void 0);
		setInitialSchedule(void 0);
		clearActionError();
	}
	function getSubmitError(form) {
		const errors = [
			form.name.trim() ? void 0 : t("automation.error.nameRequired"),
			form.prompt.trim() ? void 0 : t("automation.error.promptRequired"),
			form.prompt.length > 1e5 ? t("automation.error.promptTooLong", { max: AUTOMATION_PROMPT_MAX_LENGTH }) : void 0
		].filter(Boolean);
		if (form.schedule.type === "once") {
			if (!form.schedule.scheduledAt) errors.push(t("automation.schedule.validation.onceDateRequired"));
			else if (shouldValidateFutureOneTimeSchedule({
				isCreating: draft.mode !== "edit",
				nextScheduledAt: form.schedule.scheduledAt,
				existingScheduledAt: initialSchedule?.scheduledAt,
				existingScheduleType: initialSchedule?.type
			}) && !isFutureScheduledAt(form.schedule.scheduledAt)) errors.push(t("automation.schedule.validation.onceFutureRequired"));
		}
		return errors.join("；") || void 0;
	}
	async function saveDraft() {
		const form = draft.form;
		if (!form) return;
		const submitError = getSubmitError(form);
		if (submitError) {
			setFormError(submitError);
			return;
		}
		clearActionError();
		const expertReportCtx = {
			account,
			expertApi,
			reportEvent,
			Events
		};
		if (draft.mode === "edit" && draft.editingId) {
			if (await actions.update(draft.editingId, formStateToAutomationPatch(form))) {
				await reportExpertActualUseForForm(form, expertReportCtx);
				draft.clear();
			}
			return;
		}
		if (await actions.create(formStateToAutomationDraft(form))) {
			await reportExpertActualUseForForm(form, expertReportCtx);
			reportEvent(Events.AutomatedTaskCreateSuc, {
				name: form.name,
				source: "manually",
				modelId: form.execution?.modelId,
				modelIsThinking: form.execution?.modelThinking,
				expertId: form.execution?.expertId,
				expertMarketplace: form.execution?.expertMarketplace,
				connectorIds: form.execution?.connectorIds?.join(","),
				connectorCount: form.execution?.connectorIds?.length || 0,
				skills: form.execution?.skills?.join(","),
				skillCount: form.execution?.skills?.length || 0,
				scheduleType: form.schedule?.type,
				pushToWeChat: form.execution?.pushToWeChat,
				pushToWecomBot: form.execution?.pushToWecomBot
			});
			draft.clear();
		}
	}
	function showTriggerToast(status) {
		if (status.ok) {
			message.success(t("automation.toast.testTriggered"));
			return;
		}
		message.error(status.error || t("automation.error.test"));
	}
	function rejectTriggerIfAutomationRunning(id) {
		if (!runningAutomationIds.has(id)) return false;
		message.error(t("automation.form.triggerAlreadyRunning"));
		return true;
	}
	async function testDraft() {
		const form = draft.form;
		if (draft.mode !== "edit" || !draft.editingId || !form) return;
		clearActionError();
		if (rejectTriggerIfAutomationRunning(draft.editingId)) return;
		showTriggerToast(await actions.updateAndTrigger(draft.editingId, formStateToAutomationPatch(form)));
	}
	async function triggerAutomation(id) {
		clearActionError();
		if (rejectTriggerIfAutomationRunning(id)) return false;
		const status = await actions.trigger(id);
		showTriggerToast(status);
		return status.ok;
	}
	function saveDraftAndNavigate(source, navigate) {
		if (!draft.form || !navigate) return;
		navigatingAwayRef.current = true;
		automationExpertSummon$.next({
			source,
			draft: { ...draft.form },
			mode: draft.mode,
			automationId: draft.editingId,
			createdAt: Date.now()
		});
		navigate();
	}
	function handleTabChange(tab) {
		setActiveTab(tab);
		setBatchMode(false);
		setSelectedIds(/* @__PURE__ */ new Set());
		clearActionError();
	}
	function handleToggleBatchMode() {
		if (batchMode) setSelectedIds(/* @__PURE__ */ new Set());
		setBatchMode(!batchMode);
	}
	function handleToggleSelect(id) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}
	function handleToggleSelectAll() {
		setSelectedIds((prev) => selectableIds.length > 0 && prev.size === selectableIds.length ? /* @__PURE__ */ new Set() : new Set(selectableIds));
	}
	const { confirmDeleteAutomation, confirmArchiveRecord, confirmDeleteRecord, confirmBatchDelete } = useAutomationDeleteConfirm({
		items: viewModel.items,
		deleteAutomation: deleteAutomationIfIdle,
		archiveRecord: actions.archiveRecord,
		deleteRecord: actions.deleteRecord,
		onBatchDeleted: () => {
			setSelectedIds(/* @__PURE__ */ new Set());
			setBatchMode(false);
		}
	});
	const permissionConfirm = useAutomationPermissionConfirm({
		currentMode: draft.form?.execution?.permissionMode ?? DEFAULT_PERMISSION_MODE,
		initialMode: initialPermissionMode,
		onConfirmedSubmit: saveDraft,
		onFallbackToDefault: () => draft.form && draft.setForm({
			...draft.form,
			execution: {
				...draft.form.execution,
				permissionMode: "default"
			}
		})
	});
	function handleFormChange(nextForm) {
		clearActionError();
		draft.setForm(nextForm);
	}
	function requestSaveDraft() {
		const form = draft.form;
		if (!form) return;
		const submitError = getSubmitError(form);
		if (submitError) {
			setFormError(submitError);
			return;
		}
		clearActionError();
		permissionConfirm.requestSubmit();
	}
	const editorSaving = actions.unscopedBusy || Boolean(draft.editingId && actions.busyAutomationIds.has(draft.editingId));
	const workspaceActionError = workspaceError || actions.error;
	const editorError = formError || workspaceActionError;
	const listError = pageError || workspaceActionError;
	const editorSurface = draft.form ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationEditorSurface, {
		mode: draft.mode,
		form: draft.form,
		saving: editorSaving,
		records: editingRecords,
		automationName: editingAutomationName,
		error: editorError,
		canSelectSkills,
		showConfirmDialog: permissionConfirm.showConfirmDialog,
		onConfirmPermission: permissionConfirm.handleConfirm,
		onCancelPermission: permissionConfirm.handleCancel,
		onFallbackPermission: permissionConfirm.handleFallbackToDefault,
		onOpenRecord: openRecordDetail,
		onArchiveRecord: confirmArchiveRecord,
		onUnarchiveRecord: actions.unarchiveRecord,
		onDeleteRecord: confirmDeleteRecord,
		onChange: handleFormChange,
		onCancel: closeDraft,
		onSave: requestSaveDraft,
		onTest: () => permissionConfirm.requestAction(testDraft),
		onDelete: draft.mode === "edit" ? () => {
			if (!draft.editingId) return;
			deleteAutomationIfIdle(draft.editingId).then((ok) => ok && closeDraft());
		} : void 0,
		onDismissError: clearActionError,
		onSummonExpert: () => saveDraftAndNavigate("expert", onSummonExpert)
	}) : null;
	if (draft.mode === "edit" && editorSurface) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "automation-workspace code-buddy-automation",
		"data-testid": "automation-workspace",
		children: [editorSurface, selectedRecord ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationHistoryDetailDialog, {
			record: selectedRecord,
			automationName: automationNameById.get(selectedRecord.automationId),
			onClose: () => setSelectedRecord(void 0),
			onOpenConversation
		}) : null]
	});
	if (showTemplatePage) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "automation-workspace code-buddy-automation",
		"data-testid": "automation-workspace",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `atm-toolbar atm-toolbar--breadcrumb${needTrafficLightOffset ? " atm-toolbar--traffic-light-offset" : ""}`,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "atm-toolbar-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationSidebarActions, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "ghost",
					size: "small",
					className: "atm-template-back-btn",
					leftIcon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackChevronIcon, { size: "lg" }),
					onClick: () => setShowTemplatePage(false),
					children: t("automation.toolbar.addFromTemplate")
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "atm-template-page",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationTemplateGrid, {
				templates: templateItems,
				variant: "compact",
				onSelectTemplate: (template) => startCreate(template.draft)
			})
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "automation-workspace code-buddy-automation",
		"data-testid": "automation-workspace",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationToolbar, {
				activeTab,
				keyword,
				recordFilter,
				batchMode,
				selectedCount: selectedIds.size,
				selectableCount: selectableIds.length,
				showTemplateEntryButton: templateItems.length > 0,
				hideRightActions: isTasksEmptyState,
				onTabChange: handleTabChange,
				onKeywordChange: setKeyword,
				onRecordFilterChange: setRecordFilter,
				onToggleBatchMode: handleToggleBatchMode,
				onToggleSelectAll: handleToggleSelectAll,
				onBatchDelete: () => confirmBatchDeleteIfIdle(selectedIds),
				onOpenTemplates: () => setShowTemplatePage(true),
				onCreate: () => startCreate()
			}),
			listError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "automation-workspace__error",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: listError }), workspaceActionError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "automation-workspace__error-close",
					onClick: clearActionError,
					"aria-label": t("common.close"),
					children: "×"
				}) : null]
			}) : null,
			loading && viewModel.items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "atm-loading",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Loading, { size: "small" }), t("common.loading")]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "automation-workspace__content",
				children: activeTab === "tasks" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskTab, {
					items: viewModel.items,
					recordsByAutomationId: viewModel.recordsByAutomationId,
					selectedIds,
					batchMode,
					templateItems,
					showTemplateGrid: !keyword,
					onOpenRecord: openRecordDetail,
					onEdit: (id) => {
						openEdit(id);
					},
					onTrigger: triggerAutomation,
					onToggleStatus: (id, nextStatus) => actions.update(id, { status: nextStatus }),
					onDelete: confirmDeleteAutomation,
					onToggleSelect: handleToggleSelect,
					onCreate: () => startCreate(),
					onSelectTemplate: (template) => startCreate(template.draft)
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecordsTab, {
					records,
					loading: recordsLoading,
					loadingMore: recordsLoadingMore,
					hasMore: recordsHasMore,
					onLoadMore: loadMoreRecords,
					automationNameById,
					keyword,
					filter: recordFilter,
					onOpenRecord: openRecordDetail,
					onArchiveRecord: confirmArchiveRecord,
					onUnarchiveRecord: actions.unarchiveRecord,
					onDeleteRecord: confirmDeleteRecord
				})
			}),
			editorSurface,
			selectedRecord ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationHistoryDetailDialog, {
				record: selectedRecord,
				automationName: automationNameById.get(selectedRecord.automationId),
				onClose: () => setSelectedRecord(void 0),
				onOpenConversation
			}) : null
		]
	});
}
function isRecordPendingForDetail(record) {
	return (record.status === "running" || record.status === "queued") && !record.finishedAt;
}
function shouldOpenRecordConversationDirectly(record) {
	return record.status === "success" && record.resultState !== "partial_delivered" && record.resultState !== "failed" && (record.runKind ?? record.kind) !== "interrupted";
}
function isLatestAutomationRecordPending(records) {
	if (!records?.length) return false;
	const latest = records.reduce((current, record) => (record.startedAt || 0) > (current.startedAt || 0) ? record : current);
	return !latest.finishedAt && (latest.status === "queued" || latest.status === "running");
}
function createDefaultDraft() {
	return {
		name: "",
		prompt: "",
		status: "ACTIVE",
		schedule: {
			type: "once",
			scheduledAt: getDefaultOnceScheduledAtIso()
		},
		execution: { permissionMode: DEFAULT_PERMISSION_MODE }
	};
}
var import_react, import_jsx_runtime, DEFAULT_PERMISSION_MODE, AUTOMATION_RECORDS_CHANGED_EVENT, TEMPLATE_ICON_MAP;
var init_workspace = __esmMin((() => {
	init_workspace$1();
	init_src();
	import_react = /* @__PURE__ */ __toESM(require_react());
	init_app_core();
	init_task_starter_store();
	init_auth_context();
	init_i18n();
	init_useI18n();
	init_telemetry();
	init_expert();
	init_automation_history_detail_dialog();
	init_automation_template_grid();
	init_use_automation_actions();
	init_use_automation_draft();
	init_use_automation_page();
	init_use_automation_permission_confirm();
	init_automation_form_mapper();
	init_automation_template_mapper();
	init_schedule_validation();
	init_automation_editor_form();
	init_automation_editor_surface();
	init_automation_sidebar_actions();
	init_automation_toolbar();
	init_automation_workspace_list();
	init_use_automation_delete_confirm();
	init_use_automation_editor_resources();
	import_jsx_runtime = require_jsx_runtime();
	DEFAULT_PERMISSION_MODE = "fullAccess";
	AUTOMATION_RECORDS_CHANGED_EVENT = "automations.records.changed";
	TEMPLATE_ICON_MAP = {
		news: TemplateNewsIcon,
		languages: TemplateLanguagesIcon,
		moon: TemplateMoonIcon,
		"weekly-report": TemplateWeeklyReportIcon,
		film: TemplateFilmIcon,
		calendar: TemplateCalendarIcon,
		lightbulb: TemplateLightbulbIcon,
		image: TemplateImageIcon,
		"alarm-clock": TemplateAlarmClockIcon,
		hospital: TemplateHospitalIcon,
		"messages-square": TemplateMessagesSquareIcon,
		"list-todo": TemplateListTodoIcon
	};
}));
//#endregion
__esmMin((() => {
	init_automation_edit_mode_view();
	init_automation_history_detail_dialog();
	init_automation_history_status_icon();
	init_automation_permission_confirm_dialog();
	init_automation_permission_picker();
	init_automation_template_grid();
	init_connector_selector();
	init_expert_selector();
	init_workspace();
}))();
export { AutomationWorkspacePage };
