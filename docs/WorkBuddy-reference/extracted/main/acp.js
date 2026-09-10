require("./chunk.js");
const require_schemas = require("./schemas.js");
//#region ../../node_modules/.pnpm/@agentclientprotocol+sdk@0.25.0_zod@4.3.6/node_modules/@agentclientprotocol/sdk/dist/schema/index.js
var AGENT_METHODS = {
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
var CLIENT_METHODS = {
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
var PROTOCOL_VERSION = 1;
//#endregion
//#region ../../node_modules/.pnpm/@agentclientprotocol+sdk@0.25.0_zod@4.3.6/node_modules/@agentclientprotocol/sdk/dist/schema-deserialize.js
var skippedItem = Symbol("skippedItem");
function defaultOnError(schema, fallback) {
	return schema.catch(fallback);
}
function requiredDefaultOnError(schema, fallback) {
	const schemaWithCatch = schema.catch(fallback);
	return require_schemas.unknown().transform((value, context) => {
		if (value !== void 0) return schemaWithCatch.parse(value);
		context.addIssue({
			code: "custom",
			message: "Required value is missing"
		});
		return require_schemas.NEVER;
	});
}
function vecSkipError(itemSchema) {
	return require_schemas.array(itemSchema.catch(skippedItem)).transform((items) => items.filter((item) => item !== skippedItem));
}
//#endregion
//#region ../../node_modules/.pnpm/@agentclientprotocol+sdk@0.25.0_zod@4.3.6/node_modules/@agentclientprotocol/sdk/dist/schema/zod.gen.js
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Authentication capabilities supported by the client.
*
* Advertised during initialization to inform the agent which authentication
* method types the client can handle. This governs opt-in types that require
* additional client-side support.
*
* @experimental
*/
var zAuthCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	terminal: require_schemas.boolean().optional().default(false)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Describes a single environment variable for an [`AuthMethodEnvVar`] authentication method.
*
* @experimental
*/
var zAuthEnvVar = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	label: require_schemas.string().nullish(),
	name: require_schemas.string(),
	optional: require_schemas.boolean().optional().default(false),
	secret: require_schemas.boolean().optional().default(true)
});
/**
* Agent handles authentication itself.
*
* This is the default authentication method type.
*/
var zAuthMethodAgent = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	description: require_schemas.string().nullish(),
	id: require_schemas.string(),
	name: require_schemas.string()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Environment variable authentication method.
*
* The user provides credentials that the client passes to the agent as environment variables.
*
* @experimental
*/
var zAuthMethodEnvVar = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	description: require_schemas.string().nullish(),
	id: require_schemas.string(),
	link: require_schemas.string().nullish(),
	name: require_schemas.string(),
	vars: require_schemas.array(zAuthEnvVar)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Terminal-based authentication method.
*
* The client runs an interactive terminal for the user to authenticate via a TUI.
*
* @experimental
*/
var zAuthMethodTerminal = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	args: require_schemas.array(require_schemas.string()).optional(),
	description: require_schemas.string().nullish(),
	env: require_schemas.record(require_schemas.string(), require_schemas.string()).optional(),
	id: require_schemas.string(),
	name: require_schemas.string()
});
/**
* Describes an available authentication method.
*
* The `type` field acts as the discriminator in the serialized JSON form.
* When no `type` is present, the method is treated as `agent`.
*/
var zAuthMethod = require_schemas.union([
	zAuthMethodEnvVar.and(require_schemas.object({ type: require_schemas.literal("env_var") })),
	zAuthMethodTerminal.and(require_schemas.object({ type: require_schemas.literal("terminal") })),
	zAuthMethodAgent
]);
/**
* Request parameters for the authenticate method.
*
* Specifies which authentication method to use.
*/
var zAuthenticateRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	methodId: require_schemas.string()
});
/**
* Response to the `authenticate` method.
*/
var zAuthenticateResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Binary resource contents.
*/
var zBlobResourceContents = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	blob: require_schemas.string(),
	mimeType: require_schemas.string().nullish(),
	uri: require_schemas.string()
});
/**
* Schema for boolean properties in an elicitation form.
*/
var zBooleanPropertySchema = require_schemas.object({
	default: require_schemas.boolean().nullish(),
	description: require_schemas.string().nullish(),
	title: require_schemas.string().nullish()
});
/**
* Response from closing an NES session.
*/
var zCloseNesResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Response from closing a session.
*/
var zCloseSessionResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Cost information for a session.
*/
var zCost = require_schemas.object({
	amount: require_schemas.number(),
	currency: require_schemas.string()
});
/**
* Response containing the ID of the created terminal.
*/
var zCreateTerminalResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	terminalId: require_schemas.string()
});
/**
* Response from deleting a session.
*/
var zDeleteSessionResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* A diff representing file modifications.
*
* Shows changes to files in a format suitable for display in the client UI.
*
* See protocol docs: [Content](https://agentclientprotocol.com/protocol/tool-calls#content)
*/
var zDiff = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	newText: require_schemas.string(),
	oldText: require_schemas.string().nullish(),
	path: require_schemas.string()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `providers/disable`.
*
* @experimental
*/
var zDisableProviderRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	id: require_schemas.string()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `providers/disable`.
*
* @experimental
*/
var zDisableProviderResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `mcp/disconnect`.
*
* @experimental
*/
var zDisconnectMcpResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
var zElicitationContentValue = require_schemas.union([
	require_schemas.string(),
	require_schemas.number(),
	require_schemas.number(),
	require_schemas.boolean(),
	require_schemas.array(require_schemas.string())
]);
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* The user accepted the elicitation and provided content.
*
* @experimental
*/
var zElicitationAcceptAction = require_schemas.object({ content: require_schemas.record(require_schemas.string(), zElicitationContentValue).nullish() });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response from the client to an elicitation request.
*
* @experimental
*/
var zCreateElicitationResponse = require_schemas.intersection(require_schemas.union([
	zElicitationAcceptAction.and(require_schemas.object({ action: require_schemas.literal("accept") })),
	require_schemas.object({ action: require_schemas.literal("decline") }),
	require_schemas.object({ action: require_schemas.literal("cancel") })
]), require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() }));
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Form-based elicitation capabilities.
*
* @experimental
*/
var zElicitationFormCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Unique identifier for an elicitation.
*
* @experimental
*/
var zElicitationId = require_schemas.string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Notification sent by the agent when a URL-based elicitation is complete.
*
* @experimental
*/
var zCompleteElicitationNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	elicitationId: zElicitationId
});
/**
* Object schema type.
*/
var zElicitationSchemaType = require_schemas.literal("object");
/**
* String schema type.
*/
var zElicitationStringType = require_schemas.literal("string");
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* URL-based elicitation capabilities.
*
* @experimental
*/
var zElicitationUrlCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Elicitation capabilities supported by the client.
*
* @experimental
*/
var zElicitationCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	form: defaultOnError(zElicitationFormCapabilities.nullish(), () => void 0),
	url: defaultOnError(zElicitationUrlCapabilities.nullish(), () => void 0)
});
/**
* A titled enum option with a const value and human-readable title.
*/
var zEnumOption = require_schemas.object({
	const: require_schemas.string(),
	title: require_schemas.string()
});
/**
* An environment variable to set when launching an MCP server.
*/
var zEnvVariable = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	name: require_schemas.string(),
	value: require_schemas.string()
});
/**
* Predefined error codes for common JSON-RPC and ACP-specific errors.
*
* These codes follow the JSON-RPC 2.0 specification for standard errors
* and use the reserved range (-32000 to -32099) for protocol-specific errors.
*/
var zErrorCode = require_schemas.union([
	require_schemas.literal(-32700),
	require_schemas.literal(-32600),
	require_schemas.literal(-32601),
	require_schemas.literal(-32602),
	require_schemas.literal(-32603),
	require_schemas.literal(-32800),
	require_schemas.literal(-32e3),
	require_schemas.literal(-32002),
	require_schemas.literal(-32042),
	require_schemas.number().int().min(-2147483648, { message: "Invalid value: Expected int32 to be >= -2147483648" }).max(2147483647, { message: "Invalid value: Expected int32 to be <= 2147483647" })
]);
/**
* JSON-RPC error object.
*
* Represents an error that occurred during method execution, following the
* JSON-RPC 2.0 error object specification with optional additional data.
*
* See protocol docs: [JSON-RPC Error Object](https://www.jsonrpc.org/specification#error_object)
*/
var zError = require_schemas.object({
	code: zErrorCode,
	data: require_schemas.unknown().optional(),
	message: require_schemas.string()
});
/**
* Allows the Agent to send an arbitrary notification that is not part of the ACP spec.
* Extension notifications provide a way to send one-way messages for custom functionality
* while maintaining protocol compatibility.
*
* See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
*/
var zExtNotification = require_schemas.unknown();
/**
* Allows for sending an arbitrary request that is not part of the ACP spec.
* Extension methods provide a way to add custom functionality while maintaining
* protocol compatibility.
*
* See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
*/
var zExtRequest = require_schemas.unknown();
/**
* Allows for sending an arbitrary response to an [`ExtRequest`] that is not part of the ACP spec.
* Extension methods provide a way to add custom functionality while maintaining
* protocol compatibility.
*
* See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
*/
var zExtResponse = require_schemas.unknown();
/**
* File system capabilities that a client may support.
*
* See protocol docs: [FileSystem](https://agentclientprotocol.com/protocol/initialization#filesystem)
*/
var zFileSystemCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	readTextFile: require_schemas.boolean().optional().default(false),
	writeTextFile: require_schemas.boolean().optional().default(false)
});
/**
* An HTTP header to set when making requests to the MCP server.
*/
var zHttpHeader = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	name: require_schemas.string(),
	value: require_schemas.string()
});
/**
* Metadata about the implementation of the client or agent.
* Describes the name and version of an MCP implementation, with an optional
* title for UI representation.
*/
var zImplementation = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	name: require_schemas.string(),
	title: require_schemas.string().nullish(),
	version: require_schemas.string()
});
/**
* Schema for integer properties in an elicitation form.
*/
var zIntegerPropertySchema = require_schemas.object({
	default: require_schemas.number().nullish(),
	description: require_schemas.string().nullish(),
	maximum: require_schemas.number().nullish(),
	minimum: require_schemas.number().nullish(),
	title: require_schemas.string().nullish()
});
/**
* Response to `terminal/kill` method
*/
var zKillTerminalResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `providers/list`.
*
* @experimental
*/
var zListProvidersRequest = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Request parameters for listing existing sessions.
*
* Only available if the Agent supports the `sessionCapabilities.list` capability.
*/
var zListSessionsRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	cursor: require_schemas.string().nullish(),
	cwd: require_schemas.string().nullish()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Well-known API protocol identifiers for LLM providers.
*
* Agents and clients MUST handle unknown protocol identifiers gracefully.
*
* Protocol names beginning with `_` are free for custom use, like other ACP extension methods.
* Protocol names that do not begin with `_` are reserved for the ACP spec.
*
* @experimental
*/
var zLlmProtocol = require_schemas.union([
	require_schemas.literal("anthropic"),
	require_schemas.literal("openai"),
	require_schemas.literal("azure"),
	require_schemas.literal("vertex"),
	require_schemas.literal("bedrock"),
	require_schemas.string()
]);
/**
* Logout capabilities supported by the agent.
*
* By supplying `{}` it means that the agent supports the logout method.
*/
var zLogoutCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Authentication-related capabilities supported by the agent.
*/
var zAgentAuthCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	logout: defaultOnError(zLogoutCapabilities.nullish(), () => void 0)
});
/**
* Request parameters for the logout method.
*
* Terminates the current authenticated session.
*/
var zLogoutRequest = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Response to the `logout` method.
*/
var zLogoutResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* MCP capabilities supported by the agent
*/
var zMcpCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	acp: require_schemas.boolean().optional().default(false),
	http: require_schemas.boolean().optional().default(false),
	sse: require_schemas.boolean().optional().default(false)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A unique identifier for an active MCP-over-ACP connection.
*
* @experimental
*/
var zMcpConnectionId = require_schemas.string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `mcp/connect`.
*
* @experimental
*/
var zConnectMcpResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	connectionId: zMcpConnectionId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `mcp/disconnect`.
*
* @experimental
*/
var zDisconnectMcpRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	connectionId: zMcpConnectionId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Unique identifier for an MCP server using the ACP transport.
*
* The value is opaque and generated by the ACP component providing the MCP server. It is
* used by `mcp/connect` to route connection requests back to the component that declared the
* server.
*
* @experimental
*/
var zMcpServerAcpId = require_schemas.string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `mcp/connect`.
*
* @experimental
*/
var zConnectMcpRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	acpId: zMcpServerAcpId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* ACP transport configuration for MCP.
*
* The MCP server is provided by an ACP component and communicates over the ACP channel
* using `mcp/connect`, `mcp/message`, and `mcp/disconnect`.
*
* @experimental
*/
var zMcpServerAcp = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	id: zMcpServerAcpId,
	name: require_schemas.string()
});
/**
* HTTP transport configuration for MCP.
*/
var zMcpServerHttp = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	headers: require_schemas.array(zHttpHeader),
	name: require_schemas.string(),
	url: require_schemas.string()
});
/**
* SSE transport configuration for MCP.
*/
var zMcpServerSse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	headers: require_schemas.array(zHttpHeader),
	name: require_schemas.string(),
	url: require_schemas.string()
});
/**
* Stdio transport configuration for MCP.
*/
var zMcpServerStdio = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	args: require_schemas.array(require_schemas.string()),
	command: require_schemas.string(),
	env: require_schemas.array(zEnvVariable),
	name: require_schemas.string()
});
/**
* Configuration for connecting to an MCP (Model Context Protocol) server.
*
* MCP servers provide tools and context that the agent can use when
* processing prompts.
*
* See protocol docs: [MCP Servers](https://agentclientprotocol.com/protocol/session-setup#mcp-servers)
*/
var zMcpServer = require_schemas.union([
	zMcpServerHttp.and(require_schemas.object({ type: require_schemas.literal("http") })),
	zMcpServerSse.and(require_schemas.object({ type: require_schemas.literal("sse") })),
	zMcpServerAcp.and(require_schemas.object({ type: require_schemas.literal("acp") })),
	zMcpServerStdio
]);
/**
* Unique identifier for a message within a session.
*/
var zMessageId = require_schemas.string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Notification parameters for `mcp/message`.
*
* This is used when the wrapped MCP message is a notification and the outer JSON-RPC
* envelope has no `id`.
*
* @experimental
*/
var zMessageMcpNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	connectionId: zMcpConnectionId,
	method: require_schemas.string(),
	params: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `mcp/message`.
*
* @experimental
*/
var zMessageMcpRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	connectionId: zMcpConnectionId,
	method: require_schemas.string(),
	params: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `mcp/message`.
*
* This is the inner MCP response result payload. Any JSON value is valid.
*
* @experimental
*/
var zMessageMcpResponse = require_schemas.unknown();
/**
* Severity of a diagnostic.
*/
var zNesDiagnosticSeverity = require_schemas.union([
	require_schemas.literal("error"),
	require_schemas.literal("warning"),
	require_schemas.literal("information"),
	require_schemas.literal("hint")
]);
/**
* Capabilities for diagnostics context.
*/
var zNesDiagnosticsCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Marker for `document/didClose` capability support.
*/
var zNesDocumentDidCloseCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Marker for `document/didFocus` capability support.
*/
var zNesDocumentDidFocusCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Marker for `document/didOpen` capability support.
*/
var zNesDocumentDidOpenCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Marker for `document/didSave` capability support.
*/
var zNesDocumentDidSaveCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Capabilities for edit history context.
*/
var zNesEditHistoryCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	maxCount: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish()
});
/**
* An entry in the edit history.
*/
var zNesEditHistoryEntry = require_schemas.object({
	diff: require_schemas.string(),
	uri: require_schemas.string()
});
/**
* A code excerpt from a file.
*/
var zNesExcerpt = require_schemas.object({
	endLine: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }),
	startLine: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }),
	text: require_schemas.string()
});
/**
* Marker for jump suggestion support.
*/
var zNesJumpCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Capabilities for open files context.
*/
var zNesOpenFilesCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* A recently accessed file.
*/
var zNesRecentFile = require_schemas.object({
	languageId: require_schemas.string(),
	text: require_schemas.string(),
	uri: require_schemas.string()
});
/**
* Capabilities for recent files context.
*/
var zNesRecentFilesCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	maxCount: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish()
});
/**
* The reason a suggestion was rejected.
*/
var zNesRejectReason = require_schemas.union([
	require_schemas.literal("rejected"),
	require_schemas.literal("ignored"),
	require_schemas.literal("replaced"),
	require_schemas.literal("cancelled")
]);
/**
* A related code snippet from a file.
*/
var zNesRelatedSnippet = require_schemas.object({
	excerpts: require_schemas.array(zNesExcerpt),
	uri: require_schemas.string()
});
/**
* Capabilities for related snippets context.
*/
var zNesRelatedSnippetsCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Marker for rename suggestion support.
*/
var zNesRenameCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Repository metadata for an NES session.
*/
var zNesRepository = require_schemas.object({
	name: require_schemas.string(),
	owner: require_schemas.string(),
	remoteUrl: require_schemas.string()
});
/**
* Marker for search and replace suggestion support.
*/
var zNesSearchAndReplaceCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* NES capabilities advertised by the client during initialization.
*/
var zClientNesCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	jump: defaultOnError(zNesJumpCapabilities.nullish(), () => void 0),
	rename: defaultOnError(zNesRenameCapabilities.nullish(), () => void 0),
	searchAndReplace: defaultOnError(zNesSearchAndReplaceCapabilities.nullish(), () => void 0)
});
/**
* A search-and-replace suggestion.
*/
var zNesSearchAndReplaceSuggestion = require_schemas.object({
	id: require_schemas.string(),
	isRegex: require_schemas.boolean().nullish(),
	replace: require_schemas.string(),
	search: require_schemas.string(),
	uri: require_schemas.string()
});
/**
* What triggered the suggestion request.
*/
var zNesTriggerKind = require_schemas.union([
	require_schemas.literal("automatic"),
	require_schemas.literal("diagnostic"),
	require_schemas.literal("manual")
]);
/**
* Capabilities for user actions context.
*/
var zNesUserActionsCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	maxCount: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish()
});
/**
* Context capabilities the agent wants attached to each suggestion request.
*/
var zNesContextCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	diagnostics: defaultOnError(zNesDiagnosticsCapabilities.nullish(), () => void 0),
	editHistory: defaultOnError(zNesEditHistoryCapabilities.nullish(), () => void 0),
	openFiles: defaultOnError(zNesOpenFilesCapabilities.nullish(), () => void 0),
	recentFiles: defaultOnError(zNesRecentFilesCapabilities.nullish(), () => void 0),
	relatedSnippets: defaultOnError(zNesRelatedSnippetsCapabilities.nullish(), () => void 0),
	userActions: defaultOnError(zNesUserActionsCapabilities.nullish(), () => void 0)
});
/**
* Request parameters for creating a new session.
*
* See protocol docs: [Creating a Session](https://agentclientprotocol.com/protocol/session-setup#creating-a-session)
*/
var zNewSessionRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	additionalDirectories: require_schemas.array(require_schemas.string()).optional(),
	cwd: require_schemas.string(),
	mcpServers: require_schemas.array(zMcpServer)
});
/**
* Schema for number (floating-point) properties in an elicitation form.
*/
var zNumberPropertySchema = require_schemas.object({
	default: require_schemas.number().nullish(),
	description: require_schemas.string().nullish(),
	maximum: require_schemas.number().nullish(),
	minimum: require_schemas.number().nullish(),
	title: require_schemas.string().nullish()
});
/**
* Unique identifier for a permission option.
*/
var zPermissionOptionId = require_schemas.string();
/**
* The type of permission option being presented to the user.
*
* Helps clients choose appropriate icons and UI treatment.
*/
var zPermissionOptionKind = require_schemas.union([
	require_schemas.literal("allow_once"),
	require_schemas.literal("allow_always"),
	require_schemas.literal("reject_once"),
	require_schemas.literal("reject_always")
]);
/**
* An option presented to the user when requesting permission.
*/
var zPermissionOption = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	kind: zPermissionOptionKind,
	name: require_schemas.string(),
	optionId: zPermissionOptionId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capabilities for receiving `plan_update` and `plan_removed` session updates.
*
* @experimental
*/
var zPlanCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Priority levels for plan entries.
*
* Used to indicate the relative importance or urgency of different
* tasks in the execution plan.
* See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)
*/
var zPlanEntryPriority = require_schemas.union([
	require_schemas.literal("high"),
	require_schemas.literal("medium"),
	require_schemas.literal("low")
]);
/**
* Status of a plan entry in the execution flow.
*
* Tracks the lifecycle of each task from planning through completion.
* See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)
*/
var zPlanEntryStatus = require_schemas.union([
	require_schemas.literal("pending"),
	require_schemas.literal("in_progress"),
	require_schemas.literal("completed")
]);
/**
* A single entry in the execution plan.
*
* Represents a task or goal that the assistant intends to accomplish
* as part of fulfilling the user's request.
* See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)
*/
var zPlanEntry = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	content: require_schemas.string(),
	priority: zPlanEntryPriority,
	status: zPlanEntryStatus
});
/**
* An execution plan for accomplishing complex tasks.
*
* Plans consist of multiple entries representing individual tasks or goals.
* Agents report plans to clients to provide visibility into their execution strategy.
* Plans can evolve during execution as the agent discovers new requirements or completes tasks.
*
* See protocol docs: [Agent Plan](https://agentclientprotocol.com/protocol/agent-plan)
*/
var zPlan = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	entries: requiredDefaultOnError(vecSkipError(zPlanEntry), () => [])
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Unique identifier for a plan within a session.
*
* @experimental
*/
var zPlanId = require_schemas.string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A plan represented by a file URI.
*
* @experimental
*/
var zPlanFile = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	id: zPlanId,
	uri: require_schemas.string()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A plan represented as structured entries.
*
* @experimental
*/
var zPlanItems = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	entries: requiredDefaultOnError(vecSkipError(zPlanEntry), () => []),
	id: zPlanId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A plan represented as raw markdown content.
*
* @experimental
*/
var zPlanMarkdown = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	content: require_schemas.string(),
	id: zPlanId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Removal notice for a plan identified by ID.
*
* @experimental
*/
var zPlanRemoved = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	id: zPlanId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Updated content for a plan.
*
* @experimental
*/
var zPlanUpdateContent = require_schemas.union([
	zPlanItems.and(require_schemas.object({ type: require_schemas.literal("items") })),
	zPlanFile.and(require_schemas.object({ type: require_schemas.literal("file") })),
	zPlanMarkdown.and(require_schemas.object({ type: require_schemas.literal("markdown") }))
]);
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A content update for a plan identified by ID.
*
* @experimental
*/
var zPlanUpdate = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	plan: zPlanUpdateContent
});
/**
* A zero-based position in a text document.
*
* The meaning of `character` depends on the negotiated position encoding.
*/
var zPosition = require_schemas.object({
	character: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }),
	line: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" })
});
/**
* A jump-to-location suggestion.
*/
var zNesJumpSuggestion = require_schemas.object({
	id: require_schemas.string(),
	position: zPosition,
	uri: require_schemas.string()
});
/**
* A rename symbol suggestion.
*/
var zNesRenameSuggestion = require_schemas.object({
	id: require_schemas.string(),
	newName: require_schemas.string(),
	position: zPosition,
	uri: require_schemas.string()
});
/**
* A user action (typing, cursor movement, etc.).
*/
var zNesUserAction = require_schemas.object({
	action: require_schemas.string(),
	position: zPosition,
	timestampMs: require_schemas.number(),
	uri: require_schemas.string()
});
/**
* The encoding used for character offsets in positions.
*
* Follows the same conventions as LSP 3.17. The default is UTF-16.
*/
var zPositionEncodingKind = require_schemas.union([
	require_schemas.literal("utf-16"),
	require_schemas.literal("utf-32"),
	require_schemas.literal("utf-8")
]);
/**
* Capabilities supported by the client.
*
* Advertised during initialization to inform the agent about
* available features and methods.
*
* See protocol docs: [Client Capabilities](https://agentclientprotocol.com/protocol/initialization#client-capabilities)
*/
var zClientCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	auth: zAuthCapabilities.optional().default({ terminal: false }),
	elicitation: defaultOnError(zElicitationCapabilities.nullish(), () => void 0),
	fs: zFileSystemCapabilities.optional().default({
		readTextFile: false,
		writeTextFile: false
	}),
	nes: defaultOnError(zClientNesCapabilities.nullish(), () => void 0),
	plan: defaultOnError(zPlanCapabilities.nullish(), () => void 0),
	positionEncodings: defaultOnError(vecSkipError(zPositionEncodingKind).optional(), () => []),
	terminal: require_schemas.boolean().optional().default(false)
});
/**
* Prompt capabilities supported by the agent in `session/prompt` requests.
*
* Baseline agent functionality requires support for [`ContentBlock::Text`]
* and [`ContentBlock::ResourceLink`] in prompt requests.
*
* Other variants must be explicitly opted in to.
* Capabilities for different types of content in prompt requests.
*
* Indicates which content types beyond the baseline (text and resource links)
* the agent can process.
*
* See protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)
*/
var zPromptCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	audio: require_schemas.boolean().optional().default(false),
	embeddedContext: require_schemas.boolean().optional().default(false),
	image: require_schemas.boolean().optional().default(false)
});
/**
* Protocol version identifier.
*
* This version is only bumped for breaking changes.
* Non-breaking changes should be introduced via capabilities.
*/
var zProtocolVersion = require_schemas.number().int().gte(0).lte(65535);
/**
* Request parameters for the initialize method.
*
* Sent by the client to establish connection and negotiate capabilities.
*
* See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
*/
var zInitializeRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
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
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Current effective non-secret routing configuration for a provider.
*
* @experimental
*/
var zProviderCurrentConfig = require_schemas.object({
	apiType: zLlmProtocol,
	baseUrl: require_schemas.string()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Information about a configurable LLM provider.
*
* @experimental
*/
var zProviderInfo = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	current: zProviderCurrentConfig.nullish(),
	id: require_schemas.string(),
	required: require_schemas.boolean(),
	supported: requiredDefaultOnError(vecSkipError(zLlmProtocol), () => [])
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `providers/list`.
*
* @experimental
*/
var zListProvidersResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	providers: requiredDefaultOnError(vecSkipError(zProviderInfo), () => [])
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Provider configuration capabilities supported by the agent.
*
* By supplying `{}` it means that the agent supports provider configuration methods.
*
* @experimental
*/
var zProvidersCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* A range in a text document, expressed as start and end positions.
*/
var zRange = require_schemas.object({
	end: zPosition,
	start: zPosition
});
/**
* A diagnostic (error, warning, etc.).
*/
var zNesDiagnostic = require_schemas.object({
	message: require_schemas.string(),
	range: zRange,
	severity: zNesDiagnosticSeverity,
	uri: require_schemas.string()
});
/**
* An open file in the editor.
*/
var zNesOpenFile = require_schemas.object({
	languageId: require_schemas.string(),
	lastFocusedMs: defaultOnError(require_schemas.number().nullish(), () => void 0),
	uri: require_schemas.string(),
	visibleRange: defaultOnError(zRange.nullish(), () => void 0)
});
/**
* Context attached to a suggestion request.
*/
var zNesSuggestContext = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	diagnostics: defaultOnError(vecSkipError(zNesDiagnostic).nullish(), () => void 0),
	editHistory: defaultOnError(vecSkipError(zNesEditHistoryEntry).nullish(), () => void 0),
	openFiles: defaultOnError(vecSkipError(zNesOpenFile).nullish(), () => void 0),
	recentFiles: defaultOnError(vecSkipError(zNesRecentFile).nullish(), () => void 0),
	relatedSnippets: defaultOnError(vecSkipError(zNesRelatedSnippet).nullish(), () => void 0),
	userActions: defaultOnError(vecSkipError(zNesUserAction).nullish(), () => void 0)
});
/**
* A text edit within a suggestion.
*/
var zNesTextEdit = require_schemas.object({
	newText: require_schemas.string(),
	range: zRange
});
/**
* A text edit suggestion.
*/
var zNesEditSuggestion = require_schemas.object({
	cursorPosition: defaultOnError(zPosition.nullish(), () => void 0),
	edits: require_schemas.array(zNesTextEdit),
	id: require_schemas.string(),
	uri: require_schemas.string()
});
/**
* A suggestion returned by the agent.
*/
var zNesSuggestion = require_schemas.union([
	zNesEditSuggestion.and(require_schemas.object({ kind: require_schemas.literal("edit") })),
	zNesJumpSuggestion.and(require_schemas.object({ kind: require_schemas.literal("jump") })),
	zNesRenameSuggestion.and(require_schemas.object({ kind: require_schemas.literal("rename") })),
	zNesSearchAndReplaceSuggestion.and(require_schemas.object({ kind: require_schemas.literal("searchAndReplace") }))
]);
/**
* Response containing the contents of a text file.
*/
var zReadTextFileResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	content: require_schemas.string()
});
/**
* Response to terminal/release method
*/
var zReleaseTerminalResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* JSON RPC Request Id
*
* An identifier established by the Client that MUST contain a String, Number, or NULL value if included. If it is not included it is assumed to be a notification. The value SHOULD normally not be Null \[1\] and Numbers SHOULD NOT contain fractional parts \[2\]
*
* The Server MUST reply with the same value in the Response object if included. This member is used to correlate the context between the two objects.
*
* \[1\] The use of Null as a value for the id member in a Request object is discouraged, because this specification uses a value of Null for Responses with an unknown id. Also, because JSON-RPC 1.0 uses an id value of Null for Notifications this could cause confusion in handling.
*
* \[2\] Fractional parts may be problematic, since many decimal fractions cannot be represented exactly as binary fractions.
*/
var zRequestId = require_schemas.union([require_schemas.number(), require_schemas.string()]).nullable();
require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	requestId: zRequestId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request-scoped elicitation, tied to a specific JSON-RPC request outside of a session
* (e.g., during auth/configuration phases before any session is started).
*
* @experimental
*/
var zElicitationRequestScope = require_schemas.object({ requestId: zRequestId });
/**
* The sender or recipient of messages and data in a conversation.
*/
var zRole = require_schemas._enum(["assistant", "user"]);
/**
* Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
*/
var zAnnotations = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	audience: defaultOnError(vecSkipError(zRole).nullish(), () => void 0),
	lastModified: require_schemas.string().nullish(),
	priority: require_schemas.number().nullish()
});
/**
* Audio provided to or from an LLM.
*/
var zAudioContent = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	data: require_schemas.string(),
	mimeType: require_schemas.string()
});
/**
* An image provided to or from an LLM.
*/
var zImageContent = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	data: require_schemas.string(),
	mimeType: require_schemas.string(),
	uri: require_schemas.string().nullish()
});
/**
* A resource that the server is capable of reading, included in a prompt or tool call result.
*/
var zResourceLink = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	description: require_schemas.string().nullish(),
	mimeType: require_schemas.string().nullish(),
	name: require_schemas.string(),
	size: require_schemas.number().nullish(),
	title: require_schemas.string().nullish(),
	uri: require_schemas.string()
});
/**
* The user selected one of the provided options.
*/
var zSelectedPermissionOutcome = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	optionId: zPermissionOptionId
});
/**
* The outcome of a permission request.
*/
var zRequestPermissionOutcome = require_schemas.union([require_schemas.object({ outcome: require_schemas.literal("cancelled") }), zSelectedPermissionOutcome.and(require_schemas.object({ outcome: require_schemas.literal("selected") }))]);
/**
* Response to a permission request.
*/
var zRequestPermissionResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	outcome: zRequestPermissionOutcome
});
/**
* Capabilities for additional session directories support.
*
* By supplying `{}` it means that the agent supports the `additionalDirectories`
* field on supported session lifecycle requests. Agents that also support
* `session/list` may return `SessionInfo.additionalDirectories` to report the
* complete ordered additional-root list associated with a listed session.
*/
var zSessionAdditionalDirectoriesCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Capabilities for the `session/close` method.
*
* By supplying `{}` it means that the agent supports closing of sessions.
*/
var zSessionCloseCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* A boolean on/off toggle session configuration option payload.
*
* @experimental
*/
var zSessionConfigBoolean = require_schemas.object({ currentValue: require_schemas.boolean() });
/**
* Unique identifier for a session configuration option value group.
*/
var zSessionConfigGroupId = require_schemas.string();
/**
* Unique identifier for a session configuration option.
*/
var zSessionConfigId = require_schemas.string();
/**
* Semantic category for a session configuration option.
*
* This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
* session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
* placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
* categories gracefully.
*
* Category names beginning with `_` are free for custom use, like other ACP extension methods.
* Category names that do not begin with `_` are reserved for the ACP spec.
*/
var zSessionConfigOptionCategory = require_schemas.union([
	require_schemas.literal("mode"),
	require_schemas.literal("model"),
	require_schemas.literal("thought_level"),
	require_schemas.string()
]);
/**
* Unique identifier for a session configuration option value.
*/
var zSessionConfigValueId = require_schemas.string();
/**
* A possible value for a session configuration option.
*/
var zSessionConfigSelectOption = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	description: require_schemas.string().nullish(),
	name: require_schemas.string(),
	value: zSessionConfigValueId
});
/**
* A group of possible values for a session configuration option.
*/
var zSessionConfigSelectGroup = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	group: zSessionConfigGroupId,
	name: require_schemas.string(),
	options: require_schemas.array(zSessionConfigSelectOption)
});
/**
* Possible values for a session configuration option.
*/
var zSessionConfigSelectOptions = require_schemas.union([require_schemas.array(zSessionConfigSelectOption), require_schemas.array(zSessionConfigSelectGroup)]);
/**
* A single-value selector (dropdown) session configuration option payload.
*/
var zSessionConfigSelect = require_schemas.object({
	currentValue: zSessionConfigValueId,
	options: zSessionConfigSelectOptions
});
/**
* A session configuration option selector and its current state.
*/
var zSessionConfigOption = require_schemas.intersection(require_schemas.union([zSessionConfigSelect.and(require_schemas.object({ type: require_schemas.literal("select") })), zSessionConfigBoolean.and(require_schemas.object({ type: require_schemas.literal("boolean") }))]), require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	category: defaultOnError(zSessionConfigOptionCategory.nullish(), () => void 0),
	description: require_schemas.string().nullish(),
	id: zSessionConfigId,
	name: require_schemas.string()
}));
/**
* Session configuration options have been updated.
*/
var zConfigOptionUpdate = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	configOptions: requiredDefaultOnError(vecSkipError(zSessionConfigOption), () => [])
});
/**
* Capabilities for the `session/delete` method.
*
* Supplying `{}` means the agent supports deleting sessions from `session/list`.
*/
var zSessionDeleteCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Capabilities for the `session/fork` method.
*
* By supplying `{}` it means that the agent supports forking of sessions.
*
* @experimental
*/
var zSessionForkCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* A unique identifier for a conversation session between a client and agent.
*
* Sessions maintain their own context, conversation history, and state,
* allowing multiple independent interactions with the same agent.
*
* See protocol docs: [Session ID](https://agentclientprotocol.com/protocol/session-setup#session-id)
*/
var zSessionId = require_schemas.string();
/**
* Notification sent when a suggestion is accepted.
*/
var zAcceptNesNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	id: require_schemas.string(),
	sessionId: zSessionId
});
/**
* Notification to cancel ongoing operations for a session.
*
* See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/prompt-turn#cancellation)
*/
var zCancelNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId
});
/**
* Request to close an NES session.
*
* The agent **must** cancel any ongoing work related to the NES session
* and then free up any resources associated with the session.
*/
var zCloseNesRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId
});
/**
* Request parameters for closing an active session.
*
* If supported, the agent **must** cancel any ongoing work related to the session
* (treat it as if `session/cancel` was called) and then free up any resources
* associated with the session.
*
* Only available if the Agent supports the `sessionCapabilities.close` capability.
*/
var zCloseSessionRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId
});
/**
* Request to create a new terminal and execute a command.
*/
var zCreateTerminalRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	args: require_schemas.array(require_schemas.string()).optional(),
	command: require_schemas.string(),
	cwd: require_schemas.string().nullish(),
	env: require_schemas.array(zEnvVariable).optional(),
	outputByteLimit: require_schemas.number().nullish(),
	sessionId: zSessionId
});
/**
* Request parameters for deleting an existing session from `session/list`.
*
* Only available if the Agent supports the `sessionCapabilities.delete` capability.
*/
var zDeleteSessionRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId
});
/**
* Notification sent when a file is closed.
*/
var zDidCloseDocumentNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId,
	uri: require_schemas.string()
});
/**
* Notification sent when a file becomes the active editor tab.
*/
var zDidFocusDocumentNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	position: zPosition,
	sessionId: zSessionId,
	uri: require_schemas.string(),
	version: require_schemas.number(),
	visibleRange: zRange
});
/**
* Notification sent when a file is opened in the editor.
*/
var zDidOpenDocumentNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	languageId: require_schemas.string(),
	sessionId: zSessionId,
	text: require_schemas.string(),
	uri: require_schemas.string(),
	version: require_schemas.number()
});
/**
* Notification sent when a file is saved.
*/
var zDidSaveDocumentNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId,
	uri: require_schemas.string()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for forking an existing session.
*
* Creates a new session based on the context of an existing one, allowing
* operations like generating summaries without affecting the original session's history.
*
* Only available if the Agent supports the `session.fork` capability.
*
* @experimental
*/
var zForkSessionRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	additionalDirectories: require_schemas.array(require_schemas.string()).optional(),
	cwd: require_schemas.string(),
	mcpServers: require_schemas.array(zMcpServer).optional(),
	sessionId: zSessionId
});
/**
* Request to kill a terminal without releasing it.
*/
var zKillTerminalRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId,
	terminalId: require_schemas.string()
});
/**
* Request parameters for loading an existing session.
*
* Only available if the Agent supports the `loadSession` capability.
*
* See protocol docs: [Loading Sessions](https://agentclientprotocol.com/protocol/session-setup#loading-sessions)
*/
var zLoadSessionRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	additionalDirectories: require_schemas.array(require_schemas.string()).optional(),
	cwd: require_schemas.string(),
	mcpServers: require_schemas.array(zMcpServer),
	sessionId: zSessionId
});
/**
* Request to read content from a text file.
*
* Only available if the client supports the `fs.readTextFile` capability.
*/
var zReadTextFileRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	limit: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	line: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	path: require_schemas.string(),
	sessionId: zSessionId
});
/**
* Notification sent when a suggestion is rejected.
*/
var zRejectNesNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	id: require_schemas.string(),
	reason: defaultOnError(zNesRejectReason.nullish(), () => void 0),
	sessionId: zSessionId
});
/**
* Request to release a terminal and free its resources.
*/
var zReleaseTerminalRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId,
	terminalId: require_schemas.string()
});
/**
* Request parameters for resuming an existing session.
*
* Resumes an existing session without returning previous messages (unlike `session/load`).
* This is useful for agents that can resume sessions but don't implement full session loading.
*
* Only available if the Agent supports the `sessionCapabilities.resume` capability.
*/
var zResumeSessionRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	additionalDirectories: require_schemas.array(require_schemas.string()).optional(),
	cwd: require_schemas.string(),
	mcpServers: require_schemas.array(zMcpServer).optional(),
	sessionId: zSessionId
});
/**
* Information about a session returned by session/list
*/
var zSessionInfo = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	additionalDirectories: require_schemas.array(require_schemas.string()).optional(),
	cwd: require_schemas.string(),
	sessionId: zSessionId,
	title: defaultOnError(require_schemas.string().nullish(), () => void 0),
	updatedAt: defaultOnError(require_schemas.string().nullish(), () => void 0)
});
/**
* Response from listing sessions.
*/
var zListSessionsResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	nextCursor: require_schemas.string().nullish(),
	sessions: requiredDefaultOnError(vecSkipError(zSessionInfo), () => [])
});
/**
* Update to session metadata. All fields are optional to support partial updates.
*
* Agents send this notification to update session information like title or custom metadata.
* This allows clients to display dynamic session names and track session state changes.
*/
var zSessionInfoUpdate = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	title: require_schemas.string().nullish(),
	updatedAt: require_schemas.string().nullish()
});
/**
* Capabilities for the `session/list` method.
*
* By supplying `{}` it means that the agent supports listing of sessions.
*/
var zSessionListCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Unique identifier for a Session Mode.
*/
var zSessionModeId = require_schemas.string();
/**
* The current mode of the session has changed
*
* See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
*/
var zCurrentModeUpdate = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	currentModeId: zSessionModeId
});
/**
* A mode the agent can operate in.
*
* See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
*/
var zSessionMode = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	description: require_schemas.string().nullish(),
	id: zSessionModeId,
	name: require_schemas.string()
});
/**
* The set of modes and the one currently active.
*/
var zSessionModeState = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	availableModes: requiredDefaultOnError(vecSkipError(zSessionMode), () => []),
	currentModeId: zSessionModeId
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response from forking an existing session.
*
* @experimental
*/
var zForkSessionResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
	sessionId: zSessionId
});
/**
* Response from loading an existing session.
*/
var zLoadSessionResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0)
});
/**
* Response from creating a new session.
*
* See protocol docs: [Creating a Session](https://agentclientprotocol.com/protocol/session-setup#creating-a-session)
*/
var zNewSessionResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0),
	sessionId: zSessionId
});
/**
* Response from resuming an existing session.
*/
var zResumeSessionResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	configOptions: defaultOnError(vecSkipError(zSessionConfigOption).nullish(), () => void 0),
	modes: defaultOnError(zSessionModeState.nullish(), () => void 0)
});
/**
* Capabilities for the `session/resume` method.
*
* By supplying `{}` it means that the agent supports resuming of sessions.
*/
var zSessionResumeCapabilities = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Session capabilities supported by the agent.
*
* As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
*
* Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
*
* Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
*
* See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
*/
var zSessionCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	additionalDirectories: defaultOnError(zSessionAdditionalDirectoriesCapabilities.nullish(), () => void 0),
	close: defaultOnError(zSessionCloseCapabilities.nullish(), () => void 0),
	delete: defaultOnError(zSessionDeleteCapabilities.nullish(), () => void 0),
	fork: defaultOnError(zSessionForkCapabilities.nullish(), () => void 0),
	list: defaultOnError(zSessionListCapabilities.nullish(), () => void 0),
	resume: defaultOnError(zSessionResumeCapabilities.nullish(), () => void 0)
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request parameters for `providers/set`.
*
* Replaces the full configuration for one provider id.
*
* @experimental
*/
var zSetProviderRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	apiType: zLlmProtocol,
	baseUrl: require_schemas.string(),
	headers: require_schemas.record(require_schemas.string(), require_schemas.string()).optional(),
	id: require_schemas.string()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Response to `providers/set`.
*
* @experimental
*/
var zSetProviderResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Request parameters for setting a session configuration option.
*/
var zSetSessionConfigOptionRequest = require_schemas.intersection(require_schemas.union([require_schemas.object({
	type: require_schemas.literal("boolean"),
	value: require_schemas.boolean()
}), require_schemas.object({ value: zSessionConfigValueId })]), require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	configId: zSessionConfigId,
	sessionId: zSessionId
}));
/**
* Response to `session/set_config_option` method.
*/
var zSetSessionConfigOptionResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	configOptions: requiredDefaultOnError(vecSkipError(zSessionConfigOption), () => [])
});
/**
* Request parameters for setting a session mode.
*/
var zSetSessionModeRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	modeId: zSessionModeId,
	sessionId: zSessionId
});
/**
* Response to `session/set_mode` method.
*/
var zSetSessionModeResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
/**
* Response to `nes/start`.
*/
var zStartNesResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId
});
/**
* Reasons why an agent stops processing a prompt turn.
*
* See protocol docs: [Stop Reasons](https://agentclientprotocol.com/protocol/prompt-turn#stop-reasons)
*/
var zStopReason = require_schemas.union([
	require_schemas.literal("end_turn"),
	require_schemas.literal("max_tokens"),
	require_schemas.literal("max_turn_requests"),
	require_schemas.literal("refusal"),
	require_schemas.literal("cancelled")
]);
/**
* String format types for string properties in elicitation schemas.
*/
var zStringFormat = require_schemas.union([
	require_schemas.literal("email"),
	require_schemas.literal("uri"),
	require_schemas.literal("date"),
	require_schemas.literal("date-time")
]);
/**
* Schema for string properties in an elicitation form.
*
* When `enum` or `oneOf` is set, this represents a single-select enum
* with `"type": "string"`.
*/
var zStringPropertySchema = require_schemas.object({
	default: require_schemas.string().nullish(),
	description: require_schemas.string().nullish(),
	enum: require_schemas.array(require_schemas.string()).nullish(),
	format: zStringFormat.nullish(),
	maxLength: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	minLength: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	oneOf: require_schemas.array(zEnumOption).nullish(),
	pattern: require_schemas.string().nullish(),
	title: require_schemas.string().nullish()
});
/**
* Request for a code suggestion.
*/
var zSuggestNesRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	context: defaultOnError(zNesSuggestContext.nullish(), () => void 0),
	position: zPosition,
	selection: defaultOnError(zRange.nullish(), () => void 0),
	sessionId: zSessionId,
	triggerKind: zNesTriggerKind,
	uri: require_schemas.string(),
	version: require_schemas.number()
});
/**
* Response to `nes/suggest`.
*/
var zSuggestNesResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	suggestions: requiredDefaultOnError(vecSkipError(zNesSuggestion), () => [])
});
/**
* Embed a terminal created with `terminal/create` by its id.
*
* The terminal must be added before calling `terminal/release`.
*
* See protocol docs: [Terminal](https://agentclientprotocol.com/protocol/terminals)
*/
var zTerminal = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	terminalId: require_schemas.string()
});
/**
* Exit status of a terminal command.
*/
var zTerminalExitStatus = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	exitCode: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	signal: require_schemas.string().nullish()
});
/**
* Request to get the current output and status of a terminal.
*/
var zTerminalOutputRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId,
	terminalId: require_schemas.string()
});
/**
* Response containing the terminal output and exit status.
*/
var zTerminalOutputResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	exitStatus: zTerminalExitStatus.nullish(),
	output: require_schemas.string(),
	truncated: require_schemas.boolean()
});
/**
* Text provided to or from an LLM.
*/
var zTextContent = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	text: require_schemas.string()
});
/**
* A content change event for a document.
*
* When `range` is `None`, `text` is the full content of the document.
* When `range` is `Some`, `text` replaces the given range.
*/
var zTextDocumentContentChangeEvent = require_schemas.object({
	range: zRange.nullish(),
	text: require_schemas.string()
});
/**
* Notification sent when a file is edited.
*/
var zDidChangeDocumentNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	contentChanges: require_schemas.array(zTextDocumentContentChangeEvent),
	sessionId: zSessionId,
	uri: require_schemas.string(),
	version: require_schemas.number()
});
require_schemas.object({
	method: require_schemas.string(),
	params: require_schemas.union([
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
/**
* How the agent wants document changes delivered.
*/
var zTextDocumentSyncKind = require_schemas.union([require_schemas.literal("full"), require_schemas.literal("incremental")]);
/**
* Capabilities for `document/didChange` events.
*/
var zNesDocumentDidChangeCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	syncKind: zTextDocumentSyncKind
});
/**
* Document event capabilities the agent wants to receive.
*/
var zNesDocumentEventCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	didChange: defaultOnError(zNesDocumentDidChangeCapabilities.nullish(), () => void 0),
	didClose: defaultOnError(zNesDocumentDidCloseCapabilities.nullish(), () => void 0),
	didFocus: defaultOnError(zNesDocumentDidFocusCapabilities.nullish(), () => void 0),
	didOpen: defaultOnError(zNesDocumentDidOpenCapabilities.nullish(), () => void 0),
	didSave: defaultOnError(zNesDocumentDidSaveCapabilities.nullish(), () => void 0)
});
/**
* Event capabilities the agent can consume.
*/
var zNesEventCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	document: defaultOnError(zNesDocumentEventCapabilities.nullish(), () => void 0)
});
/**
* NES capabilities advertised by the agent during initialization.
*/
var zNesCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	context: defaultOnError(zNesContextCapabilities.nullish(), () => void 0),
	events: defaultOnError(zNesEventCapabilities.nullish(), () => void 0)
});
/**
* Capabilities supported by the agent.
*
* Advertised during initialization to inform the client about
* available features and content types.
*
* See protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)
*/
var zAgentCapabilities = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	auth: zAgentAuthCapabilities.optional().default({}),
	loadSession: require_schemas.boolean().optional().default(false),
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
/**
* Response to the `initialize` method.
*
* Contains the negotiated protocol version and agent capabilities.
*
* See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
*/
var zInitializeResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
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
/**
* Text-based resource contents.
*/
var zTextResourceContents = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	mimeType: require_schemas.string().nullish(),
	text: require_schemas.string(),
	uri: require_schemas.string()
});
/**
* Resource content that can be embedded in a message.
*/
var zEmbeddedResourceResource = require_schemas.union([zTextResourceContents, zBlobResourceContents]);
/**
* The contents of a resource, embedded into a prompt or tool call result.
*/
var zEmbeddedResource = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	annotations: defaultOnError(zAnnotations.nullish(), () => void 0),
	resource: zEmbeddedResourceResource
});
/**
* Content blocks represent displayable information in the Agent Client Protocol.
*
* They provide a structured way to handle various types of user-facing content—whether
* it's text from language models, images for analysis, or embedded resources for context.
*
* Content blocks appear in:
* - User prompts sent via `session/prompt`
* - Language model output streamed through `session/update` notifications
* - Progress updates and results from tool calls
*
* This structure is compatible with the Model Context Protocol (MCP), enabling
* agents to seamlessly forward content from MCP tool outputs without transformation.
*
* See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
*/
var zContentBlock = require_schemas.union([
	zTextContent.and(require_schemas.object({ type: require_schemas.literal("text") })),
	zImageContent.and(require_schemas.object({ type: require_schemas.literal("image") })),
	zAudioContent.and(require_schemas.object({ type: require_schemas.literal("audio") })),
	zResourceLink.and(require_schemas.object({ type: require_schemas.literal("resource_link") })),
	zEmbeddedResource.and(require_schemas.object({ type: require_schemas.literal("resource") }))
]);
/**
* Standard content block (text, images, resources).
*/
var zContent = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	content: zContentBlock
});
/**
* A streamed item of content
*/
var zContentChunk = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	content: zContentBlock,
	messageId: zMessageId.nullish()
});
/**
* Request parameters for sending a user prompt to the agent.
*
* Contains the user's message and any additional context.
*
* See protocol docs: [User Message](https://agentclientprotocol.com/protocol/prompt-turn#1-user-message)
*/
var zPromptRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	prompt: require_schemas.array(zContentBlock),
	sessionId: zSessionId
});
/**
* Items definition for titled multi-select enum properties.
*/
var zTitledMultiSelectItems = require_schemas.object({ anyOf: require_schemas.array(zEnumOption) });
/**
* Content produced by a tool call.
*
* Tool calls can produce different types of content including
* standard content blocks (text, images) or file diffs.
*
* See protocol docs: [Content](https://agentclientprotocol.com/protocol/tool-calls#content)
*/
var zToolCallContent = require_schemas.union([
	zContent.and(require_schemas.object({ type: require_schemas.literal("content") })),
	zDiff.and(require_schemas.object({ type: require_schemas.literal("diff") })),
	zTerminal.and(require_schemas.object({ type: require_schemas.literal("terminal") }))
]);
/**
* Unique identifier for a tool call within a session.
*/
var zToolCallId = require_schemas.string();
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Session-scoped elicitation, optionally tied to a specific tool call.
*
* When `tool_call_id` is set, the elicitation is tied to a specific tool call.
* This is useful when an agent receives an elicitation from an MCP server
* during a tool call and needs to redirect it to the user.
*
* @experimental
*/
var zElicitationSessionScope = require_schemas.object({
	sessionId: zSessionId,
	toolCallId: zToolCallId.nullish()
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* URL-based elicitation mode where the client directs the user to a URL.
*
* @experimental
*/
var zElicitationUrlMode = require_schemas.intersection(require_schemas.union([zElicitationSessionScope, zElicitationRequestScope]), require_schemas.object({
	elicitationId: zElicitationId,
	url: require_schemas.string().url()
}));
/**
* A file location being accessed or modified by a tool.
*
* Enables clients to implement "follow-along" features that track
* which files the agent is working with in real-time.
*
* See protocol docs: [Following the Agent](https://agentclientprotocol.com/protocol/tool-calls#following-the-agent)
*/
var zToolCallLocation = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	line: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	path: require_schemas.string()
});
/**
* Execution status of a tool call.
*
* Tool calls progress through different statuses during their lifecycle.
*
* See protocol docs: [Status](https://agentclientprotocol.com/protocol/tool-calls#status)
*/
var zToolCallStatus = require_schemas.union([
	require_schemas.literal("pending"),
	require_schemas.literal("in_progress"),
	require_schemas.literal("completed"),
	require_schemas.literal("failed")
]);
/**
* Categories of tools that can be invoked.
*
* Tool kinds help clients choose appropriate icons and optimize how they
* display tool execution progress.
*
* See protocol docs: [Creating](https://agentclientprotocol.com/protocol/tool-calls#creating)
*/
var zToolKind = require_schemas.union([
	require_schemas.literal("read"),
	require_schemas.literal("edit"),
	require_schemas.literal("delete"),
	require_schemas.literal("move"),
	require_schemas.literal("search"),
	require_schemas.literal("execute"),
	require_schemas.literal("think"),
	require_schemas.literal("fetch"),
	require_schemas.literal("switch_mode"),
	require_schemas.literal("other")
]);
/**
* Represents a tool call that the language model has requested.
*
* Tool calls are actions that the agent executes on behalf of the language model,
* such as reading files, executing code, or fetching data from external sources.
*
* See protocol docs: [Tool Calls](https://agentclientprotocol.com/protocol/tool-calls)
*/
var zToolCall = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	content: defaultOnError(vecSkipError(zToolCallContent).optional(), () => []),
	kind: zToolKind.optional(),
	locations: defaultOnError(vecSkipError(zToolCallLocation).optional(), () => []),
	rawInput: require_schemas.unknown().optional(),
	rawOutput: require_schemas.unknown().optional(),
	status: zToolCallStatus.optional(),
	title: require_schemas.string(),
	toolCallId: zToolCallId
});
/**
* An update to an existing tool call.
*
* Used to report progress and results as tools execute. All fields except
* the tool call ID are optional - only changed fields need to be included.
*
* See protocol docs: [Updating](https://agentclientprotocol.com/protocol/tool-calls#updating)
*/
var zToolCallUpdate = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	content: defaultOnError(vecSkipError(zToolCallContent).nullish(), () => void 0),
	kind: defaultOnError(zToolKind.nullish(), () => void 0),
	locations: defaultOnError(vecSkipError(zToolCallLocation).nullish(), () => void 0),
	rawInput: require_schemas.unknown().optional(),
	rawOutput: require_schemas.unknown().optional(),
	status: defaultOnError(zToolCallStatus.nullish(), () => void 0),
	title: require_schemas.string().nullish(),
	toolCallId: zToolCallId
});
/**
* Request for user permission to execute a tool call.
*
* Sent when the agent needs authorization before performing a sensitive operation.
*
* See protocol docs: [Requesting Permission](https://agentclientprotocol.com/protocol/tool-calls#requesting-permission)
*/
var zRequestPermissionRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	options: require_schemas.array(zPermissionOption),
	sessionId: zSessionId,
	toolCall: zToolCallUpdate
});
/**
* unstructured
*
* All text that was typed after the command name is provided as input.
*/
var zAvailableCommandInput = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	hint: require_schemas.string()
});
/**
* Information about a command.
*/
var zAvailableCommand = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	description: require_schemas.string(),
	input: defaultOnError(zAvailableCommandInput.nullish(), () => void 0),
	name: require_schemas.string()
});
/**
* Available commands are ready or have changed
*/
var zAvailableCommandsUpdate = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	availableCommands: requiredDefaultOnError(vecSkipError(zAvailableCommand), () => [])
});
/**
* Items definition for untitled multi-select enum properties.
*/
var zUntitledMultiSelectItems = require_schemas.object({
	enum: require_schemas.array(require_schemas.string()),
	type: zElicitationStringType
});
/**
* Items for a multi-select (array) property schema.
*/
var zMultiSelectItems = require_schemas.union([zUntitledMultiSelectItems, zTitledMultiSelectItems]);
/**
* Schema for multi-select (array) properties in an elicitation form.
*/
var zMultiSelectPropertySchema = require_schemas.object({
	default: require_schemas.array(require_schemas.string()).nullish(),
	description: require_schemas.string().nullish(),
	items: zMultiSelectItems,
	maxItems: require_schemas.number().nullish(),
	minItems: require_schemas.number().nullish(),
	title: require_schemas.string().nullish()
});
/**
* Property schema for elicitation form fields.
*
* Each variant corresponds to a JSON Schema `"type"` value.
* Single-select enums use the `String` variant with `enum` or `oneOf` set.
* Multi-select enums use the `Array` variant.
*/
var zElicitationPropertySchema = require_schemas.union([
	zStringPropertySchema.and(require_schemas.object({ type: require_schemas.literal("string") })),
	zNumberPropertySchema.and(require_schemas.object({ type: require_schemas.literal("number") })),
	zIntegerPropertySchema.and(require_schemas.object({ type: require_schemas.literal("integer") })),
	zBooleanPropertySchema.and(require_schemas.object({ type: require_schemas.literal("boolean") })),
	zMultiSelectPropertySchema.and(require_schemas.object({ type: require_schemas.literal("array") }))
]);
/**
* Type-safe elicitation schema for requesting structured user input.
*
* This represents a JSON Schema object with primitive-typed properties,
* as required by the elicitation specification.
*/
var zElicitationSchema = require_schemas.object({
	description: require_schemas.string().nullish(),
	properties: require_schemas.record(require_schemas.string(), zElicitationPropertySchema).optional().default({}),
	required: require_schemas.array(require_schemas.string()).nullish(),
	title: require_schemas.string().nullish(),
	type: zElicitationSchemaType.optional().default("object")
});
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Form-based elicitation mode where the client renders a form from the provided schema.
*
* @experimental
*/
var zElicitationFormMode = require_schemas.intersection(require_schemas.union([zElicitationSessionScope, zElicitationRequestScope]), require_schemas.object({ requestedSchema: zElicitationSchema }));
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Request from the agent to elicit structured user input.
*
* The agent sends this to the client to request information from the user,
* either via a form or by directing them to a URL.
* Elicitations are tied to a session (optionally a tool call) or a request.
*
* @experimental
*/
var zCreateElicitationRequest = require_schemas.intersection(require_schemas.union([zElicitationFormMode.and(require_schemas.object({ mode: require_schemas.literal("form") })), zElicitationUrlMode.and(require_schemas.object({ mode: require_schemas.literal("url") }))]), require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	message: require_schemas.string()
}));
/**
* **UNSTABLE**
*
* This capability is not part of the spec yet, and may be removed or changed at any point.
*
* Token usage information for a prompt turn.
*
* @experimental
*/
var zUsage = require_schemas.object({
	cachedReadTokens: require_schemas.number().nullish(),
	cachedWriteTokens: require_schemas.number().nullish(),
	inputTokens: require_schemas.number(),
	outputTokens: require_schemas.number(),
	thoughtTokens: require_schemas.number().nullish(),
	totalTokens: require_schemas.number()
});
/**
* Response from processing a user prompt.
*
* See protocol docs: [Check for Completion](https://agentclientprotocol.com/protocol/prompt-turn#4-check-for-completion)
*/
var zPromptResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	stopReason: zStopReason,
	usage: defaultOnError(zUsage.nullish(), () => void 0)
});
require_schemas.union([require_schemas.object({
	id: zRequestId,
	result: require_schemas.union([
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
}), require_schemas.object({
	error: zError,
	id: zRequestId
})]);
/**
* Context window and cost update for a session.
*/
var zUsageUpdate = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	cost: defaultOnError(zCost.nullish(), () => void 0),
	size: require_schemas.number(),
	used: require_schemas.number()
});
/**
* Different types of updates that can be sent during session processing.
*
* These updates provide real-time feedback about the agent's progress.
*
* See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)
*/
var zSessionUpdate = require_schemas.union([
	zContentChunk.and(require_schemas.object({ sessionUpdate: require_schemas.literal("user_message_chunk") })),
	zContentChunk.and(require_schemas.object({ sessionUpdate: require_schemas.literal("agent_message_chunk") })),
	zContentChunk.and(require_schemas.object({ sessionUpdate: require_schemas.literal("agent_thought_chunk") })),
	zToolCall.and(require_schemas.object({ sessionUpdate: require_schemas.literal("tool_call") })),
	zToolCallUpdate.and(require_schemas.object({ sessionUpdate: require_schemas.literal("tool_call_update") })),
	zPlan.and(require_schemas.object({ sessionUpdate: require_schemas.literal("plan") })),
	zPlanUpdate.and(require_schemas.object({ sessionUpdate: require_schemas.literal("plan_update") })),
	zPlanRemoved.and(require_schemas.object({ sessionUpdate: require_schemas.literal("plan_removed") })),
	zAvailableCommandsUpdate.and(require_schemas.object({ sessionUpdate: require_schemas.literal("available_commands_update") })),
	zCurrentModeUpdate.and(require_schemas.object({ sessionUpdate: require_schemas.literal("current_mode_update") })),
	zConfigOptionUpdate.and(require_schemas.object({ sessionUpdate: require_schemas.literal("config_option_update") })),
	zSessionInfoUpdate.and(require_schemas.object({ sessionUpdate: require_schemas.literal("session_info_update") })),
	zUsageUpdate.and(require_schemas.object({ sessionUpdate: require_schemas.literal("usage_update") }))
]);
/**
* Notification containing a session update from the agent.
*
* Used to stream real-time progress and results during prompt processing.
*
* See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)
*/
var zSessionNotification = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId,
	update: zSessionUpdate
});
require_schemas.object({
	method: require_schemas.string(),
	params: require_schemas.union([
		zSessionNotification,
		zCompleteElicitationNotification,
		zMessageMcpNotification,
		zExtNotification
	]).nullish()
});
/**
* Request to wait for a terminal command to exit.
*/
var zWaitForTerminalExitRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	sessionId: zSessionId,
	terminalId: require_schemas.string()
});
/**
* Response containing the exit status of a terminal command.
*/
var zWaitForTerminalExitResponse = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	exitCode: require_schemas.number().int().gte(0).max(4294967295, { message: "Invalid value: Expected uint32 to be <= 4294967295" }).nullish(),
	signal: require_schemas.string().nullish()
});
/**
* A workspace folder.
*/
var zWorkspaceFolder = require_schemas.object({
	name: require_schemas.string(),
	uri: require_schemas.string()
});
/**
* Request to start an NES session.
*/
var zStartNesRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	repository: defaultOnError(zNesRepository.nullish(), () => void 0),
	workspaceFolders: defaultOnError(vecSkipError(zWorkspaceFolder).nullish(), () => void 0),
	workspaceUri: require_schemas.string().nullish()
});
require_schemas.object({
	id: zRequestId,
	method: require_schemas.string(),
	params: require_schemas.union([
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
/**
* Request to write content to a text file.
*
* Only available if the client supports the `fs.writeTextFile` capability.
*/
var zWriteTextFileRequest = require_schemas.object({
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish(),
	content: require_schemas.string(),
	path: require_schemas.string(),
	sessionId: zSessionId
});
require_schemas.object({
	id: zRequestId,
	method: require_schemas.string(),
	params: require_schemas.union([
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
/**
* Response to `fs/write_text_file`
*/
var zWriteTextFileResponse = require_schemas.object({ _meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).nullish() });
require_schemas.union([require_schemas.object({
	id: zRequestId,
	result: require_schemas.union([
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
}), require_schemas.object({
	error: zError,
	id: zRequestId
})]);
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
/**
* An agent-side connection to a client.
*
* This class provides the agent's view of an ACP connection, allowing
* agents to communicate with clients. It implements the {@link Client} interface
* to provide methods for requesting permissions, accessing the file system,
* and sending session updates.
*
* See protocol docs: [Agent](https://agentclientprotocol.com/protocol/overview#agent)
*/
var AgentSideConnection = class {
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
/**
* Handle for controlling and monitoring a terminal created via `createTerminal`.
*
* Provides methods to:
* - Get current output without waiting
* - Wait for command completion
* - Kill the running command
* - Release terminal resources
*
* **Important:** Always call `release()` when done with the terminal to free resources.

* The terminal supports async disposal via `Symbol.asyncDispose` for automatic cleanup.

* You can use `await using` to ensure the terminal is automatically released when it
* goes out of scope.
*/
var TerminalHandle = class {
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
/**
* A client-side connection to an agent.
*
* This class provides the client's view of an ACP connection, allowing
* clients (such as code editors) to communicate with agents. It implements
* the {@link Agent} interface to provide methods for initializing sessions, sending
* prompts, and managing the agent lifecycle.
*
* See protocol docs: [Client](https://agentclientprotocol.com/protocol/overview#client)
*/
var ClientSideConnection = class {
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
var Connection = class {
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
			if (error instanceof require_schemas.ZodError) return RequestError.invalidParams(error.format()).toResult();
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
			if (error instanceof require_schemas.ZodError) return RequestError.invalidParams(error.format()).toResult();
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
/**
* JSON-RPC error object.
*
* Represents an error that occurred during method execution, following the
* JSON-RPC 2.0 error object specification with optional additional data.
*
* See protocol docs: [JSON-RPC Error Object](https://www.jsonrpc.org/specification#error_object)
*/
var RequestError = class RequestError extends Error {
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
//#endregion
exports.AGENT_METHODS = AGENT_METHODS;
exports.AgentSideConnection = AgentSideConnection;
exports.CLIENT_METHODS = CLIENT_METHODS;
exports.ClientSideConnection = ClientSideConnection;
exports.PROTOCOL_VERSION = PROTOCOL_VERSION;
exports.RequestError = RequestError;
exports.TerminalHandle = TerminalHandle;
exports.ndJsonStream = ndJsonStream;
