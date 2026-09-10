import { n as __esmMin } from "./rolldown-runtime-D5a2oYpF.js";
import { $ as boolean, Q as array, X as _enum, Y as init_v4, at as record, ct as unknown, et as intersection, it as object, lt as ZodError, mt as NEVER, ot as string, rt as number, st as union, tt as literal } from "./ui-ardot-DkNyoQ5N.js";
//#region ../../node_modules/.pnpm/@agentclientprotocol+sdk@0.25.0_zod@4.3.6/node_modules/@agentclientprotocol/sdk/dist/schema/index.js
var AGENT_METHODS, CLIENT_METHODS, PROTOCOL_VERSION;
var init_schema = __esmMin((() => {
	AGENT_METHODS = {
		authenticate: "authenticate",
		document_did_change: "document/didChange",
		document_did_close: "document/didClose",
		document_did_focus: "document/didFocus",
		document_did_open: "document/didOpen",
		document_did_save: "document/didSave",
		initialize: "initialize",
		logout: "logout",
		mcp_message: "mcp/message",
		nes_accept: "nes/accept",
		nes_close: "nes/close",
		nes_reject: "nes/reject",
		nes_start: "nes/start",
		nes_suggest: "nes/suggest",
		providers_disable: "providers/disable",
		providers_list: "providers/list",
		providers_set: "providers/set",
		session_cancel: "session/cancel",
		session_close: "session/close",
		session_delete: "session/delete",
		session_fork: "session/fork",
		session_list: "session/list",
		session_load: "session/load",
		session_new: "session/new",
		session_prompt: "session/prompt",
		session_resume: "session/resume",
		session_set_config_option: "session/set_config_option",
		session_set_mode: "session/set_mode"
	};
	CLIENT_METHODS = {
		elicitation_complete: "elicitation/complete",
		elicitation_create: "elicitation/create",
		fs_read_text_file: "fs/read_text_file",
		fs_write_text_file: "fs/write_text_file",
		mcp_connect: "mcp/connect",
		mcp_disconnect: "mcp/disconnect",
		mcp_message: "mcp/message",
		session_request_permission: "session/request_permission",
		session_update: "session/update",
		terminal_create: "terminal/create",
		terminal_kill: "terminal/kill",
		terminal_output: "terminal/output",
		terminal_release: "terminal/release",
		terminal_wait_for_exit: "terminal/wait_for_exit"
	};
	PROTOCOL_VERSION = 1;
}));
//#endregion
//#region ../../node_modules/.pnpm/@agentclientprotocol+sdk@0.25.0_zod@4.3.6/node_modules/@agentclientprotocol/sdk/dist/schema-deserialize.js
function defaultOnError(schema, fallback) {
	return schema.catch(fallback);
}
function requiredDefaultOnError(schema, fallback) {
	const schemaWithCatch = schema.catch(fallback);
	return unknown().transform((value, context) => {
		if (value !== void 0) return schemaWithCatch.parse(value);
		context.addIssue({
			code: "custom",
			message: "Required value is missing"
		});
		return NEVER;
	});
}
function vecSkipError(itemSchema) {
	return array(itemSchema.catch(skippedItem)).transform((items) => items.filter((item) => item !== skippedItem));
}
var skippedItem;
var init_schema_deserialize = __esmMin((() => {
	init_v4();
	skippedItem = Symbol("skippedItem");
})), zAuthCapabilities, zAuthEnvVar, zAuthMethodAgent, zAuthMethodEnvVar, zAuthMethodTerminal, zAuthMethod, zAuthenticateRequest, zAuthenticateResponse, zBlobResourceContents, zBooleanPropertySchema, zCloseNesResponse, zCloseSessionResponse, zCost, zCreateTerminalResponse, zDeleteSessionResponse, zDiff, zDisableProviderRequest, zDisableProviderResponse, zDisconnectMcpResponse, zElicitationContentValue, zElicitationAcceptAction, zCreateElicitationResponse, zElicitationFormCapabilities, zElicitationId, zCompleteElicitationNotification, zElicitationSchemaType, zElicitationStringType, zElicitationUrlCapabilities, zElicitationCapabilities, zEnumOption, zEnvVariable, zErrorCode, zError, zExtNotification, zExtRequest, zExtResponse, zFileSystemCapabilities, zHttpHeader, zImplementation, zIntegerPropertySchema, zKillTerminalResponse, zListProvidersRequest, zListSessionsRequest, zLlmProtocol, zLogoutCapabilities, zAgentAuthCapabilities, zLogoutRequest, zLogoutResponse, zMcpCapabilities, zMcpConnectionId, zConnectMcpResponse, zDisconnectMcpRequest, zMcpServerAcpId, zConnectMcpRequest, zMcpServerAcp, zMcpServerHttp, zMcpServerSse, zMcpServerStdio, zMcpServer, zMessageId, zMessageMcpNotification, zMessageMcpRequest, zMessageMcpResponse, zNesDiagnosticSeverity, zNesDiagnosticsCapabilities, zNesDocumentDidCloseCapabilities, zNesDocumentDidFocusCapabilities, zNesDocumentDidOpenCapabilities, zNesDocumentDidSaveCapabilities, zNesEditHistoryCapabilities, zNesEditHistoryEntry, zNesExcerpt, zNesJumpCapabilities, zNesOpenFilesCapabilities, zNesRecentFile, zNesRecentFilesCapabilities, zNesRejectReason, zNesRelatedSnippet, zNesRelatedSnippetsCapabilities, zNesRenameCapabilities, zNesRepository, zNesSearchAndReplaceCapabilities, zClientNesCapabilities, zNesSearchAndReplaceSuggestion, zNesTriggerKind, zNesUserActionsCapabilities, zNesContextCapabilities, zNewSessionRequest, zNumberPropertySchema, zPermissionOptionId, zPermissionOptionKind, zPermissionOption, zPlanCapabilities, zPlanEntryPriority, zPlanEntryStatus, zPlanEntry, zPlan, zPlanId, zPlanFile, zPlanItems, zPlanMarkdown, zPlanRemoved, zPlanUpdateContent, zPlanUpdate, zPosition, zNesJumpSuggestion, zNesRenameSuggestion, zNesUserAction, zPositionEncodingKind, zClientCapabilities, zPromptCapabilities, zProtocolVersion, zInitializeRequest, zProviderCurrentConfig, zProviderInfo, zListProvidersResponse, zProvidersCapabilities, zRange, zNesDiagnostic, zNesOpenFile, zNesSuggestContext, zNesTextEdit, zNesEditSuggestion, zNesSuggestion, zReadTextFileResponse, zReleaseTerminalResponse, zRequestId, zElicitationRequestScope, zRole, zAnnotations, zAudioContent, zImageContent, zResourceLink, zSelectedPermissionOutcome, zRequestPermissionOutcome, zRequestPermissionResponse, zSessionAdditionalDirectoriesCapabilities, zSessionCloseCapabilities, zSessionConfigBoolean, zSessionConfigGroupId, zSessionConfigId, zSessionConfigOptionCategory, zSessionConfigValueId, zSessionConfigSelectOption, zSessionConfigSelectGroup, zSessionConfigSelectOptions, zSessionConfigSelect, zSessionConfigOption, zConfigOptionUpdate, zSessionDeleteCapabilities, zSessionForkCapabilities, zSessionId, zAcceptNesNotification, zCancelNotification, zCloseNesRequest, zCloseSessionRequest, zCreateTerminalRequest, zDeleteSessionRequest, zDidCloseDocumentNotification, zDidFocusDocumentNotification, zDidOpenDocumentNotification, zDidSaveDocumentNotification, zForkSessionRequest, zKillTerminalRequest, zLoadSessionRequest, zReadTextFileRequest, zRejectNesNotification, zReleaseTerminalRequest, zResumeSessionRequest, zSessionInfo, zListSessionsResponse, zSessionInfoUpdate, zSessionListCapabilities, zSessionModeId, zCurrentModeUpdate, zSessionMode, zSessionModeState, zForkSessionResponse, zLoadSessionResponse, zNewSessionResponse, zResumeSessionResponse, zSessionResumeCapabilities, zSessionCapabilities, zSetProviderRequest, zSetProviderResponse, zSetSessionConfigOptionRequest, zSetSessionConfigOptionResponse, zSetSessionModeRequest, zSetSessionModeResponse, zStartNesResponse, zStopReason, zStringFormat, zStringPropertySchema, zSuggestNesRequest, zSuggestNesResponse, zTerminal, zTerminalExitStatus, zTerminalOutputRequest, zTerminalOutputResponse, zTextContent, zTextDocumentContentChangeEvent, zDidChangeDocumentNotification, zTextDocumentSyncKind, zNesDocumentDidChangeCapabilities, zNesDocumentEventCapabilities, zNesEventCapabilities, zNesCapabilities, zAgentCapabilities, zInitializeResponse, zTextResourceContents, zEmbeddedResourceResource, zEmbeddedResource, zContentBlock, zContent, zContentChunk, zPromptRequest, zTitledMultiSelectItems, zToolCallContent, zToolCallId, zElicitationSessionScope, zElicitationUrlMode, zToolCallLocation, zToolCallStatus, zToolKind, zToolCall, zToolCallUpdate, zRequestPermissionRequest, zUnstructuredCommandInput, zAvailableCommandInput, zAvailableCommand, zAvailableCommandsUpdate, zUntitledMultiSelectItems, zMultiSelectItems, zMultiSelectPropertySchema, zElicitationPropertySchema, zElicitationSchema, zElicitationFormMode, zCreateElicitationRequest, zUsage, zPromptResponse, zUsageUpdate, zSessionUpdate, zSessionNotification, zWaitForTerminalExitRequest, zWaitForTerminalExitResponse, zWorkspaceFolder, zStartNesRequest, zWriteTextFileRequest, zWriteTextFileResponse;
var init_zod_gen = __esmMin((() => {
	init_schema_deserialize();
	init_v4();
	zAuthCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		terminal: boolean().optional().default(false)
	});
	zAuthEnvVar = object({
		_meta: record(string(), unknown()).nullish(),
		label: string().nullish(),
		name: string(),
		optional: boolean().optional().default(false),
		secret: boolean().optional().default(true)
	});
	zAuthMethodAgent = object({
		_meta: record(string(), unknown()).nullish(),
		description: string().nullish(),
		id: string(),
		name: string()
	});
	zAuthMethodEnvVar = object({
		_meta: record(string(), unknown()).nullish(),
		description: string().nullish(),
		id: string(),
		link: string().nullish(),
		name: string(),
		vars: array(zAuthEnvVar)
	});
	zAuthMethodTerminal = object({
		_meta: record(string(), unknown()).nullish(),
		args: array(string()).optional(),
		description: string().nullish(),
		env: record(string(), string()).optional(),
		id: string(),
		name: string()
	});
	zAuthMethod = union([
		zAuthMethodEnvVar.and(object({ type: literal("env_var") })),
		zAuthMethodTerminal.and(object({ type: literal("terminal") })),
		zAuthMethodAgent
	]);
	zAuthenticateRequest = object({
		_meta: record(string(), unknown()).nullish(),
		methodId: string()
	});
	zAuthenticateResponse = object({ _meta: record(string(), unknown()).nullish() });
	zBlobResourceContents = object({
		_meta: record(string(), unknown()).nullish(),
		blob: string(),
		mimeType: string().nullish(),
		uri: string()
	});
	zBooleanPropertySchema = object({
		default: boolean().nullish(),
		description: string().nullish(),
		title: string().nullish()
	});
	zCloseNesResponse = object({ _meta: record(string(), unknown()).nullish() });
	zCloseSessionResponse = object({ _meta: record(string(), unknown()).nullish() });
	zCost = object({
		amount: number(),
		currency: string()
	});
	zCreateTerminalResponse = object({
		_meta: record(string(), unknown()).nullish(),
		terminalId: string()
	});
	zDeleteSessionResponse = object({ _meta: record(string(), unknown()).nullish() });
	zDiff = object({
		_meta: record(string(), unknown()).nullish(),
		newText: string(),
		oldText: string().nullish(),
		path: string()
	});
	zDisableProviderRequest = object({
		_meta: record(string(), unknown()).nullish(),
		id: string()
	});
	zDisableProviderResponse = object({ _meta: record(string(), unknown()).nullish() });
	zDisconnectMcpResponse = object({ _meta: record(string(), unknown()).nullish() });
	zElicitationContentValue = union([
		string(),
		number(),
		number(),
		boolean(),
		array(string())
	]);
	zElicitationAcceptAction = object({ content: record(string(), zElicitationContentValue).nullish() });
	zCreateElicitationResponse = intersection(union([
		zElicitationAcceptAction.and(object({ action: literal("accept") })),
		object({ action: literal("decline") }),
		object({ action: literal("cancel") })
	]), object({ _meta: record(string(), unknown()).nullish() }));
	zElicitationFormCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zElicitationId = string();
	zCompleteElicitationNotification = object({
		_meta: record(string(), unknown()).nullish(),
		elicitationId: zElicitationId
	});
	zElicitationSchemaType = literal("object");
	zElicitationStringType = literal("string");
	zElicitationUrlCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zElicitationCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		form: defaultOnError(zElicitationFormCapabilities.nullish(), () => void 0),
		url: defaultOnError(zElicitationUrlCapabilities.nullish(), () => void 0)
	});
	zEnumOption = object({
		const: string(),
		title: string()
	});
	zEnvVariable = object({
		_meta: record(string(), unknown()).nullish(),
		name: string(),
		value: string()
	});
	zErrorCode = union([
		literal(-32700),
		literal(-32600),
		literal(-32601),
		literal(-32602),
		literal(-32603),
		literal(-32800),
		literal(-32e3),
		literal(-32002),
		literal(-32042),
		number().int().min(-2147483648, { message: "Invalid value: Expected int32 to be >= -2147483648" }).max(2147483647, { message: "Invalid value: Expected int32 to be <= 2147483647" })
	]);
	zError = object({
		code: zErrorCode,
		data: unknown().optional(),
		message: string()
	});
	zExtNotification = unknown();
	zExtRequest = unknown();
	zExtResponse = unknown();
	zFileSystemCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		readTextFile: boolean().optional().default(false),
		writeTextFile: boolean().optional().default(false)
	});
	zHttpHeader = object({
		_meta: record(string(), unknown()).nullish(),
		name: string(),
		value: string()
	});
	zImplementation = object({
		_meta: record(string(), unknown()).nullish(),
		name: string(),
		title: string().nullish(),
		version: string()
	});
	zIntegerPropertySchema = object({
		default: number().nullish(),
		description: string().nullish(),
		maximum: number().nullish(),
		minimum: number().nullish(),
		title: string().nullish()
	});
	zKillTerminalResponse = object({ _meta: record(string(), unknown()).nullish() });
	zListProvidersRequest = object({ _meta: record(string(), unknown()).nullish() });
	zListSessionsRequest = object({
		_meta: record(string(), unknown()).nullish(),
		cursor: string().nullish(),
		cwd: string().nullish()
	});
	zLlmProtocol = union([
		literal("anthropic"),
		literal("openai"),
		literal("azure"),
		literal("vertex"),
		literal("bedrock"),
		string()
	]);
	zLogoutCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zAgentAuthCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		logout: defaultOnError(zLogoutCapabilities.nullish(), () => void 0)
	});
	zLogoutRequest = object({ _meta: record(string(), unknown()).nullish() });
	zLogoutResponse = object({ _meta: record(string(), unknown()).nullish() });
	zMcpCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		acp: boolean().optional().default(false),
		http: boolean().optional().default(false),
		sse: boolean().optional().default(false)
	});
	zMcpConnectionId = string();
	zConnectMcpResponse = object({
		_meta: record(string(), unknown()).nullish(),
		connectionId: zMcpConnectionId
	});
	zDisconnectMcpRequest = object({
		_meta: record(string(), unknown()).nullish(),
		connectionId: zMcpConnectionId
	});
	zMcpServerAcpId = string();
	zConnectMcpRequest = object({
		_meta: record(string(), unknown()).nullish(),
		acpId: zMcpServerAcpId
	});
	zMcpServerAcp = object({
		_meta: record(string(), unknown()).nullish(),
		id: zMcpServerAcpId,
		name: string()
	});
	zMcpServerHttp = object({
		_meta: record(string(), unknown()).nullish(),
		headers: array(zHttpHeader),
		name: string(),
		url: string()
	});
	zMcpServerSse = object({
		_meta: record(string(), unknown()).nullish(),
		headers: array(zHttpHeader),
		name: string(),
		url: string()
	});
	zMcpServerStdio = object({
		_meta: record(string(), unknown()).nullish(),
		args: array(string()),
		command: string(),
		env: array(zEnvVariable),
		name: string()
	});
	zMcpServer = union([
		zMcpServerHttp.and(object({ type: literal("http") })),
		zMcpServerSse.and(object({ type: literal("sse") })),
		zMcpServerAcp.and(object({ type: literal("acp") })),
		zMcpServerStdio
	]);
	zMessageId = string();
	zMessageMcpNotification = object({
		_meta: record(string(), unknown()).nullish(),
		connectionId: zMcpConnectionId,
		method: string(),
		params: record(string(), unknown()).nullish()
	});
	zMessageMcpRequest = object({
		_meta: record(string(), unknown()).nullish(),
		connectionId: zMcpConnectionId,
		method: string(),
		params: record(string(), unknown()).nullish()
	});
	zMessageMcpResponse = unknown();
	zNesDiagnosticSeverity = union([
		literal("error"),
		literal("warning"),
		literal("information"),
		literal("hint")
	]);
	zNesDiagnosticsCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesDocumentDidCloseCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesDocumentDidFocusCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesDocumentDidOpenCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesDocumentDidSaveCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesEditHistoryCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		maxCount: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish()
	});
	zNesEditHistoryEntry = object({
		diff: string(),
		uri: string()
	});
	zNesExcerpt = object({
		endLine: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }),
		startLine: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }),
		text: string()
	});
	zNesJumpCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesOpenFilesCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesRecentFile = object({
		languageId: string(),
		text: string(),
		uri: string()
	});
	zNesRecentFilesCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		maxCount: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish()
	});
	zNesRejectReason = union([
		literal("rejected"),
		literal("ignored"),
		literal("replaced"),
		literal("cancelled")
	]);
	zNesRelatedSnippet = object({
		excerpts: array(zNesExcerpt),
		uri: string()
	});
	zNesRelatedSnippetsCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesRenameCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zNesRepository = object({
		name: string(),
		owner: string(),
		remoteUrl: string()
	});
	zNesSearchAndReplaceCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zClientNesCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		jump: defaultOnError(zNesJumpCapabilities.nullish(), () => void 0),
		rename: defaultOnError(zNesRenameCapabilities.nullish(), () => void 0),
		searchAndReplace: defaultOnError(zNesSearchAndReplaceCapabilities.nullish(), () => void 0)
	});
	zNesSearchAndReplaceSuggestion = object({
		id: string(),
		isRegex: boolean().nullish(),
		replace: string(),
		search: string(),
		uri: string()
	});
	zNesTriggerKind = union([
		literal("automatic"),
		literal("diagnostic"),
		literal("manual")
	]);
	zNesUserActionsCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		maxCount: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish()
	});
	zNesContextCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		diagnostics: defaultOnError(zNesDiagnosticsCapabilities.nullish(), () => void 0),
		editHistory: defaultOnError(zNesEditHistoryCapabilities.nullish(), () => void 0),
		openFiles: defaultOnError(zNesOpenFilesCapabilities.nullish(), () => void 0),
		recentFiles: defaultOnError(zNesRecentFilesCapabilities.nullish(), () => void 0),
		relatedSnippets: defaultOnError(zNesRelatedSnippetsCapabilities.nullish(), () => void 0),
		userActions: defaultOnError(zNesUserActionsCapabilities.nullish(), () => void 0)
	});
	zNewSessionRequest = object({
		_meta: record(string(), unknown()).nullish(),
		additionalDirectories: array(string()).optional(),
		cwd: string(),
		mcpServers: array(zMcpServer)
	});
	zNumberPropertySchema = object({
		default: number().nullish(),
		description: string().nullish(),
		maximum: number().nullish(),
		minimum: number().nullish(),
		title: string().nullish()
	});
	zPermissionOptionId = string();
	zPermissionOptionKind = union([
		literal("allow_once"),
		literal("allow_always"),
		literal("reject_once"),
		literal("reject_always")
	]);
	zPermissionOption = object({
		_meta: record(string(), unknown()).nullish(),
		kind: zPermissionOptionKind,
		name: string(),
		optionId: zPermissionOptionId
	});
	zPlanCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zPlanEntryPriority = union([
		literal("high"),
		literal("medium"),
		literal("low")
	]);
	zPlanEntryStatus = union([
		literal("pending"),
		literal("in_progress"),
		literal("completed")
	]);
	zPlanEntry = object({
		_meta: record(string(), unknown()).nullish(),
		content: string(),
		priority: zPlanEntryPriority,
		status: zPlanEntryStatus
	});
	zPlan = object({
		_meta: record(string(), unknown()).nullish(),
		entries: requiredDefaultOnError(vecSkipError(zPlanEntry), () => [])
	});
	zPlanId = string();
	zPlanFile = object({
		_meta: record(string(), unknown()).nullish(),
		id: zPlanId,
		uri: string()
	});
	zPlanItems = object({
		_meta: record(string(), unknown()).nullish(),
		entries: requiredDefaultOnError(vecSkipError(zPlanEntry), () => []),
		id: zPlanId
	});
	zPlanMarkdown = object({
		_meta: record(string(), unknown()).nullish(),
		content: string(),
		id: zPlanId
	});
	zPlanRemoved = object({
		_meta: record(string(), unknown()).nullish(),
		id: zPlanId
	});
	zPlanUpdateContent = union([
		zPlanItems.and(object({ type: literal("items") })),
		zPlanFile.and(object({ type: literal("file") })),
		zPlanMarkdown.and(object({ type: literal("markdown") }))
	]);
	zPlanUpdate = object({
		_meta: record(string(), unknown()).nullish(),
		plan: zPlanUpdateContent
	});
	zPosition = object({
		character: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }),
		line: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" })
	});
	zNesJumpSuggestion = object({
		id: string(),
		position: zPosition,
		uri: string()
	});
	zNesRenameSuggestion = object({
		id: string(),
		newName: string(),
		position: zPosition,
		uri: string()
	});
	zNesUserAction = object({
		action: string(),
		position: zPosition,
		timestampMs: number(),
		uri: string()
	});
	zPositionEncodingKind = union([
		literal("utf-16"),
		literal("utf-32"),
		literal("utf-8")
	]);
	zClientCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		auth: zAuthCapabilities.optional().default({ terminal: false }),
		elicitation: defaultOnError(zElicitationCapabilities.nullish(), () => void 0),
		fs: zFileSystemCapabilities.optional().default({
			readTextFile: false,
			writeTextFile: false
		}),
		nes: defaultOnError(zClientNesCapabilities.nullish(), () => void 0),
		plan: defaultOnError(zPlanCapabilities.nullish(), () => void 0),
		positionEncodings: defaultOnError(vecSkipError(zPositionEncodingKind).optional(), () => []),
		terminal: boolean().optional().default(false)
	});
	zPromptCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		audio: boolean().optional().default(false),
		embeddedContext: boolean().optional().default(false),
		image: boolean().optional().default(false)
	});
	zProtocolVersion = number().int().gte(0).lte(65535);
	zInitializeRequest = object({
		_meta: record(string(), unknown()).nullish(),
		clientCapabilities: zClientCapabilities.optional().default({
			auth: { terminal: false },
			fs: {
				readTextFile: false,
				writeTextFile: false
			},
			terminal: false
		}),
		clientInfo: defaultOnError(zImplementation.nullish(), () => void 0),
		protocolVersion: zProtocolVersion
	});
	zProviderCurrentConfig = object({
		apiType: zLlmProtocol,
		baseUrl: string()
	});
	zProviderInfo = object({
		_meta: record(string(), unknown()).nullish(),
		current: zProviderCurrentConfig.nullish(),
		id: string(),
		required: boolean(),
		supported: requiredDefaultOnError(vecSkipError(zLlmProtocol), () => [])
	});
	zListProvidersResponse = object({
		_meta: record(string(), unknown()).nullish(),
		providers: requiredDefaultOnError(vecSkipError(zProviderInfo), () => [])
	});
	zProvidersCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zRange = object({
		end: zPosition,
		start: zPosition
	});
	zNesDiagnostic = object({
		message: string(),
		range: zRange,
		severity: zNesDiagnosticSeverity,
		uri: string()
	});
	zNesOpenFile = object({
		languageId: string(),
		lastFocusedMs: defaultOnError(number().nullish(), () => void 0),
		uri: string(),
		visibleRange: defaultOnError(zRange.nullish(), () => void 0)
	});
	zNesSuggestContext = object({
		_meta: record(string(), unknown()).nullish(),
		diagnostics: defaultOnError(vecSkipError(zNesDiagnostic).nullish(), () => void 0),
		editHistory: defaultOnError(vecSkipError(zNesEditHistoryEntry).nullish(), () => void 0),
		openFiles: defaultOnError(vecSkipError(zNesOpenFile).nullish(), () => void 0),
		recentFiles: defaultOnError(vecSkipError(zNesRecentFile).nullish(), () => void 0),
		relatedSnippets: defaultOnError(vecSkipError(zNesRelatedSnippet).nullish(), () => void 0),
		userActions: defaultOnError(vecSkipError(zNesUserAction).nullish(), () => void 0)
	});
	zNesTextEdit = object({
		newText: string(),
		range: zRange
	});
	zNesEditSuggestion = object({
		cursorPosition: defaultOnError(zPosition.nullish(), () => void 0),
		edits: array(zNesTextEdit),
		id: string(),
		uri: string()
	});
	zNesSuggestion = union([
		zNesEditSuggestion.and(object({ kind: literal("edit") })),
		zNesJumpSuggestion.and(object({ kind: literal("jump") })),
		zNesRenameSuggestion.and(object({ kind: literal("rename") })),
		zNesSearchAndReplaceSuggestion.and(object({ kind: literal("searchAndReplace") }))
	]);
	zReadTextFileResponse = object({
		_meta: record(string(), unknown()).nullish(),
		content: string()
	});
	zReleaseTerminalResponse = object({ _meta: record(string(), unknown()).nullish() });
	zRequestId = union([number(), string()]).nullable();
	object({
		_meta: record(string(), unknown()).nullish(),
		requestId: zRequestId
	});
	zElicitationRequestScope = object({ requestId: zRequestId });
	zRole = _enum(["assistant", "user"]);
	zAnnotations = object({
		_meta: record(string(), unknown()).nullish(),
		audience: defaultOnError(vecSkipError(zRole).nullish(), () => void 0),
		lastModified: string().nullish(),
		priority: number().nullish()
	});
	zAudioContent = object({
		_meta: record(string(), unknown()).nullish(),
		annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
		data: string(),
		mimeType: string()
	});
	zImageContent = object({
		_meta: record(string(), unknown()).nullish(),
		annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
		data: string(),
		mimeType: string(),
		uri: string().nullish()
	});
	zResourceLink = object({
		_meta: record(string(), unknown()).nullish(),
		annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
		description: string().nullish(),
		mimeType: string().nullish(),
		name: string(),
		size: number().nullish(),
		title: string().nullish(),
		uri: string()
	});
	zSelectedPermissionOutcome = object({
		_meta: record(string(), unknown()).nullish(),
		optionId: zPermissionOptionId
	});
	zRequestPermissionOutcome = union([object({ outcome: literal("cancelled") }), zSelectedPermissionOutcome.and(object({ outcome: literal("selected") }))]);
	zRequestPermissionResponse = object({
		_meta: record(string(), unknown()).nullish(),
		outcome: zRequestPermissionOutcome
	});
	zSessionAdditionalDirectoriesCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zSessionCloseCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zSessionConfigBoolean = object({ currentValue: boolean() });
	zSessionConfigGroupId = string();
	zSessionConfigId = string();
	zSessionConfigOptionCategory = union([
		literal("mode"),
		literal("model"),
		literal("thought_level"),
		string()
	]);
	zSessionConfigValueId = string();
	zSessionConfigSelectOption = object({
		_meta: record(string(), unknown()).nullish(),
		description: string().nullish(),
		name: string(),
		value: zSessionConfigValueId
	});
	zSessionConfigSelectGroup = object({
		_meta: record(string(), unknown()).nullish(),
		group: zSessionConfigGroupId,
		name: string(),
		options: array(zSessionConfigSelectOption)
	});
	zSessionConfigSelectOptions = union([array(zSessionConfigSelectOption), array(zSessionConfigSelectGroup)]);
	zSessionConfigSelect = object({
		currentValue: zSessionConfigValueId,
		options: zSessionConfigSelectOptions
	});
	zSessionConfigOption = intersection(union([zSessionConfigSelect.and(object({ type: literal("select") })), zSessionConfigBoolean.and(object({ type: literal("boolean") }))]), object({
		_meta: record(string(), unknown()).nullish(),
		category: defaultOnError(zSessionConfigOptionCategory.nullish(), () => void 0),
		description: string().nullish(),
		id: zSessionConfigId,
		name: string()
	}));
	zConfigOptionUpdate = object({
		_meta: record(string(), unknown()).nullish(),
		configOptions: requiredDefaultOnError(vecSkipError(zSessionConfigOption), () => [])
	});
	zSessionDeleteCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zSessionForkCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zSessionId = string();
	zAcceptNesNotification = object({
		_meta: record(string(), unknown()).nullish(),
		id: string(),
		sessionId: zSessionId
	});
	zCancelNotification = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId
	});
	zCloseNesRequest = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId
	});
	zCloseSessionRequest = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId
	});
	zCreateTerminalRequest = object({
		_meta: record(string(), unknown()).nullish(),
		args: array(string()).optional(),
		command: string(),
		cwd: string().nullish(),
		env: array(zEnvVariable).optional(),
		outputByteLimit: number().nullish(),
		sessionId: zSessionId
	});
	zDeleteSessionRequest = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId
	});
	zDidCloseDocumentNotification = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId,
		uri: string()
	});
	zDidFocusDocumentNotification = object({
		_meta: record(string(), unknown()).nullish(),
		position: zPosition,
		sessionId: zSessionId,
		uri: string(),
		version: number(),
		visibleRange: zRange
	});
	zDidOpenDocumentNotification = object({
		_meta: record(string(), unknown()).nullish(),
		languageId: string(),
		sessionId: zSessionId,
		text: string(),
		uri: string(),
		version: number()
	});
	zDidSaveDocumentNotification = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId,
		uri: string()
	});
	zForkSessionRequest = object({
		_meta: record(string(), unknown()).nullish(),
		additionalDirectories: array(string()).optional(),
		cwd: string(),
		mcpServers: array(zMcpServer).optional(),
		sessionId: zSessionId
	});
	zKillTerminalRequest = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId,
		terminalId: string()
	});
	zLoadSessionRequest = object({
		_meta: record(string(), unknown()).nullish(),
		additionalDirectories: array(string()).optional(),
		cwd: string(),
		mcpServers: array(zMcpServer),
		sessionId: zSessionId
	});
	zReadTextFileRequest = object({
		_meta: record(string(), unknown()).nullish(),
		limit: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
		line: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
		path: string(),
		sessionId: zSessionId
	});
	zRejectNesNotification = object({
		_meta: record(string(), unknown()).nullish(),
		id: string(),
		reason: defaultOnError(zNesRejectReason.nullish(), () => void 0),
		sessionId: zSessionId
	});
	zReleaseTerminalRequest = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId,
		terminalId: string()
	});
	zResumeSessionRequest = object({
		_meta: record(string(), unknown()).nullish(),
		additionalDirectories: array(string()).optional(),
		cwd: string(),
		mcpServers: array(zMcpServer).optional(),
		sessionId: zSessionId
	});
	zSessionInfo = object({
		_meta: record(string(), unknown()).nullish(),
		additionalDirectories: array(string()).optional(),
		cwd: string(),
		sessionId: zSessionId,
		title: defaultOnError(string().nullish(), () => void 0),
		updatedAt: defaultOnError(string().nullish(), () => void 0)
	});
	zListSessionsResponse = object({
		_meta: record(string(), unknown()).nullish(),
		nextCursor: string().nullish(),
		sessions: requiredDefaultOnError(vecSkipError(zSessionInfo), () => [])
	});
	zSessionInfoUpdate = object({
		_meta: record(string(), unknown()).nullish(),
		title: string().nullish(),
		updatedAt: string().nullish()
	});
	zSessionListCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zSessionModeId = string();
	zCurrentModeUpdate = object({
		_meta: record(string(), unknown()).nullish(),
		currentModeId: zSessionModeId
	});
	zSessionMode = object({
		_meta: record(string(), unknown()).nullish(),
		description: string().nullish(),
		id: zSessionModeId,
		name: string()
	});
	zSessionModeState = object({
		_meta: record(string(), unknown()).nullish(),
		availableModes: requiredDefaultOnError(vecSkipError(zSessionMode), () => []),
		currentModeId: zSessionModeId
	});
	zForkSessionResponse = object({
		_meta: record(string(), unknown()).nullish(),
		configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
		modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
		sessionId: zSessionId
	});
	zLoadSessionResponse = object({
		_meta: record(string(), unknown()).nullish(),
		configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
		modes: defaultOnError(zSessionModeState.nullish(), () => void 0)
	});
	zNewSessionResponse = object({
		_meta: record(string(), unknown()).nullish(),
		configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
		modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
		sessionId: zSessionId
	});
	zResumeSessionResponse = object({
		_meta: record(string(), unknown()).nullish(),
		configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
		modes: defaultOnError(zSessionModeState.nullish(), () => void 0)
	});
	zSessionResumeCapabilities = object({ _meta: record(string(), unknown()).nullish() });
	zSessionCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		additionalDirectories: defaultOnError(zSessionAdditionalDirectoriesCapabilities.nullish(), () => void 0),
		close: defaultOnError(zSessionCloseCapabilities.nullish(), () => void 0),
		delete: defaultOnError(zSessionDeleteCapabilities.nullish(), () => void 0),
		fork: defaultOnError(zSessionForkCapabilities.nullish(), () => void 0),
		list: defaultOnError(zSessionListCapabilities.nullish(), () => void 0),
		resume: defaultOnError(zSessionResumeCapabilities.nullish(), () => void 0)
	});
	zSetProviderRequest = object({
		_meta: record(string(), unknown()).nullish(),
		apiType: zLlmProtocol,
		baseUrl: string(),
		headers: record(string(), string()).optional(),
		id: string()
	});
	zSetProviderResponse = object({ _meta: record(string(), unknown()).nullish() });
	zSetSessionConfigOptionRequest = intersection(union([object({
		type: literal("boolean"),
		value: boolean()
	}), object({ value: zSessionConfigValueId })]), object({
		_meta: record(string(), unknown()).nullish(),
		configId: zSessionConfigId,
		sessionId: zSessionId
	}));
	zSetSessionConfigOptionResponse = object({
		_meta: record(string(), unknown()).nullish(),
		configOptions: requiredDefaultOnError(vecSkipError(zSessionConfigOption), () => [])
	});
	zSetSessionModeRequest = object({
		_meta: record(string(), unknown()).nullish(),
		modeId: zSessionModeId,
		sessionId: zSessionId
	});
	zSetSessionModeResponse = object({ _meta: record(string(), unknown()).nullish() });
	zStartNesResponse = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId
	});
	zStopReason = union([
		literal("end_turn"),
		literal("max_tokens"),
		literal("max_turn_requests"),
		literal("refusal"),
		literal("cancelled")
	]);
	zStringFormat = union([
		literal("email"),
		literal("uri"),
		literal("date"),
		literal("date-time")
	]);
	zStringPropertySchema = object({
		default: string().nullish(),
		description: string().nullish(),
		enum: array(string()).nullish(),
		format: zStringFormat.nullish(),
		maxLength: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
		minLength: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
		oneOf: array(zEnumOption).nullish(),
		pattern: string().nullish(),
		title: string().nullish()
	});
	zSuggestNesRequest = object({
		_meta: record(string(), unknown()).nullish(),
		context: defaultOnError(zNesSuggestContext.nullish(), () => void 0),
		position: zPosition,
		selection: defaultOnError(zRange.nullish(), () => void 0),
		sessionId: zSessionId,
		triggerKind: zNesTriggerKind,
		uri: string(),
		version: number()
	});
	zSuggestNesResponse = object({
		_meta: record(string(), unknown()).nullish(),
		suggestions: requiredDefaultOnError(vecSkipError(zNesSuggestion), () => [])
	});
	zTerminal = object({
		_meta: record(string(), unknown()).nullish(),
		terminalId: string()
	});
	zTerminalExitStatus = object({
		_meta: record(string(), unknown()).nullish(),
		exitCode: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
		signal: string().nullish()
	});
	zTerminalOutputRequest = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId,
		terminalId: string()
	});
	zTerminalOutputResponse = object({
		_meta: record(string(), unknown()).nullish(),
		exitStatus: zTerminalExitStatus.nullish(),
		output: string(),
		truncated: boolean()
	});
	zTextContent = object({
		_meta: record(string(), unknown()).nullish(),
		annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
		text: string()
	});
	zTextDocumentContentChangeEvent = object({
		range: zRange.nullish(),
		text: string()
	});
	zDidChangeDocumentNotification = object({
		_meta: record(string(), unknown()).nullish(),
		contentChanges: array(zTextDocumentContentChangeEvent),
		sessionId: zSessionId,
		uri: string(),
		version: number()
	});
	object({
		method: string(),
		params: union([
			zCancelNotification,
			zDidOpenDocumentNotification,
			zDidChangeDocumentNotification,
			zDidCloseDocumentNotification,
			zDidSaveDocumentNotification,
			zDidFocusDocumentNotification,
			zAcceptNesNotification,
			zRejectNesNotification,
			zMessageMcpNotification,
			zExtNotification
		]).nullish()
	});
	zTextDocumentSyncKind = union([literal("full"), literal("incremental")]);
	zNesDocumentDidChangeCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		syncKind: zTextDocumentSyncKind
	});
	zNesDocumentEventCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		didChange: defaultOnError(zNesDocumentDidChangeCapabilities.nullish(), () => void 0),
		didClose: defaultOnError(zNesDocumentDidCloseCapabilities.nullish(), () => void 0),
		didFocus: defaultOnError(zNesDocumentDidFocusCapabilities.nullish(), () => void 0),
		didOpen: defaultOnError(zNesDocumentDidOpenCapabilities.nullish(), () => void 0),
		didSave: defaultOnError(zNesDocumentDidSaveCapabilities.nullish(), () => void 0)
	});
	zNesEventCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		document: defaultOnError(zNesDocumentEventCapabilities.nullish(), () => void 0)
	});
	zNesCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		context: defaultOnError(zNesContextCapabilities.nullish(), () => void 0),
		events: defaultOnError(zNesEventCapabilities.nullish(), () => void 0)
	});
	zAgentCapabilities = object({
		_meta: record(string(), unknown()).nullish(),
		auth: zAgentAuthCapabilities.optional().default({}),
		loadSession: boolean().optional().default(false),
		mcpCapabilities: zMcpCapabilities.optional().default({
			acp: false,
			http: false,
			sse: false
		}),
		nes: defaultOnError(zNesCapabilities.nullish(), () => void 0),
		positionEncoding: defaultOnError(zPositionEncodingKind.nullish(), () => void 0),
		promptCapabilities: zPromptCapabilities.optional().default({
			audio: false,
			embeddedContext: false,
			image: false
		}),
		providers: defaultOnError(zProvidersCapabilities.nullish(), () => void 0),
		sessionCapabilities: zSessionCapabilities.optional().default({})
	});
	zInitializeResponse = object({
		_meta: record(string(), unknown()).nullish(),
		agentCapabilities: zAgentCapabilities.optional().default({
			auth: {},
			loadSession: false,
			mcpCapabilities: {
				acp: false,
				http: false,
				sse: false
			},
			promptCapabilities: {
				audio: false,
				embeddedContext: false,
				image: false
			},
			sessionCapabilities: {}
		}),
		agentInfo: defaultOnError(zImplementation.nullish(), () => void 0),
		authMethods: defaultOnError(vecSkipError(zAuthMethod).optional().default([]), () => []),
		protocolVersion: zProtocolVersion
	});
	zTextResourceContents = object({
		_meta: record(string(), unknown()).nullish(),
		mimeType: string().nullish(),
		text: string(),
		uri: string()
	});
	zEmbeddedResourceResource = union([zTextResourceContents, zBlobResourceContents]);
	zEmbeddedResource = object({
		_meta: record(string(), unknown()).nullish(),
		annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
		resource: zEmbeddedResourceResource
	});
	zContentBlock = union([
		zTextContent.and(object({ type: literal("text") })),
		zImageContent.and(object({ type: literal("image") })),
		zAudioContent.and(object({ type: literal("audio") })),
		zResourceLink.and(object({ type: literal("resource_link") })),
		zEmbeddedResource.and(object({ type: literal("resource") }))
	]);
	zContent = object({
		_meta: record(string(), unknown()).nullish(),
		content: zContentBlock
	});
	zContentChunk = object({
		_meta: record(string(), unknown()).nullish(),
		content: zContentBlock,
		messageId: zMessageId.nullish()
	});
	zPromptRequest = object({
		_meta: record(string(), unknown()).nullish(),
		prompt: array(zContentBlock),
		sessionId: zSessionId
	});
	zTitledMultiSelectItems = object({ anyOf: array(zEnumOption) });
	zToolCallContent = union([
		zContent.and(object({ type: literal("content") })),
		zDiff.and(object({ type: literal("diff") })),
		zTerminal.and(object({ type: literal("terminal") }))
	]);
	zToolCallId = string();
	zElicitationSessionScope = object({
		sessionId: zSessionId,
		toolCallId: zToolCallId.nullish()
	});
	zElicitationUrlMode = intersection(union([zElicitationSessionScope, zElicitationRequestScope]), object({
		elicitationId: zElicitationId,
		url: string().url()
	}));
	zToolCallLocation = object({
		_meta: record(string(), unknown()).nullish(),
		line: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
		path: string()
	});
	zToolCallStatus = union([
		literal("pending"),
		literal("in_progress"),
		literal("completed"),
		literal("failed")
	]);
	zToolKind = union([
		literal("read"),
		literal("edit"),
		literal("delete"),
		literal("move"),
		literal("search"),
		literal("execute"),
		literal("think"),
		literal("fetch"),
		literal("switch_mode"),
		literal("other")
	]);
	zToolCall = object({
		_meta: record(string(), unknown()).nullish(),
		content: defaultOnError(vecSkipError(zToolCallContent).optional(), () => []),
		kind: zToolKind.optional(),
		locations: defaultOnError(vecSkipError(zToolCallLocation).optional(), () => []),
		rawInput: unknown().optional(),
		rawOutput: unknown().optional(),
		status: zToolCallStatus.optional(),
		title: string(),
		toolCallId: zToolCallId
	});
	zToolCallUpdate = object({
		_meta: record(string(), unknown()).nullish(),
		content: defaultOnError(vecSkipError(zToolCallContent).nullish(), () => void 0),
		kind: defaultOnError(zToolKind.nullish(), () => void 0),
		locations: defaultOnError(vecSkipError(zToolCallLocation).nullish(), () => void 0),
		rawInput: unknown().optional(),
		rawOutput: unknown().optional(),
		status: defaultOnError(zToolCallStatus.nullish(), () => void 0),
		title: string().nullish(),
		toolCallId: zToolCallId
	});
	zRequestPermissionRequest = object({
		_meta: record(string(), unknown()).nullish(),
		options: array(zPermissionOption),
		sessionId: zSessionId,
		toolCall: zToolCallUpdate
	});
	zUnstructuredCommandInput = object({
		_meta: record(string(), unknown()).nullish(),
		hint: string()
	});
	zAvailableCommandInput = zUnstructuredCommandInput;
	zAvailableCommand = object({
		_meta: record(string(), unknown()).nullish(),
		description: string(),
		input: defaultOnError(zAvailableCommandInput.nullish(), () => void 0),
		name: string()
	});
	zAvailableCommandsUpdate = object({
		_meta: record(string(), unknown()).nullish(),
		availableCommands: requiredDefaultOnError(vecSkipError(zAvailableCommand), () => [])
	});
	zUntitledMultiSelectItems = object({
		enum: array(string()),
		type: zElicitationStringType
	});
	zMultiSelectItems = union([zUntitledMultiSelectItems, zTitledMultiSelectItems]);
	zMultiSelectPropertySchema = object({
		default: array(string()).nullish(),
		description: string().nullish(),
		items: zMultiSelectItems,
		maxItems: number().nullish(),
		minItems: number().nullish(),
		title: string().nullish()
	});
	zElicitationPropertySchema = union([
		zStringPropertySchema.and(object({ type: literal("string") })),
		zNumberPropertySchema.and(object({ type: literal("number") })),
		zIntegerPropertySchema.and(object({ type: literal("integer") })),
		zBooleanPropertySchema.and(object({ type: literal("boolean") })),
		zMultiSelectPropertySchema.and(object({ type: literal("array") }))
	]);
	zElicitationSchema = object({
		description: string().nullish(),
		properties: record(string(), zElicitationPropertySchema).optional().default({}),
		required: array(string()).nullish(),
		title: string().nullish(),
		type: zElicitationSchemaType.optional().default("object")
	});
	zElicitationFormMode = intersection(union([zElicitationSessionScope, zElicitationRequestScope]), object({ requestedSchema: zElicitationSchema }));
	zCreateElicitationRequest = intersection(union([zElicitationFormMode.and(object({ mode: literal("form") })), zElicitationUrlMode.and(object({ mode: literal("url") }))]), object({
		_meta: record(string(), unknown()).nullish(),
		message: string()
	}));
	zUsage = object({
		cachedReadTokens: number().nullish(),
		cachedWriteTokens: number().nullish(),
		inputTokens: number(),
		outputTokens: number(),
		thoughtTokens: number().nullish(),
		totalTokens: number()
	});
	zPromptResponse = object({
		_meta: record(string(), unknown()).nullish(),
		stopReason: zStopReason,
		usage: defaultOnError(zUsage.nullish(), () => void 0)
	});
	union([object({
		id: zRequestId,
		result: union([
			zInitializeResponse,
			zAuthenticateResponse,
			zListProvidersResponse,
			zSetProviderResponse,
			zDisableProviderResponse,
			zLogoutResponse,
			zNewSessionResponse,
			zLoadSessionResponse,
			zListSessionsResponse,
			zDeleteSessionResponse,
			zForkSessionResponse,
			zResumeSessionResponse,
			zCloseSessionResponse,
			zSetSessionModeResponse,
			zSetSessionConfigOptionResponse,
			zPromptResponse,
			zStartNesResponse,
			zSuggestNesResponse,
			zCloseNesResponse,
			zExtResponse,
			zMessageMcpResponse
		])
	}), object({
		error: zError,
		id: zRequestId
	})]);
	zUsageUpdate = object({
		_meta: record(string(), unknown()).nullish(),
		cost: defaultOnError(zCost.nullish(), () => void 0),
		size: number(),
		used: number()
	});
	zSessionUpdate = union([
		zContentChunk.and(object({ sessionUpdate: literal("user_message_chunk") })),
		zContentChunk.and(object({ sessionUpdate: literal("agent_message_chunk") })),
		zContentChunk.and(object({ sessionUpdate: literal("agent_thought_chunk") })),
		zToolCall.and(object({ sessionUpdate: literal("tool_call") })),
		zToolCallUpdate.and(object({ sessionUpdate: literal("tool_call_update") })),
		zPlan.and(object({ sessionUpdate: literal("plan") })),
		zPlanUpdate.and(object({ sessionUpdate: literal("plan_update") })),
		zPlanRemoved.and(object({ sessionUpdate: literal("plan_removed") })),
		zAvailableCommandsUpdate.and(object({ sessionUpdate: literal("available_commands_update") })),
		zCurrentModeUpdate.and(object({ sessionUpdate: literal("current_mode_update") })),
		zConfigOptionUpdate.and(object({ sessionUpdate: literal("config_option_update") })),
		zSessionInfoUpdate.and(object({ sessionUpdate: literal("session_info_update") })),
		zUsageUpdate.and(object({ sessionUpdate: literal("usage_update") }))
	]);
	zSessionNotification = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId,
		update: zSessionUpdate
	});
	object({
		method: string(),
		params: union([
			zSessionNotification,
			zCompleteElicitationNotification,
			zMessageMcpNotification,
			zExtNotification
		]).nullish()
	});
	zWaitForTerminalExitRequest = object({
		_meta: record(string(), unknown()).nullish(),
		sessionId: zSessionId,
		terminalId: string()
	});
	zWaitForTerminalExitResponse = object({
		_meta: record(string(), unknown()).nullish(),
		exitCode: number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
		signal: string().nullish()
	});
	zWorkspaceFolder = object({
		name: string(),
		uri: string()
	});
	zStartNesRequest = object({
		_meta: record(string(), unknown()).nullish(),
		repository: defaultOnError(zNesRepository.nullish(), () => void 0),
		workspaceFolders: defaultOnError(vecSkipError(zWorkspaceFolder).nullish(), () => void 0),
		workspaceUri: string().nullish()
	});
	object({
		id: zRequestId,
		method: string(),
		params: union([
			zInitializeRequest,
			zAuthenticateRequest,
			zListProvidersRequest,
			zSetProviderRequest,
			zDisableProviderRequest,
			zLogoutRequest,
			zNewSessionRequest,
			zLoadSessionRequest,
			zListSessionsRequest,
			zDeleteSessionRequest,
			zForkSessionRequest,
			zResumeSessionRequest,
			zCloseSessionRequest,
			zSetSessionModeRequest,
			zSetSessionConfigOptionRequest,
			zPromptRequest,
			zStartNesRequest,
			zSuggestNesRequest,
			zCloseNesRequest,
			zMessageMcpRequest,
			zExtRequest
		]).nullish()
	});
	zWriteTextFileRequest = object({
		_meta: record(string(), unknown()).nullish(),
		content: string(),
		path: string(),
		sessionId: zSessionId
	});
	object({
		id: zRequestId,
		method: string(),
		params: union([
			zWriteTextFileRequest,
			zReadTextFileRequest,
			zRequestPermissionRequest,
			zCreateTerminalRequest,
			zTerminalOutputRequest,
			zReleaseTerminalRequest,
			zWaitForTerminalExitRequest,
			zKillTerminalRequest,
			zCreateElicitationRequest,
			zConnectMcpRequest,
			zMessageMcpRequest,
			zDisconnectMcpRequest,
			zExtRequest
		]).nullish()
	});
	zWriteTextFileResponse = object({ _meta: record(string(), unknown()).nullish() });
	union([object({
		id: zRequestId,
		result: union([
			zWriteTextFileResponse,
			zReadTextFileResponse,
			zRequestPermissionResponse,
			zCreateTerminalResponse,
			zTerminalOutputResponse,
			zReleaseTerminalResponse,
			zWaitForTerminalExitResponse,
			zKillTerminalResponse,
			zCreateElicitationResponse,
			zConnectMcpResponse,
			zDisconnectMcpResponse,
			zExtResponse,
			zMessageMcpResponse
		])
	}), object({
		error: zError,
		id: zRequestId
	})]);
}));
//#endregion
//#region ../../node_modules/.pnpm/@agentclientprotocol+sdk@0.25.0_zod@4.3.6/node_modules/@agentclientprotocol/sdk/dist/stream.js
/**
* Creates an ACP Stream from a pair of newline-delimited JSON streams.
*
* This is the typical way to handle ACP connections over stdio, converting
* between AnyMessage objects and newline-delimited JSON.
*
* @param output - The writable stream to send encoded messages to
* @param input - The readable stream to receive encoded messages from
* @returns A Stream for bidirectional ACP communication
*/
function ndJsonStream(output, input) {
	const textEncoder = new TextEncoder();
	const textDecoder = new TextDecoder();
	return {
		readable: new ReadableStream({ async start(controller) {
			let content = "";
			const reader = input.getReader();
			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) {
						content += textDecoder.decode();
						break;
					}
					if (!value) continue;
					content += textDecoder.decode(value, { stream: true });
					const lines = content.split("\n");
					content = lines.pop() || "";
					for (const line of lines) {
						const trimmedLine = line.trim();
						if (trimmedLine) try {
							const message = JSON.parse(trimmedLine);
							controller.enqueue(message);
						} catch (err) {
							console.error("Failed to parse JSON message:", trimmedLine, err);
						}
					}
				}
				const trimmedLine = content.trim();
				if (trimmedLine) try {
					const message = JSON.parse(trimmedLine);
					controller.enqueue(message);
				} catch (err) {
					console.error("Failed to parse JSON message:", trimmedLine, err);
				}
			} catch (err) {
				controller.error(err);
				return;
			} finally {
				reader.releaseLock();
			}
			controller.close();
		} }),
		writable: new WritableStream({ async write(message) {
			const content = JSON.stringify(message) + "\n";
			const writer = output.getWriter();
			try {
				await writer.write(textEncoder.encode(content));
			} finally {
				writer.releaseLock();
			}
		} })
	};
}
var init_stream = __esmMin((() => {}));
//#endregion
//#region ../../node_modules/.pnpm/@agentclientprotocol+sdk@0.25.0_zod@4.3.6/node_modules/@agentclientprotocol/sdk/dist/acp.js
function emptyObjectResponse(response) {
	return response ?? {};
}
function rejectedPromise(error) {
	const promise = Promise.reject(error);
	promise.catch(() => {});
	return promise;
}
var AgentSideConnection, TerminalHandle, ClientSideConnection, Connection, RequestError;
//#endregion
__esmMin((() => {
	init_v4();
	init_schema();
	init_zod_gen();
	init_schema();
	init_stream();
	AgentSideConnection = class {
		connection;
		/**
		* Creates a new agent-side connection to a client.
		*
		* This establishes the communication channel from the agent's perspective
		* following the ACP specification.
		*
		* @param toAgent - A function that creates an Agent handler to process incoming client requests
		* @param stream - The bidirectional message stream for communication. Typically created using
		*                 {@link ndJsonStream} for stdio-based connections.
		*
		* See protocol docs: [Communication Model](https://agentclientprotocol.com/protocol/overview#communication-model)
		*/
		constructor(toAgent, stream) {
			const agent = toAgent(this);
			const requestHandler = async (method, params) => {
				switch (method) {
					case AGENT_METHODS.initialize: {
						const validatedParams = zInitializeRequest.parse(params);
						return agent.initialize(validatedParams);
					}
					case AGENT_METHODS.session_new: {
						const validatedParams = zNewSessionRequest.parse(params);
						return agent.newSession(validatedParams);
					}
					case AGENT_METHODS.session_load: {
						if (!agent.loadSession) throw RequestError.methodNotFound(method);
						const validatedParams = zLoadSessionRequest.parse(params);
						return agent.loadSession(validatedParams);
					}
					case AGENT_METHODS.session_list: {
						if (!agent.listSessions) throw RequestError.methodNotFound(method);
						const validatedParams = zListSessionsRequest.parse(params);
						return agent.listSessions(validatedParams);
					}
					case AGENT_METHODS.session_delete: {
						if (!agent.deleteSession) throw RequestError.methodNotFound(method);
						const validatedParams = zDeleteSessionRequest.parse(params);
						return await agent.deleteSession(validatedParams) ?? {};
					}
					case AGENT_METHODS.session_fork: {
						if (!agent.unstable_forkSession) throw RequestError.methodNotFound(method);
						const validatedParams = zForkSessionRequest.parse(params);
						return agent.unstable_forkSession(validatedParams);
					}
					case AGENT_METHODS.session_resume: {
						if (!agent.resumeSession) throw RequestError.methodNotFound(method);
						const validatedParams = zResumeSessionRequest.parse(params);
						return agent.resumeSession(validatedParams);
					}
					case AGENT_METHODS.session_close: {
						if (!agent.closeSession) throw RequestError.methodNotFound(method);
						const validatedParams = zCloseSessionRequest.parse(params);
						return await agent.closeSession(validatedParams) ?? {};
					}
					case AGENT_METHODS.session_set_mode: {
						if (!agent.setSessionMode) throw RequestError.methodNotFound(method);
						const validatedParams = zSetSessionModeRequest.parse(params);
						return await agent.setSessionMode(validatedParams) ?? {};
					}
					case AGENT_METHODS.authenticate: {
						const validatedParams = zAuthenticateRequest.parse(params);
						return await agent.authenticate(validatedParams) ?? {};
					}
					case AGENT_METHODS.providers_list: {
						if (!agent.unstable_listProviders) throw RequestError.methodNotFound(method);
						const validatedParams = zListProvidersRequest.parse(params);
						return agent.unstable_listProviders(validatedParams);
					}
					case AGENT_METHODS.providers_set: {
						if (!agent.unstable_setProvider) throw RequestError.methodNotFound(method);
						const validatedParams = zSetProviderRequest.parse(params);
						return await agent.unstable_setProvider(validatedParams) ?? {};
					}
					case AGENT_METHODS.providers_disable: {
						if (!agent.unstable_disableProvider) throw RequestError.methodNotFound(method);
						const validatedParams = zDisableProviderRequest.parse(params);
						return await agent.unstable_disableProvider(validatedParams) ?? {};
					}
					case AGENT_METHODS.logout: {
						if (!agent.logout) throw RequestError.methodNotFound(method);
						const validatedParams = zLogoutRequest.parse(params);
						return await agent.logout(validatedParams) ?? {};
					}
					case AGENT_METHODS.session_prompt: {
						const validatedParams = zPromptRequest.parse(params);
						return agent.prompt(validatedParams);
					}
					case AGENT_METHODS.session_set_config_option: {
						if (!agent.setSessionConfigOption) throw RequestError.methodNotFound(method);
						const validatedParams = zSetSessionConfigOptionRequest.parse(params);
						return agent.setSessionConfigOption(validatedParams);
					}
					case AGENT_METHODS.nes_start: {
						if (!agent.unstable_startNes) throw RequestError.methodNotFound(method);
						const validatedParams = zStartNesRequest.parse(params);
						return agent.unstable_startNes(validatedParams);
					}
					case AGENT_METHODS.nes_suggest: {
						if (!agent.unstable_suggestNes) throw RequestError.methodNotFound(method);
						const validatedParams = zSuggestNesRequest.parse(params);
						return agent.unstable_suggestNes(validatedParams);
					}
					case AGENT_METHODS.nes_close: {
						if (!agent.unstable_closeNes) throw RequestError.methodNotFound(method);
						const validatedParams = zCloseNesRequest.parse(params);
						return await agent.unstable_closeNes(validatedParams) ?? {};
					}
					default:
						if (agent.extMethod) return agent.extMethod(method, params);
						throw RequestError.methodNotFound(method);
				}
			};
			const notificationHandler = async (method, params) => {
				switch (method) {
					case AGENT_METHODS.session_cancel: {
						const validatedParams = zCancelNotification.parse(params);
						return agent.cancel(validatedParams);
					}
					case AGENT_METHODS.document_did_open: {
						if (!agent.unstable_didOpenDocument) return;
						const validatedParams = zDidOpenDocumentNotification.parse(params);
						return agent.unstable_didOpenDocument(validatedParams);
					}
					case AGENT_METHODS.document_did_change: {
						if (!agent.unstable_didChangeDocument) return;
						const validatedParams = zDidChangeDocumentNotification.parse(params);
						return agent.unstable_didChangeDocument(validatedParams);
					}
					case AGENT_METHODS.document_did_close: {
						if (!agent.unstable_didCloseDocument) return;
						const validatedParams = zDidCloseDocumentNotification.parse(params);
						return agent.unstable_didCloseDocument(validatedParams);
					}
					case AGENT_METHODS.document_did_save: {
						if (!agent.unstable_didSaveDocument) return;
						const validatedParams = zDidSaveDocumentNotification.parse(params);
						return agent.unstable_didSaveDocument(validatedParams);
					}
					case AGENT_METHODS.document_did_focus: {
						if (!agent.unstable_didFocusDocument) return;
						const validatedParams = zDidFocusDocumentNotification.parse(params);
						return agent.unstable_didFocusDocument(validatedParams);
					}
					case AGENT_METHODS.nes_accept: {
						if (!agent.unstable_acceptNes) return;
						const validatedParams = zAcceptNesNotification.parse(params);
						return agent.unstable_acceptNes(validatedParams);
					}
					case AGENT_METHODS.nes_reject: {
						if (!agent.unstable_rejectNes) return;
						const validatedParams = zRejectNesNotification.parse(params);
						return agent.unstable_rejectNes(validatedParams);
					}
					default:
						if (agent.extNotification) return agent.extNotification(method, params);
						throw RequestError.methodNotFound(method);
				}
			};
			this.connection = new Connection(requestHandler, notificationHandler, stream);
		}
		/**
		* Handles session update notifications from the agent.
		*
		* This is a notification endpoint (no response expected) that sends
		* real-time updates about session progress, including message chunks,
		* tool calls, and execution plans.
		*
		* Note: Clients SHOULD continue accepting tool call updates even after
		* sending a `session/cancel` notification, as the agent may send final
		* updates before responding with the cancelled stop reason.
		*
		* See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)
		*/
		sessionUpdate(params) {
			return this.connection.sendNotification(CLIENT_METHODS.session_update, params);
		}
		/**
		* Requests permission from the user for a tool call operation.
		*
		* Called by the agent when it needs user authorization before executing
		* a potentially sensitive operation. The client should present the options
		* to the user and return their decision.
		*
		* If the client cancels the prompt turn via `session/cancel`, it MUST
		* respond to this request with `RequestPermissionOutcome::Cancelled`.
		*
		* See protocol docs: [Requesting Permission](https://agentclientprotocol.com/protocol/tool-calls#requesting-permission)
		*/
		requestPermission(params) {
			return this.connection.sendRequest(CLIENT_METHODS.session_request_permission, params);
		}
		/**
		* Reads content from a text file in the client's file system.
		*
		* Only available if the client advertises the `fs.readTextFile` capability.
		* Allows the agent to access file contents within the client's environment.
		*
		* See protocol docs: [Client](https://agentclientprotocol.com/protocol/overview#client)
		*/
		readTextFile(params) {
			return this.connection.sendRequest(CLIENT_METHODS.fs_read_text_file, params);
		}
		/**
		* Writes content to a text file in the client's file system.
		*
		* Only available if the client advertises the `fs.writeTextFile` capability.
		* Allows the agent to create or modify files within the client's environment.
		*
		* See protocol docs: [Client](https://agentclientprotocol.com/protocol/overview#client)
		*/
		writeTextFile(params) {
			return this.connection.sendRequest(CLIENT_METHODS.fs_write_text_file, params, emptyObjectResponse);
		}
		/**
		* Executes a command in a new terminal.
		*
		* Returns a `TerminalHandle` that can be used to get output, wait for exit,
		* kill the command, or release the terminal.
		*
		* The terminal can also be embedded in tool calls by using its ID in
		* `ToolCallContent` with type "terminal".
		*
		* @param params - The terminal creation parameters
		* @returns A handle to control and monitor the terminal
		*/
		createTerminal(params) {
			return this.connection.sendRequest(CLIENT_METHODS.terminal_create, params, (response) => new TerminalHandle(response.terminalId, params.sessionId, this.connection));
		}
		/**
		* **UNSTABLE**
		*
		* This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Creates an elicitation to request input from the user.
		*
		* @experimental
		*/
		unstable_createElicitation(params) {
			return this.connection.sendRequest(CLIENT_METHODS.elicitation_create, params);
		}
		/**
		* **UNSTABLE**
		*
		* This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Notifies the client that a URL-based elicitation is complete.
		*
		* @experimental
		*/
		unstable_completeElicitation(params) {
			return this.connection.sendNotification(CLIENT_METHODS.elicitation_complete, params);
		}
		/**
		* Extension method
		*
		* Allows the Agent to send an arbitrary request that is not part of the ACP spec.
		*/
		extMethod(method, params) {
			return this.connection.sendRequest(method, params);
		}
		/**
		* Extension notification
		*
		* Allows the Agent to send an arbitrary notification that is not part of the ACP spec.
		*/
		extNotification(method, params) {
			return this.connection.sendNotification(method, params);
		}
		/**
		* AbortSignal that aborts when the connection closes.
		*
		* This signal can be used to:
		* - Listen for connection closure: `connection.signal.addEventListener('abort', () => {...})`
		* - Check connection status synchronously: `if (connection.signal.aborted) {...}`
		* - Pass to other APIs (fetch, setTimeout) for automatic cancellation
		*
		* The connection closes when the underlying stream ends, either normally or due to an error.
		*
		* @example
		* ```typescript
		* const connection = new AgentSideConnection(agent, stream);
		*
		* // Listen for closure
		* connection.signal.addEventListener('abort', () => {
		*   console.log('Connection closed - performing cleanup');
		* });
		*
		* // Check status
		* if (connection.signal.aborted) {
		*   console.log('Connection is already closed');
		* }
		*
		* // Pass to other APIs
		* fetch(url, { signal: connection.signal });
		* ```
		*/
		get signal() {
			return this.connection.signal;
		}
		/**
		* Promise that resolves when the connection closes.
		*
		* The connection closes when the underlying stream ends, either normally or due to an error.
		* Once closed, the connection cannot send or receive any more messages.
		*
		* This is useful for async/await style cleanup:
		*
		* @example
		* ```typescript
		* const connection = new AgentSideConnection(agent, stream);
		* await connection.closed;
		* console.log('Connection closed - performing cleanup');
		* ```
		*/
		get closed() {
			return this.connection.closed;
		}
	};
	TerminalHandle = class {
		id;
		sessionId;
		connection;
		constructor(id, sessionId, conn) {
			this.id = id;
			this.sessionId = sessionId;
			this.connection = conn;
		}
		/**
		* Gets the current terminal output without waiting for the command to exit.
		*/
		currentOutput() {
			return this.connection.sendRequest(CLIENT_METHODS.terminal_output, {
				sessionId: this.sessionId,
				terminalId: this.id
			});
		}
		/**
		* Waits for the terminal command to complete and returns its exit status.
		*/
		waitForExit() {
			return this.connection.sendRequest(CLIENT_METHODS.terminal_wait_for_exit, {
				sessionId: this.sessionId,
				terminalId: this.id
			});
		}
		/**
		* Kills the terminal command without releasing the terminal.
		*
		* The terminal remains valid after killing, allowing you to:
		* - Get the final output with `currentOutput()`
		* - Check the exit status
		* - Release the terminal when done
		*
		* Useful for implementing timeouts or cancellation.
		*/
		kill() {
			return this.connection.sendRequest(CLIENT_METHODS.terminal_kill, {
				sessionId: this.sessionId,
				terminalId: this.id
			}, emptyObjectResponse);
		}
		/**
		* Releases the terminal and frees all associated resources.
		*
		* If the command is still running, it will be killed.
		* After release, the terminal ID becomes invalid and cannot be used
		* with other terminal methods.
		*
		* Tool calls that already reference this terminal will continue to
		* display its output.
		*
		* **Important:** Always call this method when done with the terminal.
		*/
		release() {
			return this.connection.sendRequest(CLIENT_METHODS.terminal_release, {
				sessionId: this.sessionId,
				terminalId: this.id
			}, emptyObjectResponse);
		}
		async [Symbol.asyncDispose]() {
			await this.release();
		}
	};
	ClientSideConnection = class {
		connection;
		/**
		* Creates a new client-side connection to an agent.
		*
		* This establishes the communication channel between a client and agent
		* following the ACP specification.
		*
		* @param toClient - A function that creates a Client handler to process incoming agent requests
		* @param stream - The bidirectional message stream for communication. Typically created using
		*                 {@link ndJsonStream} for stdio-based connections.
		*
		* See protocol docs: [Communication Model](https://agentclientprotocol.com/protocol/overview#communication-model)
		*/
		constructor(toClient, stream) {
			const client = toClient(this);
			const requestHandler = async (method, params) => {
				switch (method) {
					case CLIENT_METHODS.fs_write_text_file: {
						const validatedParams = zWriteTextFileRequest.parse(params);
						return await client.writeTextFile?.(validatedParams) ?? {};
					}
					case CLIENT_METHODS.fs_read_text_file: {
						const validatedParams = zReadTextFileRequest.parse(params);
						return client.readTextFile?.(validatedParams);
					}
					case CLIENT_METHODS.session_request_permission: {
						const validatedParams = zRequestPermissionRequest.parse(params);
						return client.requestPermission(validatedParams);
					}
					case CLIENT_METHODS.terminal_create: {
						const validatedParams = zCreateTerminalRequest.parse(params);
						return client.createTerminal?.(validatedParams);
					}
					case CLIENT_METHODS.terminal_output: {
						const validatedParams = zTerminalOutputRequest.parse(params);
						return client.terminalOutput?.(validatedParams);
					}
					case CLIENT_METHODS.terminal_release: {
						const validatedParams = zReleaseTerminalRequest.parse(params);
						return await client.releaseTerminal?.(validatedParams) ?? {};
					}
					case CLIENT_METHODS.terminal_wait_for_exit: {
						const validatedParams = zWaitForTerminalExitRequest.parse(params);
						return client.waitForTerminalExit?.(validatedParams);
					}
					case CLIENT_METHODS.terminal_kill: {
						const validatedParams = zKillTerminalRequest.parse(params);
						return await client.killTerminal?.(validatedParams) ?? {};
					}
					case CLIENT_METHODS.elicitation_create: {
						if (!client.unstable_createElicitation) throw RequestError.methodNotFound(method);
						const validatedParams = zCreateElicitationRequest.parse(params);
						return client.unstable_createElicitation(validatedParams);
					}
					default:
						if (client.extMethod) return client.extMethod(method, params);
						throw RequestError.methodNotFound(method);
				}
			};
			const notificationHandler = async (method, params) => {
				switch (method) {
					case CLIENT_METHODS.session_update: {
						const validatedParams = zSessionNotification.parse(params);
						return client.sessionUpdate(validatedParams);
					}
					case CLIENT_METHODS.elicitation_complete: {
						if (!client.unstable_completeElicitation) return;
						const validatedParams = zCompleteElicitationNotification.parse(params);
						return client.unstable_completeElicitation(validatedParams);
					}
					default:
						if (client.extNotification) return client.extNotification(method, params);
						throw RequestError.methodNotFound(method);
				}
			};
			this.connection = new Connection(requestHandler, notificationHandler, stream);
		}
		/**
		* Establishes the connection with a client and negotiates protocol capabilities.
		*
		* This method is called once at the beginning of the connection to:
		* - Negotiate the protocol version to use
		* - Exchange capability information between client and agent
		* - Determine available authentication methods
		*
		* The agent should respond with its supported protocol version and capabilities.
		*
		* See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
		*/
		initialize(params) {
			return this.connection.sendRequest(AGENT_METHODS.initialize, params);
		}
		/**
		* Creates a new conversation session with the agent.
		*
		* Sessions represent independent conversation contexts with their own history and state.
		*
		* The agent should:
		* - Create a new session context
		* - Connect to any specified MCP servers
		* - Return a unique session ID for future requests
		*
		* The request may include `additionalDirectories` to expand the session's filesystem
		* scope beyond `cwd` without changing the base for relative paths.
		*
		* May return an `auth_required` error if the agent requires authentication.
		*
		* See protocol docs: [Session Setup](https://agentclientprotocol.com/protocol/session-setup)
		*/
		newSession(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_new, params);
		}
		/**
		* Loads an existing session to resume a previous conversation.
		*
		* This method is only available if the agent advertises the `loadSession` capability.
		*
		* The agent should:
		* - Restore the session context and conversation history
		* - Connect to the specified MCP servers
		* - Stream the entire conversation history back to the client via notifications
		*
		* The request may include `additionalDirectories` to set the complete list of
		* additional workspace roots for the loaded session.
		*
		* See protocol docs: [Loading Sessions](https://agentclientprotocol.com/protocol/session-setup#loading-sessions)
		*/
		loadSession(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_load, params, emptyObjectResponse);
		}
		/**
		* **UNSTABLE**
		*
		* This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Forks an existing session to create a new independent session.
		*
		* Creates a new session based on the context of an existing one, allowing
		* operations like generating summaries without affecting the original session's history.
		*
		* The request may include `additionalDirectories` to set the complete list of
		* additional workspace roots for the forked session.
		*
		* This method is only available if the agent advertises the `session.fork` capability.
		*
		* @experimental
		*/
		unstable_forkSession(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_fork, params);
		}
		/**
		* Lists existing sessions from the agent.
		*
		* This method is only available if the agent advertises the `listSessions` capability.
		*
		* Returns a list of sessions with metadata like session ID, working directory,
		* title, and last update time. Supports filtering by working directory,
		* `additionalDirectories`, and cursor-based pagination.
		*/
		listSessions(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_list, params);
		}
		/**
		* Deletes an existing session returned by `session/list`.
		*
		* This method is only available if the agent advertises the `sessionCapabilities.delete` capability.
		*/
		deleteSession(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_delete, params, emptyObjectResponse);
		}
		/**
		* Resumes an existing session without returning previous messages.
		*
		* This method is only available if the agent advertises the `session.resume` capability.
		*
		* The agent should resume the session context, allowing the conversation to continue
		* without replaying the message history (unlike `session/load`).
		*
		* The request may include `additionalDirectories` to set the complete list of
		* additional workspace roots for the resumed session.
		*/
		resumeSession(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_resume, params);
		}
		/**
		* Closes an active session and frees up any resources associated with it.
		*
		* This method is only available if the agent advertises the `session.close` capability.
		*
		* The agent must cancel any ongoing work (as if `session/cancel` was called)
		* and then free up any resources associated with the session.
		*/
		closeSession(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_close, params);
		}
		/**
		* Sets the operational mode for a session.
		*
		* Allows switching between different agent modes (e.g., "ask", "architect", "code")
		* that affect system prompts, tool availability, and permission behaviors.
		*
		* The mode must be one of the modes advertised in `availableModes` during session
		* creation or loading. Agents may also change modes autonomously and notify the
		* client via `current_mode_update` notifications.
		*
		* This method can be called at any time during a session, whether the Agent is
		* idle or actively generating a turn.
		*
		* See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
		*/
		setSessionMode(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_set_mode, params, emptyObjectResponse);
		}
		/**
		* Set a configuration option for a given session.
		*
		* The response contains the full set of configuration options and their current values,
		* as changing one option may affect the available values or state of other options.
		*/
		setSessionConfigOption(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_set_config_option, params);
		}
		/**
		* Authenticates the client using the specified authentication method.
		*
		* Called when the agent requires authentication before allowing session creation.
		* The client provides the authentication method ID that was advertised during initialization.
		*
		* After successful authentication, the client can proceed to create sessions with
		* `newSession` without receiving an `auth_required` error.
		*
		* See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
		*/
		authenticate(params) {
			return this.connection.sendRequest(AGENT_METHODS.authenticate, params, emptyObjectResponse);
		}
		/**
		* **UNSTABLE**
		*
		* This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Lists providers that can be configured by the client.
		*
		* This method is only available if the agent advertises the `providers` capability.
		*
		* @experimental
		*/
		unstable_listProviders(params) {
			return this.connection.sendRequest(AGENT_METHODS.providers_list, params);
		}
		/**
		* **UNSTABLE**
		*
		* This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Replaces the configuration for a provider.
		*
		* This method is only available if the agent advertises the `providers` capability.
		*
		* @experimental
		*/
		unstable_setProvider(params) {
			return this.connection.sendRequest(AGENT_METHODS.providers_set, params, emptyObjectResponse);
		}
		/**
		* **UNSTABLE**
		*
		* This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Disables a provider.
		*
		* This method is only available if the agent advertises the `providers` capability.
		*
		* @experimental
		*/
		unstable_disableProvider(params) {
			return this.connection.sendRequest(AGENT_METHODS.providers_disable, params, emptyObjectResponse);
		}
		/**
		* Logout of the current authentication method.
		*/
		logout(params) {
			return this.connection.sendRequest(AGENT_METHODS.logout, params, emptyObjectResponse);
		}
		/**
		* Processes a user prompt within a session.
		*
		* This method handles the whole lifecycle of a prompt:
		* - Receives user messages with optional context (files, images, etc.)
		* - Processes the prompt using language models
		* - Reports language model content and tool calls to the Clients
		* - Requests permission to run tools
		* - Executes any requested tool calls
		* - Returns when the turn is complete with a stop reason
		*
		* See protocol docs: [Prompt Turn](https://agentclientprotocol.com/protocol/prompt-turn)
		*/
		prompt(params) {
			return this.connection.sendRequest(AGENT_METHODS.session_prompt, params);
		}
		/**
		* Cancels ongoing operations for a session.
		*
		* This is a notification sent by the client to cancel an ongoing prompt turn.
		*
		* Upon receiving this notification, the Agent SHOULD:
		* - Stop all language model requests as soon as possible
		* - Abort all tool call invocations in progress
		* - Send any pending `session/update` notifications
		* - Respond to the original `session/prompt` request with `StopReason::Cancelled`
		*
		* See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/prompt-turn#cancellation)
		*/
		cancel(params) {
			return this.connection.sendNotification(AGENT_METHODS.session_cancel, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Starts a NES (Next Edit Suggestions) session.
		*
		* @experimental
		*/
		unstable_startNes(params) {
			return this.connection.sendRequest(AGENT_METHODS.nes_start, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Sends a NES suggestion request.
		*
		* @experimental
		*/
		unstable_suggestNes(params) {
			return this.connection.sendRequest(AGENT_METHODS.nes_suggest, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Closes a NES session.
		*
		* @experimental
		*/
		unstable_closeNes(params) {
			return this.connection.sendRequest(AGENT_METHODS.nes_close, params, emptyObjectResponse);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Notifies the agent that a document was opened.
		*
		* @experimental
		*/
		unstable_didOpenDocument(params) {
			return this.connection.sendNotification(AGENT_METHODS.document_did_open, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Notifies the agent that a document was changed.
		*
		* @experimental
		*/
		unstable_didChangeDocument(params) {
			return this.connection.sendNotification(AGENT_METHODS.document_did_change, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Notifies the agent that a document was closed.
		*
		* @experimental
		*/
		unstable_didCloseDocument(params) {
			return this.connection.sendNotification(AGENT_METHODS.document_did_close, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Notifies the agent that a document was saved.
		*
		* @experimental
		*/
		unstable_didSaveDocument(params) {
			return this.connection.sendNotification(AGENT_METHODS.document_did_save, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Notifies the agent that a document received focus.
		*
		* @experimental
		*/
		unstable_didFocusDocument(params) {
			return this.connection.sendNotification(AGENT_METHODS.document_did_focus, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Notifies the agent that a NES suggestion was accepted.
		*
		* @experimental
		*/
		unstable_acceptNes(params) {
			return this.connection.sendNotification(AGENT_METHODS.nes_accept, params);
		}
		/**
		* **UNSTABLE**: This capability is not part of the spec yet, and may be removed or changed at any point.
		*
		* Notifies the agent that a NES suggestion was rejected.
		*
		* @experimental
		*/
		unstable_rejectNes(params) {
			return this.connection.sendNotification(AGENT_METHODS.nes_reject, params);
		}
		/**
		* Extension method
		*
		* Allows the Client to send an arbitrary request that is not part of the ACP spec.
		*/
		extMethod(method, params) {
			return this.connection.sendRequest(method, params);
		}
		/**
		* Extension notification
		*
		* Allows the Client to send an arbitrary notification that is not part of the ACP spec.
		*/
		extNotification(method, params) {
			return this.connection.sendNotification(method, params);
		}
		/**
		* AbortSignal that aborts when the connection closes.
		*
		* This signal can be used to:
		* - Listen for connection closure: `connection.signal.addEventListener('abort', () => {...})`
		* - Check connection status synchronously: `if (connection.signal.aborted) {...}`
		* - Pass to other APIs (fetch, setTimeout) for automatic cancellation
		*
		* The connection closes when the underlying stream ends, either normally or due to an error.
		*
		* @example
		* ```typescript
		* const connection = new ClientSideConnection(client, stream);
		*
		* // Listen for closure
		* connection.signal.addEventListener('abort', () => {
		*   console.log('Connection closed - performing cleanup');
		* });
		*
		* // Check status
		* if (connection.signal.aborted) {
		*   console.log('Connection is already closed');
		* }
		*
		* // Pass to other APIs
		* fetch(url, { signal: connection.signal });
		* ```
		*/
		get signal() {
			return this.connection.signal;
		}
		/**
		* Promise that resolves when the connection closes.
		*
		* The connection closes when the underlying stream ends, either normally or due to an error.
		* Once closed, the connection cannot send or receive any more messages.
		*
		* This is useful for async/await style cleanup:
		*
		* @example
		* ```typescript
		* const connection = new ClientSideConnection(client, stream);
		* await connection.closed;
		* console.log('Connection closed - performing cleanup');
		* ```
		*/
		get closed() {
			return this.connection.closed;
		}
	};
	Connection = class {
		pendingResponses = /* @__PURE__ */ new Map();
		nextRequestId = 0;
		requestHandler;
		notificationHandler;
		stream;
		writeQueue = Promise.resolve();
		abortController = new AbortController();
		closedPromise;
		constructor(requestHandler, notificationHandler, stream) {
			this.requestHandler = requestHandler;
			this.notificationHandler = notificationHandler;
			this.stream = stream;
			this.closedPromise = new Promise((resolve) => {
				this.abortController.signal.addEventListener("abort", () => resolve());
			});
			this.receive();
		}
		/**
		* AbortSignal that aborts when the connection closes.
		*
		* This signal can be used to:
		* - Listen for connection closure via event listeners
		* - Check connection status synchronously with `signal.aborted`
		* - Pass to other APIs (fetch, setTimeout) for automatic cancellation
		*/
		get signal() {
			return this.abortController.signal;
		}
		/**
		* Promise that resolves when the connection closes.
		*
		* The connection closes when the underlying stream ends, either normally
		* or due to an error. Once closed, the connection cannot send or receive
		* any more messages.
		*
		* @example
		* ```typescript
		* const connection = new ClientSideConnection(client, stream);
		* await connection.closed;
		* console.log('Connection closed - performing cleanup');
		* ```
		*/
		get closed() {
			return this.closedPromise;
		}
		async receive() {
			let closeError = void 0;
			try {
				const reader = this.stream.readable.getReader();
				try {
					while (!this.abortController.signal.aborted) {
						const { value: message, done } = await reader.read();
						if (done) break;
						if (!message) continue;
						try {
							this.processMessage(message);
						} catch (err) {
							console.error("Unexpected error during message processing:", message, err);
							if ("id" in message && message.id !== void 0) this.sendMessage({
								jsonrpc: "2.0",
								id: message.id,
								error: {
									code: -32700,
									message: "Parse error"
								}
							});
						}
					}
				} finally {
					reader.releaseLock();
				}
			} catch (error) {
				closeError = error;
			} finally {
				this.close(closeError);
			}
		}
		close(error) {
			if (this.abortController.signal.aborted) return;
			const closeError = error ?? /* @__PURE__ */ new Error("ACP connection closed");
			for (const pendingResponse of this.pendingResponses.values()) pendingResponse.reject(closeError);
			this.pendingResponses.clear();
			this.abortController.abort(closeError);
		}
		async processMessage(message) {
			if ("method" in message && "id" in message) {
				const response = await this.tryCallRequestHandler(message.method, message.params);
				if ("error" in response) console.error("Error handling request", message, response.error);
				await this.sendMessage({
					jsonrpc: "2.0",
					id: message.id,
					...response
				});
			} else if ("method" in message) {
				const response = await this.tryCallNotificationHandler(message.method, message.params);
				if ("error" in response) console.error("Error handling notification", message, response.error);
			} else if ("id" in message) this.handleResponse(message);
			else console.error("Invalid message", { message });
		}
		async tryCallRequestHandler(method, params) {
			try {
				return { result: await this.requestHandler(method, params) ?? null };
			} catch (error) {
				if (error instanceof RequestError) return error.toResult();
				if (error instanceof ZodError) return RequestError.invalidParams(error.format()).toResult();
				let details;
				if (error instanceof Error) details = error.message;
				else if (typeof error === "object" && error != null && "message" in error && typeof error.message === "string") details = error.message;
				try {
					return RequestError.internalError(details ? JSON.parse(details) : {}).toResult();
				} catch {
					return RequestError.internalError({ details }).toResult();
				}
			}
		}
		async tryCallNotificationHandler(method, params) {
			try {
				await this.notificationHandler(method, params);
				return { result: null };
			} catch (error) {
				if (error instanceof RequestError) return error.toResult();
				if (error instanceof ZodError) return RequestError.invalidParams(error.format()).toResult();
				let details;
				if (error instanceof Error) details = error.message;
				else if (typeof error === "object" && error != null && "message" in error && typeof error.message === "string") details = error.message;
				try {
					return RequestError.internalError(details ? JSON.parse(details) : {}).toResult();
				} catch {
					return RequestError.internalError({ details }).toResult();
				}
			}
		}
		handleResponse(response) {
			const pendingResponse = this.pendingResponses.get(response.id);
			if (pendingResponse) {
				if ("result" in response) pendingResponse.resolve(response.result);
				else if ("error" in response) {
					const { code, message, data } = response.error;
					pendingResponse.reject(new RequestError(code, message, data));
				}
				this.pendingResponses.delete(response.id);
			} else console.error("Got response to unknown request", response.id);
		}
		sendRequest(method, params, mapResponse) {
			if (this.abortController.signal.aborted) return rejectedPromise(this.closedReason());
			const id = this.nextRequestId++;
			const responsePromise = new Promise((resolve, reject) => {
				this.pendingResponses.set(id, {
					resolve: (response) => {
						try {
							resolve(mapResponse ? mapResponse(response) : response);
						} catch (error) {
							reject(error);
						}
					},
					reject
				});
			});
			responsePromise.catch(() => {});
			this.sendMessage({
				jsonrpc: "2.0",
				id,
				method,
				params
			});
			return responsePromise;
		}
		sendNotification(method, params) {
			if (this.abortController.signal.aborted) return rejectedPromise(this.closedReason());
			return this.sendMessage({
				jsonrpc: "2.0",
				method,
				params
			});
		}
		closedReason() {
			return this.abortController.signal.reason ?? /* @__PURE__ */ new Error("ACP connection closed");
		}
		async sendMessage(message) {
			this.writeQueue = this.writeQueue.then(async () => {
				const writer = this.stream.writable.getWriter();
				try {
					await writer.write(message);
				} finally {
					writer.releaseLock();
				}
			}).catch((error) => {
				this.close(error);
			});
			return this.writeQueue;
		}
	};
	RequestError = class RequestError extends Error {
		code;
		data;
		constructor(code, message, data) {
			super(message);
			this.code = code;
			this.name = "RequestError";
			this.data = data;
		}
		/**
		* Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text.
		*/
		static parseError(data, additionalMessage) {
			return new RequestError(-32700, `Parse error${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
		}
		/**
		* The JSON sent is not a valid Request object.
		*/
		static invalidRequest(data, additionalMessage) {
			return new RequestError(-32600, `Invalid request${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
		}
		/**
		* The method does not exist / is not available.
		*/
		static methodNotFound(method) {
			return new RequestError(-32601, `"Method not found": ${method}`, { method });
		}
		/**
		* Invalid method parameter(s).
		*/
		static invalidParams(data, additionalMessage) {
			return new RequestError(-32602, `Invalid params${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
		}
		/**
		* Internal JSON-RPC error.
		*/
		static internalError(data, additionalMessage) {
			return new RequestError(-32603, `Internal error${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
		}
		/**
		* Authentication required.
		*/
		static authRequired(data, additionalMessage) {
			return new RequestError(-32e3, `Authentication required${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
		}
		/**
		* Resource, such as a file, was not found
		*/
		static resourceNotFound(uri) {
			return new RequestError(-32002, `Resource not found${uri ? `: ${uri}` : ""}`, uri && { uri });
		}
		toResult() {
			return { error: {
				code: this.code,
				message: this.message,
				data: this.data
			} };
		}
		toErrorResponse() {
			return {
				code: this.code,
				message: this.message,
				data: this.data
			};
		}
	};
}))();
export { AGENT_METHODS, AgentSideConnection, CLIENT_METHODS, ClientSideConnection, PROTOCOL_VERSION, RequestError, TerminalHandle, ndJsonStream };
