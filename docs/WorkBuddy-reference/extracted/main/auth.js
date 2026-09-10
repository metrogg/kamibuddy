const require_chunk = require("./chunk.js");
const require_schemas = require("./schemas.js");
//#region ../../node_modules/.pnpm/zod@4.3.6/node_modules/zod/v4/classic/compat.js
/** @deprecated Use the raw string literal codes instead, e.g. "invalid_type". */
var ZodIssueCode = {
	invalid_type: "invalid_type",
	too_big: "too_big",
	too_small: "too_small",
	invalid_format: "invalid_format",
	not_multiple_of: "not_multiple_of",
	unrecognized_keys: "unrecognized_keys",
	invalid_union: "invalid_union",
	invalid_key: "invalid_key",
	invalid_element: "invalid_element",
	invalid_value: "invalid_value",
	custom: "custom"
};
/** @deprecated Do not use. Stub definition, only included for zod-to-json-schema compatibility. */
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind) {})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
//#endregion
//#region ../../node_modules/.pnpm/zod@4.3.6/node_modules/zod/v4/classic/coerce.js
function number(params) {
	return require_schemas._coercedNumber(require_schemas.ZodNumber, params);
}
//#endregion
//#region ../../node_modules/.pnpm/@modelcontextprotocol+sdk@1_d0245f20ef3dec26d553fa86b4caf24e/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js
var LATEST_PROTOCOL_VERSION = "2025-11-25";
var DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26";
var SUPPORTED_PROTOCOL_VERSIONS = [
	LATEST_PROTOCOL_VERSION,
	"2025-06-18",
	"2025-03-26",
	"2024-11-05",
	"2024-10-07"
];
var RELATED_TASK_META_KEY = "io.modelcontextprotocol/related-task";
/**
* Assert 'object' type schema.
*
* @internal
*/
var AssertObjectSchema = require_schemas.custom((v) => v !== null && (typeof v === "object" || typeof v === "function"));
/**
* A progress token, used to associate progress notifications with the original request.
*/
var ProgressTokenSchema = require_schemas.union([require_schemas.string(), require_schemas.number().int()]);
/**
* An opaque token used to represent a cursor for pagination.
*/
var CursorSchema = require_schemas.string();
require_schemas.looseObject({
	ttl: require_schemas.number().optional(),
	pollInterval: require_schemas.number().optional()
});
var TaskMetadataSchema = require_schemas.object({ ttl: require_schemas.number().optional() });
/**
* Metadata for associating messages with a task.
* Include this in the `_meta` field under the key `io.modelcontextprotocol/related-task`.
*/
var RelatedTaskMetadataSchema = require_schemas.object({ taskId: require_schemas.string() });
var RequestMetaSchema = require_schemas.looseObject({
	progressToken: ProgressTokenSchema.optional(),
	[RELATED_TASK_META_KEY]: RelatedTaskMetadataSchema.optional()
});
/**
* Common params for any request.
*/
var BaseRequestParamsSchema = require_schemas.object({ _meta: RequestMetaSchema.optional() });
/**
* Common params for any task-augmented request.
*/
var TaskAugmentedRequestParamsSchema = BaseRequestParamsSchema.extend({ task: TaskMetadataSchema.optional() });
/**
* Checks if a value is a valid TaskAugmentedRequestParams.
* @param value - The value to check.
*
* @returns True if the value is a valid TaskAugmentedRequestParams, false otherwise.
*/
var isTaskAugmentedRequestParams = (value) => TaskAugmentedRequestParamsSchema.safeParse(value).success;
var RequestSchema = require_schemas.object({
	method: require_schemas.string(),
	params: BaseRequestParamsSchema.loose().optional()
});
var NotificationsParamsSchema = require_schemas.object({ _meta: RequestMetaSchema.optional() });
var NotificationSchema = require_schemas.object({
	method: require_schemas.string(),
	params: NotificationsParamsSchema.loose().optional()
});
var ResultSchema = require_schemas.looseObject({ _meta: RequestMetaSchema.optional() });
/**
* A uniquely identifying ID for a request in JSON-RPC.
*/
var RequestIdSchema = require_schemas.union([require_schemas.string(), require_schemas.number().int()]);
/**
* A request that expects a response.
*/
var JSONRPCRequestSchema = require_schemas.object({
	jsonrpc: require_schemas.literal("2.0"),
	id: RequestIdSchema,
	...RequestSchema.shape
}).strict();
var isJSONRPCRequest = (value) => JSONRPCRequestSchema.safeParse(value).success;
/**
* A notification which does not expect a response.
*/
var JSONRPCNotificationSchema = require_schemas.object({
	jsonrpc: require_schemas.literal("2.0"),
	...NotificationSchema.shape
}).strict();
var isJSONRPCNotification = (value) => JSONRPCNotificationSchema.safeParse(value).success;
/**
* A successful (non-error) response to a request.
*/
var JSONRPCResultResponseSchema = require_schemas.object({
	jsonrpc: require_schemas.literal("2.0"),
	id: RequestIdSchema,
	result: ResultSchema
}).strict();
/**
* Checks if a value is a valid JSONRPCResultResponse.
* @param value - The value to check.
*
* @returns True if the value is a valid JSONRPCResultResponse, false otherwise.
*/
var isJSONRPCResultResponse = (value) => JSONRPCResultResponseSchema.safeParse(value).success;
/**
* Error codes defined by the JSON-RPC specification.
*/
var ErrorCode;
(function(ErrorCode) {
	ErrorCode[ErrorCode["ConnectionClosed"] = -32e3] = "ConnectionClosed";
	ErrorCode[ErrorCode["RequestTimeout"] = -32001] = "RequestTimeout";
	ErrorCode[ErrorCode["ParseError"] = -32700] = "ParseError";
	ErrorCode[ErrorCode["InvalidRequest"] = -32600] = "InvalidRequest";
	ErrorCode[ErrorCode["MethodNotFound"] = -32601] = "MethodNotFound";
	ErrorCode[ErrorCode["InvalidParams"] = -32602] = "InvalidParams";
	ErrorCode[ErrorCode["InternalError"] = -32603] = "InternalError";
	ErrorCode[ErrorCode["UrlElicitationRequired"] = -32042] = "UrlElicitationRequired";
})(ErrorCode || (ErrorCode = {}));
/**
* A response to a request that indicates an error occurred.
*/
var JSONRPCErrorResponseSchema = require_schemas.object({
	jsonrpc: require_schemas.literal("2.0"),
	id: RequestIdSchema.optional(),
	error: require_schemas.object({
		code: require_schemas.number().int(),
		message: require_schemas.string(),
		data: require_schemas.unknown().optional()
	})
}).strict();
/**
* Checks if a value is a valid JSONRPCErrorResponse.
* @param value - The value to check.
*
* @returns True if the value is a valid JSONRPCErrorResponse, false otherwise.
*/
var isJSONRPCErrorResponse = (value) => JSONRPCErrorResponseSchema.safeParse(value).success;
var JSONRPCMessageSchema = require_schemas.union([
	JSONRPCRequestSchema,
	JSONRPCNotificationSchema,
	JSONRPCResultResponseSchema,
	JSONRPCErrorResponseSchema
]);
require_schemas.union([JSONRPCResultResponseSchema, JSONRPCErrorResponseSchema]);
/**
* A response that indicates success but carries no data.
*/
var EmptyResultSchema = ResultSchema.strict();
var CancelledNotificationParamsSchema = NotificationsParamsSchema.extend({
	requestId: RequestIdSchema.optional(),
	reason: require_schemas.string().optional()
});
/**
* This notification can be sent by either side to indicate that it is cancelling a previously-issued request.
*
* The request SHOULD still be in-flight, but due to communication latency, it is always possible that this notification MAY arrive after the request has already finished.
*
* This notification indicates that the result will be unused, so any associated processing SHOULD cease.
*
* A client MUST NOT attempt to cancel its `initialize` request.
*/
var CancelledNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/cancelled"),
	params: CancelledNotificationParamsSchema
});
/**
* Icon schema for use in tools, prompts, resources, and implementations.
*/
var IconSchema = require_schemas.object({
	src: require_schemas.string(),
	mimeType: require_schemas.string().optional(),
	sizes: require_schemas.array(require_schemas.string()).optional(),
	theme: require_schemas._enum(["light", "dark"]).optional()
});
/**
* Base schema to add `icons` property.
*
*/
var IconsSchema = require_schemas.object({ icons: require_schemas.array(IconSchema).optional() });
/**
* Base metadata interface for common properties across resources, tools, prompts, and implementations.
*/
var BaseMetadataSchema = require_schemas.object({
	name: require_schemas.string(),
	title: require_schemas.string().optional()
});
/**
* Describes the name and version of an MCP implementation.
*/
var ImplementationSchema = BaseMetadataSchema.extend({
	...BaseMetadataSchema.shape,
	...IconsSchema.shape,
	version: require_schemas.string(),
	websiteUrl: require_schemas.string().optional(),
	description: require_schemas.string().optional()
});
var FormElicitationCapabilitySchema = require_schemas.intersection(require_schemas.object({ applyDefaults: require_schemas.boolean().optional() }), require_schemas.record(require_schemas.string(), require_schemas.unknown()));
var ElicitationCapabilitySchema = require_schemas.preprocess((value) => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		if (Object.keys(value).length === 0) return { form: {} };
	}
	return value;
}, require_schemas.intersection(require_schemas.object({
	form: FormElicitationCapabilitySchema.optional(),
	url: AssertObjectSchema.optional()
}), require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()));
/**
* Task capabilities for clients, indicating which request types support task creation.
*/
var ClientTasksCapabilitySchema = require_schemas.looseObject({
	list: AssertObjectSchema.optional(),
	cancel: AssertObjectSchema.optional(),
	requests: require_schemas.looseObject({
		sampling: require_schemas.looseObject({ createMessage: AssertObjectSchema.optional() }).optional(),
		elicitation: require_schemas.looseObject({ create: AssertObjectSchema.optional() }).optional()
	}).optional()
});
/**
* Task capabilities for servers, indicating which request types support task creation.
*/
var ServerTasksCapabilitySchema = require_schemas.looseObject({
	list: AssertObjectSchema.optional(),
	cancel: AssertObjectSchema.optional(),
	requests: require_schemas.looseObject({ tools: require_schemas.looseObject({ call: AssertObjectSchema.optional() }).optional() }).optional()
});
/**
* Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.
*/
var ClientCapabilitiesSchema = require_schemas.object({
	experimental: require_schemas.record(require_schemas.string(), AssertObjectSchema).optional(),
	sampling: require_schemas.object({
		context: AssertObjectSchema.optional(),
		tools: AssertObjectSchema.optional()
	}).optional(),
	elicitation: ElicitationCapabilitySchema.optional(),
	roots: require_schemas.object({ listChanged: require_schemas.boolean().optional() }).optional(),
	tasks: ClientTasksCapabilitySchema.optional(),
	extensions: require_schemas.record(require_schemas.string(), AssertObjectSchema).optional()
});
var InitializeRequestParamsSchema = BaseRequestParamsSchema.extend({
	protocolVersion: require_schemas.string(),
	capabilities: ClientCapabilitiesSchema,
	clientInfo: ImplementationSchema
});
/**
* This request is sent from the client to the server when it first connects, asking it to begin initialization.
*/
var InitializeRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("initialize"),
	params: InitializeRequestParamsSchema
});
var isInitializeRequest = (value) => InitializeRequestSchema.safeParse(value).success;
/**
* Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.
*/
var ServerCapabilitiesSchema = require_schemas.object({
	experimental: require_schemas.record(require_schemas.string(), AssertObjectSchema).optional(),
	logging: AssertObjectSchema.optional(),
	completions: AssertObjectSchema.optional(),
	prompts: require_schemas.object({ listChanged: require_schemas.boolean().optional() }).optional(),
	resources: require_schemas.object({
		subscribe: require_schemas.boolean().optional(),
		listChanged: require_schemas.boolean().optional()
	}).optional(),
	tools: require_schemas.object({ listChanged: require_schemas.boolean().optional() }).optional(),
	tasks: ServerTasksCapabilitySchema.optional(),
	extensions: require_schemas.record(require_schemas.string(), AssertObjectSchema).optional()
});
/**
* After receiving an initialize request from the client, the server sends this response.
*/
var InitializeResultSchema = ResultSchema.extend({
	protocolVersion: require_schemas.string(),
	capabilities: ServerCapabilitiesSchema,
	serverInfo: ImplementationSchema,
	instructions: require_schemas.string().optional()
});
/**
* This notification is sent from the client to the server after initialization has finished.
*/
var InitializedNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/initialized"),
	params: NotificationsParamsSchema.optional()
});
var isInitializedNotification = (value) => InitializedNotificationSchema.safeParse(value).success;
/**
* A ping, issued by either the server or the client, to check that the other party is still alive. The receiver must promptly respond, or else may be disconnected.
*/
var PingRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("ping"),
	params: BaseRequestParamsSchema.optional()
});
var ProgressSchema = require_schemas.object({
	progress: require_schemas.number(),
	total: require_schemas.optional(require_schemas.number()),
	message: require_schemas.optional(require_schemas.string())
});
var ProgressNotificationParamsSchema = require_schemas.object({
	...NotificationsParamsSchema.shape,
	...ProgressSchema.shape,
	progressToken: ProgressTokenSchema
});
/**
* An out-of-band notification used to inform the receiver of a progress update for a long-running request.
*
* @category notifications/progress
*/
var ProgressNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/progress"),
	params: ProgressNotificationParamsSchema
});
var PaginatedRequestParamsSchema = BaseRequestParamsSchema.extend({ cursor: CursorSchema.optional() });
var PaginatedRequestSchema = RequestSchema.extend({ params: PaginatedRequestParamsSchema.optional() });
var PaginatedResultSchema = ResultSchema.extend({ nextCursor: CursorSchema.optional() });
/**
* The status of a task.
* */
var TaskStatusSchema = require_schemas._enum([
	"working",
	"input_required",
	"completed",
	"failed",
	"cancelled"
]);
/**
* A pollable state object associated with a request.
*/
var TaskSchema = require_schemas.object({
	taskId: require_schemas.string(),
	status: TaskStatusSchema,
	ttl: require_schemas.union([require_schemas.number(), require_schemas._null()]),
	createdAt: require_schemas.string(),
	lastUpdatedAt: require_schemas.string(),
	pollInterval: require_schemas.optional(require_schemas.number()),
	statusMessage: require_schemas.optional(require_schemas.string())
});
/**
* Result returned when a task is created, containing the task data wrapped in a task field.
*/
var CreateTaskResultSchema = ResultSchema.extend({ task: TaskSchema });
/**
* Parameters for task status notification.
*/
var TaskStatusNotificationParamsSchema = NotificationsParamsSchema.merge(TaskSchema);
/**
* A notification sent when a task's status changes.
*/
var TaskStatusNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/tasks/status"),
	params: TaskStatusNotificationParamsSchema
});
/**
* A request to get the state of a specific task.
*/
var GetTaskRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("tasks/get"),
	params: BaseRequestParamsSchema.extend({ taskId: require_schemas.string() })
});
/**
* The response to a tasks/get request.
*/
var GetTaskResultSchema = ResultSchema.merge(TaskSchema);
/**
* A request to get the result of a specific task.
*/
var GetTaskPayloadRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("tasks/result"),
	params: BaseRequestParamsSchema.extend({ taskId: require_schemas.string() })
});
ResultSchema.loose();
/**
* A request to list tasks.
*/
var ListTasksRequestSchema = PaginatedRequestSchema.extend({ method: require_schemas.literal("tasks/list") });
/**
* The response to a tasks/list request.
*/
var ListTasksResultSchema = PaginatedResultSchema.extend({ tasks: require_schemas.array(TaskSchema) });
/**
* A request to cancel a specific task.
*/
var CancelTaskRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("tasks/cancel"),
	params: BaseRequestParamsSchema.extend({ taskId: require_schemas.string() })
});
/**
* The response to a tasks/cancel request.
*/
var CancelTaskResultSchema = ResultSchema.merge(TaskSchema);
/**
* The contents of a specific resource or sub-resource.
*/
var ResourceContentsSchema = require_schemas.object({
	uri: require_schemas.string(),
	mimeType: require_schemas.optional(require_schemas.string()),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
var TextResourceContentsSchema = ResourceContentsSchema.extend({ text: require_schemas.string() });
/**
* A Zod schema for validating Base64 strings that is more performant and
* robust for very large inputs than the default regex-based check. It avoids
* stack overflows by using the native `atob` function for validation.
*/
var Base64Schema = require_schemas.string().refine((val) => {
	try {
		atob(val);
		return true;
	} catch {
		return false;
	}
}, { message: "Invalid Base64 string" });
var BlobResourceContentsSchema = ResourceContentsSchema.extend({ blob: Base64Schema });
/**
* The sender or recipient of messages and data in a conversation.
*/
var RoleSchema = require_schemas._enum(["user", "assistant"]);
/**
* Optional annotations providing clients additional context about a resource.
*/
var AnnotationsSchema = require_schemas.object({
	audience: require_schemas.array(RoleSchema).optional(),
	priority: require_schemas.number().min(0).max(1).optional(),
	lastModified: require_schemas.datetime({ offset: true }).optional()
});
/**
* A known resource that the server is capable of reading.
*/
var ResourceSchema = require_schemas.object({
	...BaseMetadataSchema.shape,
	...IconsSchema.shape,
	uri: require_schemas.string(),
	description: require_schemas.optional(require_schemas.string()),
	mimeType: require_schemas.optional(require_schemas.string()),
	size: require_schemas.optional(require_schemas.number()),
	annotations: AnnotationsSchema.optional(),
	_meta: require_schemas.optional(require_schemas.looseObject({}))
});
/**
* A template description for resources available on the server.
*/
var ResourceTemplateSchema = require_schemas.object({
	...BaseMetadataSchema.shape,
	...IconsSchema.shape,
	uriTemplate: require_schemas.string(),
	description: require_schemas.optional(require_schemas.string()),
	mimeType: require_schemas.optional(require_schemas.string()),
	annotations: AnnotationsSchema.optional(),
	_meta: require_schemas.optional(require_schemas.looseObject({}))
});
/**
* Sent from the client to request a list of resources the server has.
*/
var ListResourcesRequestSchema = PaginatedRequestSchema.extend({ method: require_schemas.literal("resources/list") });
/**
* The server's response to a resources/list request from the client.
*/
var ListResourcesResultSchema = PaginatedResultSchema.extend({ resources: require_schemas.array(ResourceSchema) });
/**
* Sent from the client to request a list of resource templates the server has.
*/
var ListResourceTemplatesRequestSchema = PaginatedRequestSchema.extend({ method: require_schemas.literal("resources/templates/list") });
/**
* The server's response to a resources/templates/list request from the client.
*/
var ListResourceTemplatesResultSchema = PaginatedResultSchema.extend({ resourceTemplates: require_schemas.array(ResourceTemplateSchema) });
var ResourceRequestParamsSchema = BaseRequestParamsSchema.extend({ uri: require_schemas.string() });
/**
* Parameters for a `resources/read` request.
*/
var ReadResourceRequestParamsSchema = ResourceRequestParamsSchema;
/**
* Sent from the client to the server, to read a specific resource URI.
*/
var ReadResourceRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("resources/read"),
	params: ReadResourceRequestParamsSchema
});
/**
* The server's response to a resources/read request from the client.
*/
var ReadResourceResultSchema = ResultSchema.extend({ contents: require_schemas.array(require_schemas.union([TextResourceContentsSchema, BlobResourceContentsSchema])) });
/**
* An optional notification from the server to the client, informing it that the list of resources it can read from has changed. This may be issued by servers without any previous subscription from the client.
*/
var ResourceListChangedNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/resources/list_changed"),
	params: NotificationsParamsSchema.optional()
});
var SubscribeRequestParamsSchema = ResourceRequestParamsSchema;
/**
* Sent from the client to request resources/updated notifications from the server whenever a particular resource changes.
*/
var SubscribeRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("resources/subscribe"),
	params: SubscribeRequestParamsSchema
});
var UnsubscribeRequestParamsSchema = ResourceRequestParamsSchema;
/**
* Sent from the client to request cancellation of resources/updated notifications from the server. This should follow a previous resources/subscribe request.
*/
var UnsubscribeRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("resources/unsubscribe"),
	params: UnsubscribeRequestParamsSchema
});
/**
* Parameters for a `notifications/resources/updated` notification.
*/
var ResourceUpdatedNotificationParamsSchema = NotificationsParamsSchema.extend({ uri: require_schemas.string() });
/**
* A notification from the server to the client, informing it that a resource has changed and may need to be read again. This should only be sent if the client previously sent a resources/subscribe request.
*/
var ResourceUpdatedNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/resources/updated"),
	params: ResourceUpdatedNotificationParamsSchema
});
/**
* Describes an argument that a prompt can accept.
*/
var PromptArgumentSchema = require_schemas.object({
	name: require_schemas.string(),
	description: require_schemas.optional(require_schemas.string()),
	required: require_schemas.optional(require_schemas.boolean())
});
/**
* A prompt or prompt template that the server offers.
*/
var PromptSchema = require_schemas.object({
	...BaseMetadataSchema.shape,
	...IconsSchema.shape,
	description: require_schemas.optional(require_schemas.string()),
	arguments: require_schemas.optional(require_schemas.array(PromptArgumentSchema)),
	_meta: require_schemas.optional(require_schemas.looseObject({}))
});
/**
* Sent from the client to request a list of prompts and prompt templates the server has.
*/
var ListPromptsRequestSchema = PaginatedRequestSchema.extend({ method: require_schemas.literal("prompts/list") });
/**
* The server's response to a prompts/list request from the client.
*/
var ListPromptsResultSchema = PaginatedResultSchema.extend({ prompts: require_schemas.array(PromptSchema) });
/**
* Parameters for a `prompts/get` request.
*/
var GetPromptRequestParamsSchema = BaseRequestParamsSchema.extend({
	name: require_schemas.string(),
	arguments: require_schemas.record(require_schemas.string(), require_schemas.string()).optional()
});
/**
* Used by the client to get a prompt provided by the server.
*/
var GetPromptRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("prompts/get"),
	params: GetPromptRequestParamsSchema
});
/**
* Text provided to or from an LLM.
*/
var TextContentSchema = require_schemas.object({
	type: require_schemas.literal("text"),
	text: require_schemas.string(),
	annotations: AnnotationsSchema.optional(),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* An image provided to or from an LLM.
*/
var ImageContentSchema = require_schemas.object({
	type: require_schemas.literal("image"),
	data: Base64Schema,
	mimeType: require_schemas.string(),
	annotations: AnnotationsSchema.optional(),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* An Audio provided to or from an LLM.
*/
var AudioContentSchema = require_schemas.object({
	type: require_schemas.literal("audio"),
	data: Base64Schema,
	mimeType: require_schemas.string(),
	annotations: AnnotationsSchema.optional(),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* A tool call request from an assistant (LLM).
* Represents the assistant's request to use a tool.
*/
var ToolUseContentSchema = require_schemas.object({
	type: require_schemas.literal("tool_use"),
	name: require_schemas.string(),
	id: require_schemas.string(),
	input: require_schemas.record(require_schemas.string(), require_schemas.unknown()),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* The contents of a resource, embedded into a prompt or tool call result.
*/
var EmbeddedResourceSchema = require_schemas.object({
	type: require_schemas.literal("resource"),
	resource: require_schemas.union([TextResourceContentsSchema, BlobResourceContentsSchema]),
	annotations: AnnotationsSchema.optional(),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* A resource that the server is capable of reading, included in a prompt or tool call result.
*
* Note: resource links returned by tools are not guaranteed to appear in the results of `resources/list` requests.
*/
var ResourceLinkSchema = ResourceSchema.extend({ type: require_schemas.literal("resource_link") });
/**
* A content block that can be used in prompts and tool results.
*/
var ContentBlockSchema = require_schemas.union([
	TextContentSchema,
	ImageContentSchema,
	AudioContentSchema,
	ResourceLinkSchema,
	EmbeddedResourceSchema
]);
/**
* Describes a message returned as part of a prompt.
*/
var PromptMessageSchema = require_schemas.object({
	role: RoleSchema,
	content: ContentBlockSchema
});
/**
* The server's response to a prompts/get request from the client.
*/
var GetPromptResultSchema = ResultSchema.extend({
	description: require_schemas.string().optional(),
	messages: require_schemas.array(PromptMessageSchema)
});
/**
* An optional notification from the server to the client, informing it that the list of prompts it offers has changed. This may be issued by servers without any previous subscription from the client.
*/
var PromptListChangedNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/prompts/list_changed"),
	params: NotificationsParamsSchema.optional()
});
/**
* Additional properties describing a Tool to clients.
*
* NOTE: all properties in ToolAnnotations are **hints**.
* They are not guaranteed to provide a faithful description of
* tool behavior (including descriptive properties like `title`).
*
* Clients should never make tool use decisions based on ToolAnnotations
* received from untrusted servers.
*/
var ToolAnnotationsSchema = require_schemas.object({
	title: require_schemas.string().optional(),
	readOnlyHint: require_schemas.boolean().optional(),
	destructiveHint: require_schemas.boolean().optional(),
	idempotentHint: require_schemas.boolean().optional(),
	openWorldHint: require_schemas.boolean().optional()
});
/**
* Execution-related properties for a tool.
*/
var ToolExecutionSchema = require_schemas.object({ taskSupport: require_schemas._enum([
	"required",
	"optional",
	"forbidden"
]).optional() });
/**
* Definition for a tool the client can call.
*/
var ToolSchema = require_schemas.object({
	...BaseMetadataSchema.shape,
	...IconsSchema.shape,
	description: require_schemas.string().optional(),
	inputSchema: require_schemas.object({
		type: require_schemas.literal("object"),
		properties: require_schemas.record(require_schemas.string(), AssertObjectSchema).optional(),
		required: require_schemas.array(require_schemas.string()).optional()
	}).catchall(require_schemas.unknown()),
	outputSchema: require_schemas.object({
		type: require_schemas.literal("object"),
		properties: require_schemas.record(require_schemas.string(), AssertObjectSchema).optional(),
		required: require_schemas.array(require_schemas.string()).optional()
	}).catchall(require_schemas.unknown()).optional(),
	annotations: ToolAnnotationsSchema.optional(),
	execution: ToolExecutionSchema.optional(),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* Sent from the client to request a list of tools the server has.
*/
var ListToolsRequestSchema = PaginatedRequestSchema.extend({ method: require_schemas.literal("tools/list") });
/**
* The server's response to a tools/list request from the client.
*/
var ListToolsResultSchema = PaginatedResultSchema.extend({ tools: require_schemas.array(ToolSchema) });
/**
* The server's response to a tool call.
*/
var CallToolResultSchema = ResultSchema.extend({
	content: require_schemas.array(ContentBlockSchema).default([]),
	structuredContent: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional(),
	isError: require_schemas.boolean().optional()
});
CallToolResultSchema.or(ResultSchema.extend({ toolResult: require_schemas.unknown() }));
/**
* Parameters for a `tools/call` request.
*/
var CallToolRequestParamsSchema = TaskAugmentedRequestParamsSchema.extend({
	name: require_schemas.string(),
	arguments: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* Used by the client to invoke a tool provided by the server.
*/
var CallToolRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("tools/call"),
	params: CallToolRequestParamsSchema
});
/**
* An optional notification from the server to the client, informing it that the list of tools it offers has changed. This may be issued by servers without any previous subscription from the client.
*/
var ToolListChangedNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/tools/list_changed"),
	params: NotificationsParamsSchema.optional()
});
/**
* Base schema for list changed subscription options (without callback).
* Used internally for Zod validation of autoRefresh and debounceMs.
*/
var ListChangedOptionsBaseSchema = require_schemas.object({
	autoRefresh: require_schemas.boolean().default(true),
	debounceMs: require_schemas.number().int().nonnegative().default(300)
});
/**
* The severity of a log message.
*/
var LoggingLevelSchema = require_schemas._enum([
	"debug",
	"info",
	"notice",
	"warning",
	"error",
	"critical",
	"alert",
	"emergency"
]);
/**
* Parameters for a `logging/setLevel` request.
*/
var SetLevelRequestParamsSchema = BaseRequestParamsSchema.extend({ level: LoggingLevelSchema });
/**
* A request from the client to the server, to enable or adjust logging.
*/
var SetLevelRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("logging/setLevel"),
	params: SetLevelRequestParamsSchema
});
/**
* Parameters for a `notifications/message` notification.
*/
var LoggingMessageNotificationParamsSchema = NotificationsParamsSchema.extend({
	level: LoggingLevelSchema,
	logger: require_schemas.string().optional(),
	data: require_schemas.unknown()
});
/**
* Notification of a log message passed from server to client. If no logging/setLevel request has been sent from the client, the server MAY decide which messages to send automatically.
*/
var LoggingMessageNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/message"),
	params: LoggingMessageNotificationParamsSchema
});
/**
* Hints to use for model selection.
*/
var ModelHintSchema = require_schemas.object({ name: require_schemas.string().optional() });
/**
* The server's preferences for model selection, requested of the client during sampling.
*/
var ModelPreferencesSchema = require_schemas.object({
	hints: require_schemas.array(ModelHintSchema).optional(),
	costPriority: require_schemas.number().min(0).max(1).optional(),
	speedPriority: require_schemas.number().min(0).max(1).optional(),
	intelligencePriority: require_schemas.number().min(0).max(1).optional()
});
/**
* Controls tool usage behavior in sampling requests.
*/
var ToolChoiceSchema = require_schemas.object({ mode: require_schemas._enum([
	"auto",
	"required",
	"none"
]).optional() });
/**
* The result of a tool execution, provided by the user (server).
* Represents the outcome of invoking a tool requested via ToolUseContent.
*/
var ToolResultContentSchema = require_schemas.object({
	type: require_schemas.literal("tool_result"),
	toolUseId: require_schemas.string().describe("The unique identifier for the corresponding tool call."),
	content: require_schemas.array(ContentBlockSchema).default([]),
	structuredContent: require_schemas.object({}).loose().optional(),
	isError: require_schemas.boolean().optional(),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* Basic content types for sampling responses (without tool use).
* Used for backwards-compatible CreateMessageResult when tools are not used.
*/
var SamplingContentSchema = require_schemas.discriminatedUnion("type", [
	TextContentSchema,
	ImageContentSchema,
	AudioContentSchema
]);
/**
* Content block types allowed in sampling messages.
* This includes text, image, audio, tool use requests, and tool results.
*/
var SamplingMessageContentBlockSchema = require_schemas.discriminatedUnion("type", [
	TextContentSchema,
	ImageContentSchema,
	AudioContentSchema,
	ToolUseContentSchema,
	ToolResultContentSchema
]);
/**
* Describes a message issued to or received from an LLM API.
*/
var SamplingMessageSchema = require_schemas.object({
	role: RoleSchema,
	content: require_schemas.union([SamplingMessageContentBlockSchema, require_schemas.array(SamplingMessageContentBlockSchema)]),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* Parameters for a `sampling/createMessage` request.
*/
var CreateMessageRequestParamsSchema = TaskAugmentedRequestParamsSchema.extend({
	messages: require_schemas.array(SamplingMessageSchema),
	modelPreferences: ModelPreferencesSchema.optional(),
	systemPrompt: require_schemas.string().optional(),
	includeContext: require_schemas._enum([
		"none",
		"thisServer",
		"allServers"
	]).optional(),
	temperature: require_schemas.number().optional(),
	maxTokens: require_schemas.number().int(),
	stopSequences: require_schemas.array(require_schemas.string()).optional(),
	metadata: AssertObjectSchema.optional(),
	tools: require_schemas.array(ToolSchema).optional(),
	toolChoice: ToolChoiceSchema.optional()
});
/**
* A request from the server to sample an LLM via the client. The client has full discretion over which model to select. The client should also inform the user before beginning sampling, to allow them to inspect the request (human in the loop) and decide whether to approve it.
*/
var CreateMessageRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("sampling/createMessage"),
	params: CreateMessageRequestParamsSchema
});
/**
* The client's response to a sampling/create_message request from the server.
* This is the backwards-compatible version that returns single content (no arrays).
* Used when the request does not include tools.
*/
var CreateMessageResultSchema = ResultSchema.extend({
	model: require_schemas.string(),
	stopReason: require_schemas.optional(require_schemas._enum([
		"endTurn",
		"stopSequence",
		"maxTokens"
	]).or(require_schemas.string())),
	role: RoleSchema,
	content: SamplingContentSchema
});
/**
* The client's response to a sampling/create_message request when tools were provided.
* This version supports array content for tool use flows.
*/
var CreateMessageResultWithToolsSchema = ResultSchema.extend({
	model: require_schemas.string(),
	stopReason: require_schemas.optional(require_schemas._enum([
		"endTurn",
		"stopSequence",
		"maxTokens",
		"toolUse"
	]).or(require_schemas.string())),
	role: RoleSchema,
	content: require_schemas.union([SamplingMessageContentBlockSchema, require_schemas.array(SamplingMessageContentBlockSchema)])
});
/**
* Primitive schema definition for boolean fields.
*/
var BooleanSchemaSchema = require_schemas.object({
	type: require_schemas.literal("boolean"),
	title: require_schemas.string().optional(),
	description: require_schemas.string().optional(),
	default: require_schemas.boolean().optional()
});
/**
* Primitive schema definition for string fields.
*/
var StringSchemaSchema = require_schemas.object({
	type: require_schemas.literal("string"),
	title: require_schemas.string().optional(),
	description: require_schemas.string().optional(),
	minLength: require_schemas.number().optional(),
	maxLength: require_schemas.number().optional(),
	format: require_schemas._enum([
		"email",
		"uri",
		"date",
		"date-time"
	]).optional(),
	default: require_schemas.string().optional()
});
/**
* Primitive schema definition for number fields.
*/
var NumberSchemaSchema = require_schemas.object({
	type: require_schemas._enum(["number", "integer"]),
	title: require_schemas.string().optional(),
	description: require_schemas.string().optional(),
	minimum: require_schemas.number().optional(),
	maximum: require_schemas.number().optional(),
	default: require_schemas.number().optional()
});
/**
* Schema for single-selection enumeration without display titles for options.
*/
var UntitledSingleSelectEnumSchemaSchema = require_schemas.object({
	type: require_schemas.literal("string"),
	title: require_schemas.string().optional(),
	description: require_schemas.string().optional(),
	enum: require_schemas.array(require_schemas.string()),
	default: require_schemas.string().optional()
});
/**
* Schema for single-selection enumeration with display titles for each option.
*/
var TitledSingleSelectEnumSchemaSchema = require_schemas.object({
	type: require_schemas.literal("string"),
	title: require_schemas.string().optional(),
	description: require_schemas.string().optional(),
	oneOf: require_schemas.array(require_schemas.object({
		const: require_schemas.string(),
		title: require_schemas.string()
	})),
	default: require_schemas.string().optional()
});
/**
* Use TitledSingleSelectEnumSchema instead.
* This interface will be removed in a future version.
*/
var LegacyTitledEnumSchemaSchema = require_schemas.object({
	type: require_schemas.literal("string"),
	title: require_schemas.string().optional(),
	description: require_schemas.string().optional(),
	enum: require_schemas.array(require_schemas.string()),
	enumNames: require_schemas.array(require_schemas.string()).optional(),
	default: require_schemas.string().optional()
});
var SingleSelectEnumSchemaSchema = require_schemas.union([UntitledSingleSelectEnumSchemaSchema, TitledSingleSelectEnumSchemaSchema]);
/**
* Schema for multiple-selection enumeration without display titles for options.
*/
var UntitledMultiSelectEnumSchemaSchema = require_schemas.object({
	type: require_schemas.literal("array"),
	title: require_schemas.string().optional(),
	description: require_schemas.string().optional(),
	minItems: require_schemas.number().optional(),
	maxItems: require_schemas.number().optional(),
	items: require_schemas.object({
		type: require_schemas.literal("string"),
		enum: require_schemas.array(require_schemas.string())
	}),
	default: require_schemas.array(require_schemas.string()).optional()
});
/**
* Schema for multiple-selection enumeration with display titles for each option.
*/
var TitledMultiSelectEnumSchemaSchema = require_schemas.object({
	type: require_schemas.literal("array"),
	title: require_schemas.string().optional(),
	description: require_schemas.string().optional(),
	minItems: require_schemas.number().optional(),
	maxItems: require_schemas.number().optional(),
	items: require_schemas.object({ anyOf: require_schemas.array(require_schemas.object({
		const: require_schemas.string(),
		title: require_schemas.string()
	})) }),
	default: require_schemas.array(require_schemas.string()).optional()
});
/**
* Combined schema for multiple-selection enumeration
*/
var MultiSelectEnumSchemaSchema = require_schemas.union([UntitledMultiSelectEnumSchemaSchema, TitledMultiSelectEnumSchemaSchema]);
/**
* Primitive schema definition for enum fields.
*/
var EnumSchemaSchema = require_schemas.union([
	LegacyTitledEnumSchemaSchema,
	SingleSelectEnumSchemaSchema,
	MultiSelectEnumSchemaSchema
]);
/**
* Union of all primitive schema definitions.
*/
var PrimitiveSchemaDefinitionSchema = require_schemas.union([
	EnumSchemaSchema,
	BooleanSchemaSchema,
	StringSchemaSchema,
	NumberSchemaSchema
]);
/**
* Parameters for an `elicitation/create` request for form-based elicitation.
*/
var ElicitRequestFormParamsSchema = TaskAugmentedRequestParamsSchema.extend({
	mode: require_schemas.literal("form").optional(),
	message: require_schemas.string(),
	requestedSchema: require_schemas.object({
		type: require_schemas.literal("object"),
		properties: require_schemas.record(require_schemas.string(), PrimitiveSchemaDefinitionSchema),
		required: require_schemas.array(require_schemas.string()).optional()
	})
});
/**
* Parameters for an `elicitation/create` request for URL-based elicitation.
*/
var ElicitRequestURLParamsSchema = TaskAugmentedRequestParamsSchema.extend({
	mode: require_schemas.literal("url"),
	message: require_schemas.string(),
	elicitationId: require_schemas.string(),
	url: require_schemas.string().url()
});
/**
* The parameters for a request to elicit additional information from the user via the client.
*/
var ElicitRequestParamsSchema = require_schemas.union([ElicitRequestFormParamsSchema, ElicitRequestURLParamsSchema]);
/**
* A request from the server to elicit user input via the client.
* The client should present the message and form fields to the user (form mode)
* or navigate to a URL (URL mode).
*/
var ElicitRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("elicitation/create"),
	params: ElicitRequestParamsSchema
});
/**
* Parameters for a `notifications/elicitation/complete` notification.
*
* @category notifications/elicitation/complete
*/
var ElicitationCompleteNotificationParamsSchema = NotificationsParamsSchema.extend({ elicitationId: require_schemas.string() });
/**
* A notification from the server to the client, informing it of a completion of an out-of-band elicitation request.
*
* @category notifications/elicitation/complete
*/
var ElicitationCompleteNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/elicitation/complete"),
	params: ElicitationCompleteNotificationParamsSchema
});
/**
* The client's response to an elicitation/create request from the server.
*/
var ElicitResultSchema = ResultSchema.extend({
	action: require_schemas._enum([
		"accept",
		"decline",
		"cancel"
	]),
	content: require_schemas.preprocess((val) => val === null ? void 0 : val, require_schemas.record(require_schemas.string(), require_schemas.union([
		require_schemas.string(),
		require_schemas.number(),
		require_schemas.boolean(),
		require_schemas.array(require_schemas.string())
	])).optional())
});
/**
* A reference to a resource or resource template definition.
*/
var ResourceTemplateReferenceSchema = require_schemas.object({
	type: require_schemas.literal("ref/resource"),
	uri: require_schemas.string()
});
/**
* Identifies a prompt.
*/
var PromptReferenceSchema = require_schemas.object({
	type: require_schemas.literal("ref/prompt"),
	name: require_schemas.string()
});
/**
* Parameters for a `completion/complete` request.
*/
var CompleteRequestParamsSchema = BaseRequestParamsSchema.extend({
	ref: require_schemas.union([PromptReferenceSchema, ResourceTemplateReferenceSchema]),
	argument: require_schemas.object({
		name: require_schemas.string(),
		value: require_schemas.string()
	}),
	context: require_schemas.object({ arguments: require_schemas.record(require_schemas.string(), require_schemas.string()).optional() }).optional()
});
/**
* A request from the client to the server, to ask for completion options.
*/
var CompleteRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("completion/complete"),
	params: CompleteRequestParamsSchema
});
function assertCompleteRequestPrompt(request) {
	if (request.params.ref.type !== "ref/prompt") throw new TypeError(`Expected CompleteRequestPrompt, but got ${request.params.ref.type}`);
}
function assertCompleteRequestResourceTemplate(request) {
	if (request.params.ref.type !== "ref/resource") throw new TypeError(`Expected CompleteRequestResourceTemplate, but got ${request.params.ref.type}`);
}
/**
* The server's response to a completion/complete request
*/
var CompleteResultSchema = ResultSchema.extend({ completion: require_schemas.looseObject({
	values: require_schemas.array(require_schemas.string()).max(100),
	total: require_schemas.optional(require_schemas.number().int()),
	hasMore: require_schemas.optional(require_schemas.boolean())
}) });
/**
* Represents a root directory or file that the server can operate on.
*/
var RootSchema = require_schemas.object({
	uri: require_schemas.string().startsWith("file://"),
	name: require_schemas.string().optional(),
	_meta: require_schemas.record(require_schemas.string(), require_schemas.unknown()).optional()
});
/**
* Sent from the server to request a list of root URIs from the client.
*/
var ListRootsRequestSchema = RequestSchema.extend({
	method: require_schemas.literal("roots/list"),
	params: BaseRequestParamsSchema.optional()
});
/**
* The client's response to a roots/list request from the server.
*/
var ListRootsResultSchema = ResultSchema.extend({ roots: require_schemas.array(RootSchema) });
/**
* A notification from the client to the server, informing it that the list of roots has changed.
*/
var RootsListChangedNotificationSchema = NotificationSchema.extend({
	method: require_schemas.literal("notifications/roots/list_changed"),
	params: NotificationsParamsSchema.optional()
});
require_schemas.union([
	PingRequestSchema,
	InitializeRequestSchema,
	CompleteRequestSchema,
	SetLevelRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListResourcesRequestSchema,
	ListResourceTemplatesRequestSchema,
	ReadResourceRequestSchema,
	SubscribeRequestSchema,
	UnsubscribeRequestSchema,
	CallToolRequestSchema,
	ListToolsRequestSchema,
	GetTaskRequestSchema,
	GetTaskPayloadRequestSchema,
	ListTasksRequestSchema,
	CancelTaskRequestSchema
]);
require_schemas.union([
	CancelledNotificationSchema,
	ProgressNotificationSchema,
	InitializedNotificationSchema,
	RootsListChangedNotificationSchema,
	TaskStatusNotificationSchema
]);
require_schemas.union([
	EmptyResultSchema,
	CreateMessageResultSchema,
	CreateMessageResultWithToolsSchema,
	ElicitResultSchema,
	ListRootsResultSchema,
	GetTaskResultSchema,
	ListTasksResultSchema,
	CreateTaskResultSchema
]);
require_schemas.union([
	PingRequestSchema,
	CreateMessageRequestSchema,
	ElicitRequestSchema,
	ListRootsRequestSchema,
	GetTaskRequestSchema,
	GetTaskPayloadRequestSchema,
	ListTasksRequestSchema,
	CancelTaskRequestSchema
]);
require_schemas.union([
	CancelledNotificationSchema,
	ProgressNotificationSchema,
	LoggingMessageNotificationSchema,
	ResourceUpdatedNotificationSchema,
	ResourceListChangedNotificationSchema,
	ToolListChangedNotificationSchema,
	PromptListChangedNotificationSchema,
	TaskStatusNotificationSchema,
	ElicitationCompleteNotificationSchema
]);
require_schemas.union([
	EmptyResultSchema,
	InitializeResultSchema,
	CompleteResultSchema,
	GetPromptResultSchema,
	ListPromptsResultSchema,
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
	ReadResourceResultSchema,
	CallToolResultSchema,
	ListToolsResultSchema,
	GetTaskResultSchema,
	ListTasksResultSchema,
	CreateTaskResultSchema
]);
var McpError = class McpError extends Error {
	constructor(code, message, data) {
		super(`MCP error ${code}: ${message}`);
		this.code = code;
		this.data = data;
		this.name = "McpError";
	}
	/**
	* Factory method to create the appropriate error type based on the error code and data
	*/
	static fromError(code, message, data) {
		if (code === ErrorCode.UrlElicitationRequired && data) {
			const errorData = data;
			if (errorData.elicitations) return new UrlElicitationRequiredError(errorData.elicitations, message);
		}
		return new McpError(code, message, data);
	}
};
/**
* Specialized error type when a tool requires a URL mode elicitation.
* This makes it nicer for the client to handle since there is specific data to work with instead of just a code to check against.
*/
var UrlElicitationRequiredError = class extends McpError {
	constructor(elicitations, message = `URL elicitation${elicitations.length > 1 ? "s" : ""} required`) {
		super(ErrorCode.UrlElicitationRequired, message, { elicitations });
	}
	get elicitations() {
		return this.data?.elicitations ?? [];
	}
};
//#endregion
//#region ../../node_modules/.pnpm/pkce-challenge@5.0.0/node_modules/pkce-challenge/dist/index.node.js
var crypto = globalThis.crypto?.webcrypto ?? globalThis.crypto ?? import("node:crypto").then((m) => m.webcrypto);
/**
* Creates an array of length `size` of random bytes
* @param size
* @returns Array of random ints (0 to 255)
*/
async function getRandomValues(size) {
	return (await crypto).getRandomValues(new Uint8Array(size));
}
/** Generate cryptographically strong random string
* @param size The desired length of the string
* @returns The random string
*/
async function random(size) {
	const mask = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
	let result = "";
	const randomUints = await getRandomValues(size);
	for (let i = 0; i < size; i++) {
		const randomIndex = randomUints[i] % 66;
		result += mask[randomIndex];
	}
	return result;
}
/** Generate a PKCE challenge verifier
* @param length Length of the verifier
* @returns A random verifier `length` characters long
*/
async function generateVerifier(length) {
	return await random(length);
}
/** Generate a PKCE code challenge from a code verifier
* @param code_verifier
* @returns The base64 url encoded code challenge
*/
async function generateChallenge(code_verifier) {
	const buffer = await (await crypto).subtle.digest("SHA-256", new TextEncoder().encode(code_verifier));
	return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "");
}
/** Generate a PKCE challenge pair
* @param length Length of the verifer (between 43-128). Defaults to 43.
* @returns PKCE challenge pair
*/
async function pkceChallenge(length) {
	if (!length) length = 43;
	if (length < 43 || length > 128) throw `Expected a length between 43 and 128. Received ${length}.`;
	const verifier = await generateVerifier(length);
	return {
		code_verifier: verifier,
		code_challenge: await generateChallenge(verifier)
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@modelcontextprotocol+sdk@1_d0245f20ef3dec26d553fa86b4caf24e/node_modules/@modelcontextprotocol/sdk/dist/esm/shared/auth.js
/**
* Reusable URL validation that disallows javascript: scheme
*/
var SafeUrlSchema = require_schemas.url().superRefine((val, ctx) => {
	if (!URL.canParse(val)) {
		ctx.addIssue({
			code: ZodIssueCode.custom,
			message: "URL must be parseable",
			fatal: true
		});
		return require_schemas.NEVER;
	}
}).refine((url) => {
	const u = new URL(url);
	return u.protocol !== "javascript:" && u.protocol !== "data:" && u.protocol !== "vbscript:";
}, { message: "URL cannot use javascript:, data:, or vbscript: scheme" });
/**
* RFC 9728 OAuth Protected Resource Metadata
*/
var OAuthProtectedResourceMetadataSchema = require_schemas.looseObject({
	resource: require_schemas.string().url(),
	authorization_servers: require_schemas.array(SafeUrlSchema).optional(),
	jwks_uri: require_schemas.string().url().optional(),
	scopes_supported: require_schemas.array(require_schemas.string()).optional(),
	bearer_methods_supported: require_schemas.array(require_schemas.string()).optional(),
	resource_signing_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	resource_name: require_schemas.string().optional(),
	resource_documentation: require_schemas.string().optional(),
	resource_policy_uri: require_schemas.string().url().optional(),
	resource_tos_uri: require_schemas.string().url().optional(),
	tls_client_certificate_bound_access_tokens: require_schemas.boolean().optional(),
	authorization_details_types_supported: require_schemas.array(require_schemas.string()).optional(),
	dpop_signing_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	dpop_bound_access_tokens_required: require_schemas.boolean().optional()
});
/**
* RFC 8414 OAuth 2.0 Authorization Server Metadata
*/
var OAuthMetadataSchema = require_schemas.looseObject({
	issuer: require_schemas.string(),
	authorization_endpoint: SafeUrlSchema,
	token_endpoint: SafeUrlSchema,
	registration_endpoint: SafeUrlSchema.optional(),
	scopes_supported: require_schemas.array(require_schemas.string()).optional(),
	response_types_supported: require_schemas.array(require_schemas.string()),
	response_modes_supported: require_schemas.array(require_schemas.string()).optional(),
	grant_types_supported: require_schemas.array(require_schemas.string()).optional(),
	token_endpoint_auth_methods_supported: require_schemas.array(require_schemas.string()).optional(),
	token_endpoint_auth_signing_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	service_documentation: SafeUrlSchema.optional(),
	revocation_endpoint: SafeUrlSchema.optional(),
	revocation_endpoint_auth_methods_supported: require_schemas.array(require_schemas.string()).optional(),
	revocation_endpoint_auth_signing_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	introspection_endpoint: require_schemas.string().optional(),
	introspection_endpoint_auth_methods_supported: require_schemas.array(require_schemas.string()).optional(),
	introspection_endpoint_auth_signing_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	code_challenge_methods_supported: require_schemas.array(require_schemas.string()).optional(),
	client_id_metadata_document_supported: require_schemas.boolean().optional()
});
/**
* OpenID Connect Discovery 1.0 Provider Metadata
* see: https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
*/
var OpenIdProviderMetadataSchema = require_schemas.looseObject({
	issuer: require_schemas.string(),
	authorization_endpoint: SafeUrlSchema,
	token_endpoint: SafeUrlSchema,
	userinfo_endpoint: SafeUrlSchema.optional(),
	jwks_uri: SafeUrlSchema,
	registration_endpoint: SafeUrlSchema.optional(),
	scopes_supported: require_schemas.array(require_schemas.string()).optional(),
	response_types_supported: require_schemas.array(require_schemas.string()),
	response_modes_supported: require_schemas.array(require_schemas.string()).optional(),
	grant_types_supported: require_schemas.array(require_schemas.string()).optional(),
	acr_values_supported: require_schemas.array(require_schemas.string()).optional(),
	subject_types_supported: require_schemas.array(require_schemas.string()),
	id_token_signing_alg_values_supported: require_schemas.array(require_schemas.string()),
	id_token_encryption_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	id_token_encryption_enc_values_supported: require_schemas.array(require_schemas.string()).optional(),
	userinfo_signing_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	userinfo_encryption_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	userinfo_encryption_enc_values_supported: require_schemas.array(require_schemas.string()).optional(),
	request_object_signing_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	request_object_encryption_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	request_object_encryption_enc_values_supported: require_schemas.array(require_schemas.string()).optional(),
	token_endpoint_auth_methods_supported: require_schemas.array(require_schemas.string()).optional(),
	token_endpoint_auth_signing_alg_values_supported: require_schemas.array(require_schemas.string()).optional(),
	display_values_supported: require_schemas.array(require_schemas.string()).optional(),
	claim_types_supported: require_schemas.array(require_schemas.string()).optional(),
	claims_supported: require_schemas.array(require_schemas.string()).optional(),
	service_documentation: require_schemas.string().optional(),
	claims_locales_supported: require_schemas.array(require_schemas.string()).optional(),
	ui_locales_supported: require_schemas.array(require_schemas.string()).optional(),
	claims_parameter_supported: require_schemas.boolean().optional(),
	request_parameter_supported: require_schemas.boolean().optional(),
	request_uri_parameter_supported: require_schemas.boolean().optional(),
	require_request_uri_registration: require_schemas.boolean().optional(),
	op_policy_uri: SafeUrlSchema.optional(),
	op_tos_uri: SafeUrlSchema.optional(),
	client_id_metadata_document_supported: require_schemas.boolean().optional()
});
/**
* OpenID Connect Discovery metadata that may include OAuth 2.0 fields
* This schema represents the real-world scenario where OIDC providers
* return a mix of OpenID Connect and OAuth 2.0 metadata fields
*/
var OpenIdProviderDiscoveryMetadataSchema = require_schemas.object({
	...OpenIdProviderMetadataSchema.shape,
	...OAuthMetadataSchema.pick({ code_challenge_methods_supported: true }).shape
});
/**
* OAuth 2.1 token response
*/
var OAuthTokensSchema = require_schemas.object({
	access_token: require_schemas.string(),
	id_token: require_schemas.string().optional(),
	token_type: require_schemas.string(),
	expires_in: number().optional(),
	scope: require_schemas.string().optional(),
	refresh_token: require_schemas.string().optional()
}).strip();
/**
* OAuth 2.1 error response
*/
var OAuthErrorResponseSchema = require_schemas.object({
	error: require_schemas.string(),
	error_description: require_schemas.string().optional(),
	error_uri: require_schemas.string().optional()
});
/**
* Optional version of SafeUrlSchema that allows empty string for retrocompatibility on tos_uri and logo_uri
*/
var OptionalSafeUrlSchema = SafeUrlSchema.optional().or(require_schemas.literal("").transform(() => void 0));
/**
* RFC 7591 OAuth 2.0 Dynamic Client Registration metadata
*/
var OAuthClientMetadataSchema = require_schemas.object({
	redirect_uris: require_schemas.array(SafeUrlSchema),
	token_endpoint_auth_method: require_schemas.string().optional(),
	grant_types: require_schemas.array(require_schemas.string()).optional(),
	response_types: require_schemas.array(require_schemas.string()).optional(),
	client_name: require_schemas.string().optional(),
	client_uri: SafeUrlSchema.optional(),
	logo_uri: OptionalSafeUrlSchema,
	scope: require_schemas.string().optional(),
	contacts: require_schemas.array(require_schemas.string()).optional(),
	tos_uri: OptionalSafeUrlSchema,
	policy_uri: require_schemas.string().optional(),
	jwks_uri: SafeUrlSchema.optional(),
	jwks: require_schemas.any().optional(),
	software_id: require_schemas.string().optional(),
	software_version: require_schemas.string().optional(),
	software_statement: require_schemas.string().optional()
}).strip();
/**
* RFC 7591 OAuth 2.0 Dynamic Client Registration client information
*/
var OAuthClientInformationSchema = require_schemas.object({
	client_id: require_schemas.string(),
	client_secret: require_schemas.string().optional(),
	client_id_issued_at: require_schemas.number().optional(),
	client_secret_expires_at: require_schemas.number().optional()
}).strip();
/**
* RFC 7591 OAuth 2.0 Dynamic Client Registration full response (client information plus metadata)
*/
var OAuthClientInformationFullSchema = OAuthClientMetadataSchema.merge(OAuthClientInformationSchema);
require_schemas.object({
	error: require_schemas.string(),
	error_description: require_schemas.string().optional()
}).strip();
require_schemas.object({
	token: require_schemas.string(),
	token_type_hint: require_schemas.string().optional()
}).strip();
//#endregion
//#region ../../node_modules/.pnpm/@modelcontextprotocol+sdk@1_d0245f20ef3dec26d553fa86b4caf24e/node_modules/@modelcontextprotocol/sdk/dist/esm/shared/auth-utils.js
/**
* Utilities for handling OAuth resource URIs.
*/
/**
* Converts a server URL to a resource URL by removing the fragment.
* RFC 8707 section 2 states that resource URIs "MUST NOT include a fragment component".
* Keeps everything else unchanged (scheme, domain, port, path, query).
*/
function resourceUrlFromServerUrl(url) {
	const resourceURL = typeof url === "string" ? new URL(url) : new URL(url.href);
	resourceURL.hash = "";
	return resourceURL;
}
/**
* Checks if a requested resource URL matches a configured resource URL.
* A requested resource matches if it has the same scheme, domain, port,
* and its path starts with the configured resource's path.
*
* @param requestedResource The resource URL being requested
* @param configuredResource The resource URL that has been configured
* @returns true if the requested resource matches the configured resource, false otherwise
*/
function checkResourceAllowed({ requestedResource, configuredResource }) {
	const requested = typeof requestedResource === "string" ? new URL(requestedResource) : new URL(requestedResource.href);
	const configured = typeof configuredResource === "string" ? new URL(configuredResource) : new URL(configuredResource.href);
	if (requested.origin !== configured.origin) return false;
	if (requested.pathname.length < configured.pathname.length) return false;
	const requestedPath = requested.pathname.endsWith("/") ? requested.pathname : requested.pathname + "/";
	const configuredPath = configured.pathname.endsWith("/") ? configured.pathname : configured.pathname + "/";
	return requestedPath.startsWith(configuredPath);
}
//#endregion
//#region ../../node_modules/.pnpm/@modelcontextprotocol+sdk@1_d0245f20ef3dec26d553fa86b4caf24e/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/errors.js
/**
* Base class for all OAuth errors
*/
var OAuthError = class extends Error {
	constructor(message, errorUri) {
		super(message);
		this.errorUri = errorUri;
		this.name = this.constructor.name;
	}
	/**
	* Converts the error to a standard OAuth error response object
	*/
	toResponseObject() {
		const response = {
			error: this.errorCode,
			error_description: this.message
		};
		if (this.errorUri) response.error_uri = this.errorUri;
		return response;
	}
	get errorCode() {
		return this.constructor.errorCode;
	}
};
/**
* Invalid request error - The request is missing a required parameter,
* includes an invalid parameter value, includes a parameter more than once,
* or is otherwise malformed.
*/
var InvalidRequestError = class extends OAuthError {};
InvalidRequestError.errorCode = "invalid_request";
/**
* Invalid client error - Client authentication failed (e.g., unknown client, no client
* authentication included, or unsupported authentication method).
*/
var InvalidClientError = class extends OAuthError {};
InvalidClientError.errorCode = "invalid_client";
/**
* Invalid grant error - The provided authorization grant or refresh token is
* invalid, expired, revoked, does not match the redirection URI used in the
* authorization request, or was issued to another client.
*/
var InvalidGrantError = class extends OAuthError {};
InvalidGrantError.errorCode = "invalid_grant";
/**
* Unauthorized client error - The authenticated client is not authorized to use
* this authorization grant type.
*/
var UnauthorizedClientError = class extends OAuthError {};
UnauthorizedClientError.errorCode = "unauthorized_client";
/**
* Unsupported grant type error - The authorization grant type is not supported
* by the authorization server.
*/
var UnsupportedGrantTypeError = class extends OAuthError {};
UnsupportedGrantTypeError.errorCode = "unsupported_grant_type";
/**
* Invalid scope error - The requested scope is invalid, unknown, malformed, or
* exceeds the scope granted by the resource owner.
*/
var InvalidScopeError = class extends OAuthError {};
InvalidScopeError.errorCode = "invalid_scope";
/**
* Access denied error - The resource owner or authorization server denied the request.
*/
var AccessDeniedError = class extends OAuthError {};
AccessDeniedError.errorCode = "access_denied";
/**
* Server error - The authorization server encountered an unexpected condition
* that prevented it from fulfilling the request.
*/
var ServerError = class extends OAuthError {};
ServerError.errorCode = "server_error";
/**
* Temporarily unavailable error - The authorization server is currently unable to
* handle the request due to a temporary overloading or maintenance of the server.
*/
var TemporarilyUnavailableError = class extends OAuthError {};
TemporarilyUnavailableError.errorCode = "temporarily_unavailable";
/**
* Unsupported response type error - The authorization server does not support
* obtaining an authorization code using this method.
*/
var UnsupportedResponseTypeError = class extends OAuthError {};
UnsupportedResponseTypeError.errorCode = "unsupported_response_type";
/**
* Unsupported token type error - The authorization server does not support
* the requested token type.
*/
var UnsupportedTokenTypeError = class extends OAuthError {};
UnsupportedTokenTypeError.errorCode = "unsupported_token_type";
/**
* Invalid token error - The access token provided is expired, revoked, malformed,
* or invalid for other reasons.
*/
var InvalidTokenError = class extends OAuthError {};
InvalidTokenError.errorCode = "invalid_token";
/**
* Method not allowed error - The HTTP method used is not allowed for this endpoint.
* (Custom, non-standard error)
*/
var MethodNotAllowedError = class extends OAuthError {};
MethodNotAllowedError.errorCode = "method_not_allowed";
/**
* Too many requests error - Rate limit exceeded.
* (Custom, non-standard error based on RFC 6585)
*/
var TooManyRequestsError = class extends OAuthError {};
TooManyRequestsError.errorCode = "too_many_requests";
/**
* Invalid client metadata error - The client metadata is invalid.
* (Custom error for dynamic client registration - RFC 7591)
*/
var InvalidClientMetadataError = class extends OAuthError {};
InvalidClientMetadataError.errorCode = "invalid_client_metadata";
/**
* Insufficient scope error - The request requires higher privileges than provided by the access token.
*/
var InsufficientScopeError = class extends OAuthError {};
InsufficientScopeError.errorCode = "insufficient_scope";
/**
* Invalid target error - The requested resource is invalid, missing, unknown, or malformed.
* (Custom error for resource indicators - RFC 8707)
*/
var InvalidTargetError = class extends OAuthError {};
InvalidTargetError.errorCode = "invalid_target";
/**
* A full list of all OAuthErrors, enabling parsing from error responses
*/
var OAUTH_ERRORS = {
	[InvalidRequestError.errorCode]: InvalidRequestError,
	[InvalidClientError.errorCode]: InvalidClientError,
	[InvalidGrantError.errorCode]: InvalidGrantError,
	[UnauthorizedClientError.errorCode]: UnauthorizedClientError,
	[UnsupportedGrantTypeError.errorCode]: UnsupportedGrantTypeError,
	[InvalidScopeError.errorCode]: InvalidScopeError,
	[AccessDeniedError.errorCode]: AccessDeniedError,
	[ServerError.errorCode]: ServerError,
	[TemporarilyUnavailableError.errorCode]: TemporarilyUnavailableError,
	[UnsupportedResponseTypeError.errorCode]: UnsupportedResponseTypeError,
	[UnsupportedTokenTypeError.errorCode]: UnsupportedTokenTypeError,
	[InvalidTokenError.errorCode]: InvalidTokenError,
	[MethodNotAllowedError.errorCode]: MethodNotAllowedError,
	[TooManyRequestsError.errorCode]: TooManyRequestsError,
	[InvalidClientMetadataError.errorCode]: InvalidClientMetadataError,
	[InsufficientScopeError.errorCode]: InsufficientScopeError,
	[InvalidTargetError.errorCode]: InvalidTargetError
};
//#endregion
//#region ../../node_modules/.pnpm/@modelcontextprotocol+sdk@1_d0245f20ef3dec26d553fa86b4caf24e/node_modules/@modelcontextprotocol/sdk/dist/esm/client/auth.js
var auth_exports = /* @__PURE__ */ require_chunk.__exportAll({
	UnauthorizedError: () => UnauthorizedError,
	auth: () => auth,
	buildDiscoveryUrls: () => buildDiscoveryUrls,
	discoverAuthorizationServerMetadata: () => discoverAuthorizationServerMetadata,
	discoverOAuthProtectedResourceMetadata: () => discoverOAuthProtectedResourceMetadata,
	discoverOAuthServerInfo: () => discoverOAuthServerInfo,
	exchangeAuthorization: () => exchangeAuthorization,
	extractWWWAuthenticateParams: () => extractWWWAuthenticateParams,
	fetchToken: () => fetchToken,
	isHttpsUrl: () => isHttpsUrl,
	parseErrorResponse: () => parseErrorResponse,
	prepareAuthorizationCodeRequest: () => prepareAuthorizationCodeRequest,
	refreshAuthorization: () => refreshAuthorization,
	registerClient: () => registerClient,
	selectClientAuthMethod: () => selectClientAuthMethod,
	selectResourceURL: () => selectResourceURL,
	startAuthorization: () => startAuthorization
});
var UnauthorizedError = class extends Error {
	constructor(message) {
		super(message ?? "Unauthorized");
	}
};
function isClientAuthMethod(method) {
	return [
		"client_secret_basic",
		"client_secret_post",
		"none"
	].includes(method);
}
var AUTHORIZATION_CODE_RESPONSE_TYPE = "code";
var AUTHORIZATION_CODE_CHALLENGE_METHOD = "S256";
/**
* Determines the best client authentication method to use based on server support and client configuration.
*
* Priority order (highest to lowest):
* 1. client_secret_basic (if client secret is available)
* 2. client_secret_post (if client secret is available)
* 3. none (for public clients)
*
* @param clientInformation - OAuth client information containing credentials
* @param supportedMethods - Authentication methods supported by the authorization server
* @returns The selected authentication method
*/
function selectClientAuthMethod(clientInformation, supportedMethods) {
	const hasClientSecret = clientInformation.client_secret !== void 0;
	if ("token_endpoint_auth_method" in clientInformation && clientInformation.token_endpoint_auth_method && isClientAuthMethod(clientInformation.token_endpoint_auth_method) && (supportedMethods.length === 0 || supportedMethods.includes(clientInformation.token_endpoint_auth_method))) return clientInformation.token_endpoint_auth_method;
	if (supportedMethods.length === 0) return hasClientSecret ? "client_secret_basic" : "none";
	if (hasClientSecret && supportedMethods.includes("client_secret_basic")) return "client_secret_basic";
	if (hasClientSecret && supportedMethods.includes("client_secret_post")) return "client_secret_post";
	if (supportedMethods.includes("none")) return "none";
	return hasClientSecret ? "client_secret_post" : "none";
}
/**
* Applies client authentication to the request based on the specified method.
*
* Implements OAuth 2.1 client authentication methods:
* - client_secret_basic: HTTP Basic authentication (RFC 6749 Section 2.3.1)
* - client_secret_post: Credentials in request body (RFC 6749 Section 2.3.1)
* - none: Public client authentication (RFC 6749 Section 2.1)
*
* @param method - The authentication method to use
* @param clientInformation - OAuth client information containing credentials
* @param headers - HTTP headers object to modify
* @param params - URL search parameters to modify
* @throws {Error} When required credentials are missing
*/
function applyClientAuthentication(method, clientInformation, headers, params) {
	const { client_id, client_secret } = clientInformation;
	switch (method) {
		case "client_secret_basic":
			applyBasicAuth(client_id, client_secret, headers);
			return;
		case "client_secret_post":
			applyPostAuth(client_id, client_secret, params);
			return;
		case "none":
			applyPublicAuth(client_id, params);
			return;
		default: throw new Error(`Unsupported client authentication method: ${method}`);
	}
}
/**
* Applies HTTP Basic authentication (RFC 6749 Section 2.3.1)
*/
function applyBasicAuth(clientId, clientSecret, headers) {
	if (!clientSecret) throw new Error("client_secret_basic authentication requires a client_secret");
	const credentials = btoa(`${clientId}:${clientSecret}`);
	headers.set("Authorization", `Basic ${credentials}`);
}
/**
* Applies POST body authentication (RFC 6749 Section 2.3.1)
*/
function applyPostAuth(clientId, clientSecret, params) {
	params.set("client_id", clientId);
	if (clientSecret) params.set("client_secret", clientSecret);
}
/**
* Applies public client authentication (RFC 6749 Section 2.1)
*/
function applyPublicAuth(clientId, params) {
	params.set("client_id", clientId);
}
/**
* Parses an OAuth error response from a string or Response object.
*
* If the input is a standard OAuth2.0 error response, it will be parsed according to the spec
* and an instance of the appropriate OAuthError subclass will be returned.
* If parsing fails, it falls back to a generic ServerError that includes
* the response status (if available) and original content.
*
* @param input - A Response object or string containing the error response
* @returns A Promise that resolves to an OAuthError instance
*/
async function parseErrorResponse(input) {
	const statusCode = input instanceof Response ? input.status : void 0;
	const body = input instanceof Response ? await input.text() : input;
	try {
		const { error, error_description, error_uri } = OAuthErrorResponseSchema.parse(JSON.parse(body));
		return new (OAUTH_ERRORS[error] || ServerError)(error_description || "", error_uri);
	} catch (error) {
		return new ServerError(`${statusCode ? `HTTP ${statusCode}: ` : ""}Invalid OAuth error response: ${error}. Raw body: ${body}`);
	}
}
/**
* Orchestrates the full auth flow with a server.
*
* This can be used as a single entry point for all authorization functionality,
* instead of linking together the other lower-level functions in this module.
*/
async function auth(provider, options) {
	try {
		return await authInternal(provider, options);
	} catch (error) {
		if (error instanceof InvalidClientError || error instanceof UnauthorizedClientError) {
			await provider.invalidateCredentials?.("all");
			return await authInternal(provider, options);
		} else if (error instanceof InvalidGrantError) {
			await provider.invalidateCredentials?.("tokens");
			return await authInternal(provider, options);
		}
		throw error;
	}
}
async function authInternal(provider, { serverUrl, authorizationCode, scope, resourceMetadataUrl, fetchFn }) {
	const cachedState = await provider.discoveryState?.();
	let resourceMetadata;
	let authorizationServerUrl;
	let metadata;
	let effectiveResourceMetadataUrl = resourceMetadataUrl;
	if (!effectiveResourceMetadataUrl && cachedState?.resourceMetadataUrl) effectiveResourceMetadataUrl = new URL(cachedState.resourceMetadataUrl);
	if (cachedState?.authorizationServerUrl) {
		authorizationServerUrl = cachedState.authorizationServerUrl;
		resourceMetadata = cachedState.resourceMetadata;
		metadata = cachedState.authorizationServerMetadata ?? await discoverAuthorizationServerMetadata(authorizationServerUrl, { fetchFn });
		if (!resourceMetadata) try {
			resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl, { resourceMetadataUrl: effectiveResourceMetadataUrl }, fetchFn);
		} catch {}
		if (metadata !== cachedState.authorizationServerMetadata || resourceMetadata !== cachedState.resourceMetadata) await provider.saveDiscoveryState?.({
			authorizationServerUrl: String(authorizationServerUrl),
			resourceMetadataUrl: effectiveResourceMetadataUrl?.toString(),
			resourceMetadata,
			authorizationServerMetadata: metadata
		});
	} else {
		const serverInfo = await discoverOAuthServerInfo(serverUrl, {
			resourceMetadataUrl: effectiveResourceMetadataUrl,
			fetchFn
		});
		authorizationServerUrl = serverInfo.authorizationServerUrl;
		metadata = serverInfo.authorizationServerMetadata;
		resourceMetadata = serverInfo.resourceMetadata;
		await provider.saveDiscoveryState?.({
			authorizationServerUrl: String(authorizationServerUrl),
			resourceMetadataUrl: effectiveResourceMetadataUrl?.toString(),
			resourceMetadata,
			authorizationServerMetadata: metadata
		});
	}
	const resource = await selectResourceURL(serverUrl, provider, resourceMetadata);
	const resolvedScope = scope || resourceMetadata?.scopes_supported?.join(" ") || provider.clientMetadata.scope;
	let clientInformation = await Promise.resolve(provider.clientInformation());
	if (!clientInformation) {
		if (authorizationCode !== void 0) throw new Error("Existing OAuth client information is required when exchanging an authorization code");
		const supportsUrlBasedClientId = metadata?.client_id_metadata_document_supported === true;
		const clientMetadataUrl = provider.clientMetadataUrl;
		if (clientMetadataUrl && !isHttpsUrl(clientMetadataUrl)) throw new InvalidClientMetadataError(`clientMetadataUrl must be a valid HTTPS URL with a non-root pathname, got: ${clientMetadataUrl}`);
		if (supportsUrlBasedClientId && clientMetadataUrl) {
			clientInformation = { client_id: clientMetadataUrl };
			await provider.saveClientInformation?.(clientInformation);
		} else {
			if (!provider.saveClientInformation) throw new Error("OAuth client information must be saveable for dynamic registration");
			const fullInformation = await registerClient(authorizationServerUrl, {
				metadata,
				clientMetadata: provider.clientMetadata,
				scope: resolvedScope,
				fetchFn
			});
			await provider.saveClientInformation(fullInformation);
			clientInformation = fullInformation;
		}
	}
	const nonInteractiveFlow = !provider.redirectUrl;
	if (authorizationCode !== void 0 || nonInteractiveFlow) {
		const tokens = await fetchToken(provider, authorizationServerUrl, {
			metadata,
			resource,
			authorizationCode,
			fetchFn
		});
		await provider.saveTokens(tokens);
		return "AUTHORIZED";
	}
	const tokens = await provider.tokens();
	if (tokens?.refresh_token) try {
		const newTokens = await refreshAuthorization(authorizationServerUrl, {
			metadata,
			clientInformation,
			refreshToken: tokens.refresh_token,
			resource,
			addClientAuthentication: provider.addClientAuthentication,
			fetchFn
		});
		await provider.saveTokens(newTokens);
		return "AUTHORIZED";
	} catch (error) {
		if (!(error instanceof OAuthError) || error instanceof ServerError) {} else throw error;
	}
	const state = provider.state ? await provider.state() : void 0;
	const { authorizationUrl, codeVerifier } = await startAuthorization(authorizationServerUrl, {
		metadata,
		clientInformation,
		state,
		redirectUrl: provider.redirectUrl,
		scope: resolvedScope,
		resource
	});
	await provider.saveCodeVerifier(codeVerifier);
	await provider.redirectToAuthorization(authorizationUrl);
	return "REDIRECT";
}
/**
* SEP-991: URL-based Client IDs
* Validate that the client_id is a valid URL with https scheme
*/
function isHttpsUrl(value) {
	if (!value) return false;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.pathname !== "/";
	} catch {
		return false;
	}
}
async function selectResourceURL(serverUrl, provider, resourceMetadata) {
	const defaultResource = resourceUrlFromServerUrl(serverUrl);
	if (provider.validateResourceURL) return await provider.validateResourceURL(defaultResource, resourceMetadata?.resource);
	if (!resourceMetadata) return;
	if (!checkResourceAllowed({
		requestedResource: defaultResource,
		configuredResource: resourceMetadata.resource
	})) throw new Error(`Protected resource ${resourceMetadata.resource} does not match expected ${defaultResource} (or origin)`);
	return new URL(resourceMetadata.resource);
}
/**
* Extract resource_metadata, scope, and error from WWW-Authenticate header.
*/
function extractWWWAuthenticateParams(res) {
	const authenticateHeader = res.headers.get("WWW-Authenticate");
	if (!authenticateHeader) return {};
	const [type, scheme] = authenticateHeader.split(" ");
	if (type.toLowerCase() !== "bearer" || !scheme) return {};
	const resourceMetadataMatch = extractFieldFromWwwAuth(res, "resource_metadata") || void 0;
	let resourceMetadataUrl;
	if (resourceMetadataMatch) try {
		resourceMetadataUrl = new URL(resourceMetadataMatch);
	} catch {}
	const scope = extractFieldFromWwwAuth(res, "scope") || void 0;
	const error = extractFieldFromWwwAuth(res, "error") || void 0;
	return {
		resourceMetadataUrl,
		scope,
		error
	};
}
/**
* Extracts a specific field's value from the WWW-Authenticate header string.
*
* @param response The HTTP response object containing the headers.
* @param fieldName The name of the field to extract (e.g., "realm", "nonce").
* @returns The field value
*/
function extractFieldFromWwwAuth(response, fieldName) {
	const wwwAuthHeader = response.headers.get("WWW-Authenticate");
	if (!wwwAuthHeader) return null;
	const pattern = new RegExp(`${fieldName}=(?:"([^"]+)"|([^\\s,]+))`);
	const match = wwwAuthHeader.match(pattern);
	if (match) return match[1] || match[2];
	return null;
}
/**
* Looks up RFC 9728 OAuth 2.0 Protected Resource Metadata.
*
* If the server returns a 404 for the well-known endpoint, this function will
* return `undefined`. Any other errors will be thrown as exceptions.
*/
async function discoverOAuthProtectedResourceMetadata(serverUrl, opts, fetchFn = fetch) {
	const response = await discoverMetadataWithFallback(serverUrl, "oauth-protected-resource", fetchFn, {
		protocolVersion: opts?.protocolVersion,
		metadataUrl: opts?.resourceMetadataUrl
	});
	if (!response || response.status === 404) {
		await response?.body?.cancel();
		throw new Error(`Resource server does not implement OAuth 2.0 Protected Resource Metadata.`);
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`HTTP ${response.status} trying to load well-known OAuth protected resource metadata.`);
	}
	return OAuthProtectedResourceMetadataSchema.parse(await response.json());
}
/**
* Helper function to handle fetch with CORS retry logic
*/
async function fetchWithCorsRetry(url, headers, fetchFn = fetch) {
	try {
		return await fetchFn(url, { headers });
	} catch (error) {
		if (error instanceof TypeError) if (headers) return fetchWithCorsRetry(url, void 0, fetchFn);
		else return;
		throw error;
	}
}
/**
* Constructs the well-known path for auth-related metadata discovery
*/
function buildWellKnownPath(wellKnownPrefix, pathname = "", options = {}) {
	if (pathname.endsWith("/")) pathname = pathname.slice(0, -1);
	return options.prependPathname ? `${pathname}/.well-known/${wellKnownPrefix}` : `/.well-known/${wellKnownPrefix}${pathname}`;
}
/**
* Tries to discover OAuth metadata at a specific URL
*/
async function tryMetadataDiscovery(url, protocolVersion, fetchFn = fetch) {
	return await fetchWithCorsRetry(url, { "MCP-Protocol-Version": protocolVersion }, fetchFn);
}
/**
* Determines if fallback to root discovery should be attempted
*/
function shouldAttemptFallback(response, pathname) {
	return !response || response.status >= 400 && response.status < 500 && pathname !== "/";
}
/**
* Generic function for discovering OAuth metadata with fallback support
*/
async function discoverMetadataWithFallback(serverUrl, wellKnownType, fetchFn, opts) {
	const issuer = new URL(serverUrl);
	const protocolVersion = opts?.protocolVersion ?? "2025-11-25";
	let url;
	if (opts?.metadataUrl) url = new URL(opts.metadataUrl);
	else {
		const wellKnownPath = buildWellKnownPath(wellKnownType, issuer.pathname);
		url = new URL(wellKnownPath, opts?.metadataServerUrl ?? issuer);
		url.search = issuer.search;
	}
	let response = await tryMetadataDiscovery(url, protocolVersion, fetchFn);
	if (!opts?.metadataUrl && shouldAttemptFallback(response, issuer.pathname)) response = await tryMetadataDiscovery(new URL(`/.well-known/${wellKnownType}`, issuer), protocolVersion, fetchFn);
	return response;
}
/**
* Builds a list of discovery URLs to try for authorization server metadata.
* URLs are returned in priority order:
* 1. OAuth metadata at the given URL
* 2. OIDC metadata endpoints at the given URL
*/
function buildDiscoveryUrls(authorizationServerUrl) {
	const url = typeof authorizationServerUrl === "string" ? new URL(authorizationServerUrl) : authorizationServerUrl;
	const hasPath = url.pathname !== "/";
	const urlsToTry = [];
	if (!hasPath) {
		urlsToTry.push({
			url: new URL("/.well-known/oauth-authorization-server", url.origin),
			type: "oauth"
		});
		urlsToTry.push({
			url: new URL(`/.well-known/openid-configuration`, url.origin),
			type: "oidc"
		});
		return urlsToTry;
	}
	let pathname = url.pathname;
	if (pathname.endsWith("/")) pathname = pathname.slice(0, -1);
	urlsToTry.push({
		url: new URL(`/.well-known/oauth-authorization-server${pathname}`, url.origin),
		type: "oauth"
	});
	urlsToTry.push({
		url: new URL(`/.well-known/openid-configuration${pathname}`, url.origin),
		type: "oidc"
	});
	urlsToTry.push({
		url: new URL(`${pathname}/.well-known/openid-configuration`, url.origin),
		type: "oidc"
	});
	return urlsToTry;
}
/**
* Discovers authorization server metadata with support for RFC 8414 OAuth 2.0 Authorization Server Metadata
* and OpenID Connect Discovery 1.0 specifications.
*
* This function implements a fallback strategy for authorization server discovery:
* 1. Attempts RFC 8414 OAuth metadata discovery first
* 2. If OAuth discovery fails, falls back to OpenID Connect Discovery
*
* @param authorizationServerUrl - The authorization server URL obtained from the MCP Server's
*                                 protected resource metadata, or the MCP server's URL if the
*                                 metadata was not found.
* @param options - Configuration options
* @param options.fetchFn - Optional fetch function for making HTTP requests, defaults to global fetch
* @param options.protocolVersion - MCP protocol version to use, defaults to LATEST_PROTOCOL_VERSION
* @returns Promise resolving to authorization server metadata, or undefined if discovery fails
*/
async function discoverAuthorizationServerMetadata(authorizationServerUrl, { fetchFn = fetch, protocolVersion = LATEST_PROTOCOL_VERSION } = {}) {
	const headers = {
		"MCP-Protocol-Version": protocolVersion,
		Accept: "application/json"
	};
	const urlsToTry = buildDiscoveryUrls(authorizationServerUrl);
	for (const { url: endpointUrl, type } of urlsToTry) {
		const response = await fetchWithCorsRetry(endpointUrl, headers, fetchFn);
		if (!response)
 /**
		* CORS error occurred - don't throw as the endpoint may not allow CORS,
		* continue trying other possible endpoints
		*/
		continue;
		if (!response.ok) {
			await response.body?.cancel();
			if (response.status >= 400 && response.status < 500) continue;
			throw new Error(`HTTP ${response.status} trying to load ${type === "oauth" ? "OAuth" : "OpenID provider"} metadata from ${endpointUrl}`);
		}
		if (type === "oauth") return OAuthMetadataSchema.parse(await response.json());
		else return OpenIdProviderDiscoveryMetadataSchema.parse(await response.json());
	}
}
/**
* Discovers the authorization server for an MCP server following
* {@link https://datatracker.ietf.org/doc/html/rfc9728 | RFC 9728} (OAuth 2.0 Protected
* Resource Metadata), with fallback to treating the server URL as the
* authorization server.
*
* This function combines two discovery steps into one call:
* 1. Probes `/.well-known/oauth-protected-resource` on the MCP server to find the
*    authorization server URL (RFC 9728).
* 2. Fetches authorization server metadata from that URL (RFC 8414 / OpenID Connect Discovery).
*
* Use this when you need the authorization server metadata for operations outside the
* {@linkcode auth} orchestrator, such as token refresh or token revocation.
*
* @param serverUrl - The MCP resource server URL
* @param opts - Optional configuration
* @param opts.resourceMetadataUrl - Override URL for the protected resource metadata endpoint
* @param opts.fetchFn - Custom fetch function for HTTP requests
* @returns Authorization server URL, metadata, and resource metadata (if available)
*/
async function discoverOAuthServerInfo(serverUrl, opts) {
	let resourceMetadata;
	let authorizationServerUrl;
	try {
		resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl, { resourceMetadataUrl: opts?.resourceMetadataUrl }, opts?.fetchFn);
		if (resourceMetadata.authorization_servers && resourceMetadata.authorization_servers.length > 0) authorizationServerUrl = resourceMetadata.authorization_servers[0];
	} catch {}
	if (!authorizationServerUrl) authorizationServerUrl = String(new URL("/", serverUrl));
	const authorizationServerMetadata = await discoverAuthorizationServerMetadata(authorizationServerUrl, { fetchFn: opts?.fetchFn });
	return {
		authorizationServerUrl,
		authorizationServerMetadata,
		resourceMetadata
	};
}
/**
* Begins the authorization flow with the given server, by generating a PKCE challenge and constructing the authorization URL.
*/
async function startAuthorization(authorizationServerUrl, { metadata, clientInformation, redirectUrl, scope, state, resource }) {
	let authorizationUrl;
	if (metadata) {
		authorizationUrl = new URL(metadata.authorization_endpoint);
		if (!metadata.response_types_supported.includes(AUTHORIZATION_CODE_RESPONSE_TYPE)) throw new Error(`Incompatible auth server: does not support response type ${AUTHORIZATION_CODE_RESPONSE_TYPE}`);
		if (metadata.code_challenge_methods_supported && !metadata.code_challenge_methods_supported.includes(AUTHORIZATION_CODE_CHALLENGE_METHOD)) throw new Error(`Incompatible auth server: does not support code challenge method ${AUTHORIZATION_CODE_CHALLENGE_METHOD}`);
	} else authorizationUrl = new URL("/authorize", authorizationServerUrl);
	const challenge = await pkceChallenge();
	const codeVerifier = challenge.code_verifier;
	const codeChallenge = challenge.code_challenge;
	authorizationUrl.searchParams.set("response_type", AUTHORIZATION_CODE_RESPONSE_TYPE);
	authorizationUrl.searchParams.set("client_id", clientInformation.client_id);
	authorizationUrl.searchParams.set("code_challenge", codeChallenge);
	authorizationUrl.searchParams.set("code_challenge_method", AUTHORIZATION_CODE_CHALLENGE_METHOD);
	authorizationUrl.searchParams.set("redirect_uri", String(redirectUrl));
	if (state) authorizationUrl.searchParams.set("state", state);
	if (scope) authorizationUrl.searchParams.set("scope", scope);
	if (scope?.includes("offline_access")) authorizationUrl.searchParams.append("prompt", "consent");
	if (resource) authorizationUrl.searchParams.set("resource", resource.href);
	return {
		authorizationUrl,
		codeVerifier
	};
}
/**
* Prepares token request parameters for an authorization code exchange.
*
* This is the default implementation used by fetchToken when the provider
* doesn't implement prepareTokenRequest.
*
* @param authorizationCode - The authorization code received from the authorization endpoint
* @param codeVerifier - The PKCE code verifier
* @param redirectUri - The redirect URI used in the authorization request
* @returns URLSearchParams for the authorization_code grant
*/
function prepareAuthorizationCodeRequest(authorizationCode, codeVerifier, redirectUri) {
	return new URLSearchParams({
		grant_type: "authorization_code",
		code: authorizationCode,
		code_verifier: codeVerifier,
		redirect_uri: String(redirectUri)
	});
}
/**
* Internal helper to execute a token request with the given parameters.
* Used by exchangeAuthorization, refreshAuthorization, and fetchToken.
*/
async function executeTokenRequest(authorizationServerUrl, { metadata, tokenRequestParams, clientInformation, addClientAuthentication, resource, fetchFn }) {
	const tokenUrl = metadata?.token_endpoint ? new URL(metadata.token_endpoint) : new URL("/token", authorizationServerUrl);
	const headers = new Headers({
		"Content-Type": "application/x-www-form-urlencoded",
		Accept: "application/json"
	});
	if (resource) tokenRequestParams.set("resource", resource.href);
	if (addClientAuthentication) await addClientAuthentication(headers, tokenRequestParams, tokenUrl, metadata);
	else if (clientInformation) applyClientAuthentication(selectClientAuthMethod(clientInformation, metadata?.token_endpoint_auth_methods_supported ?? []), clientInformation, headers, tokenRequestParams);
	const response = await (fetchFn ?? fetch)(tokenUrl, {
		method: "POST",
		headers,
		body: tokenRequestParams
	});
	if (!response.ok) throw await parseErrorResponse(response);
	return OAuthTokensSchema.parse(await response.json());
}
/**
* Exchanges an authorization code for an access token with the given server.
*
* Supports multiple client authentication methods as specified in OAuth 2.1:
* - Automatically selects the best authentication method based on server support
* - Falls back to appropriate defaults when server metadata is unavailable
*
* @param authorizationServerUrl - The authorization server's base URL
* @param options - Configuration object containing client info, auth code, etc.
* @returns Promise resolving to OAuth tokens
* @throws {Error} When token exchange fails or authentication is invalid
*/
async function exchangeAuthorization(authorizationServerUrl, { metadata, clientInformation, authorizationCode, codeVerifier, redirectUri, resource, addClientAuthentication, fetchFn }) {
	return executeTokenRequest(authorizationServerUrl, {
		metadata,
		tokenRequestParams: prepareAuthorizationCodeRequest(authorizationCode, codeVerifier, redirectUri),
		clientInformation,
		addClientAuthentication,
		resource,
		fetchFn
	});
}
/**
* Exchange a refresh token for an updated access token.
*
* Supports multiple client authentication methods as specified in OAuth 2.1:
* - Automatically selects the best authentication method based on server support
* - Preserves the original refresh token if a new one is not returned
*
* @param authorizationServerUrl - The authorization server's base URL
* @param options - Configuration object containing client info, refresh token, etc.
* @returns Promise resolving to OAuth tokens (preserves original refresh_token if not replaced)
* @throws {Error} When token refresh fails or authentication is invalid
*/
async function refreshAuthorization(authorizationServerUrl, { metadata, clientInformation, refreshToken, resource, addClientAuthentication, fetchFn }) {
	return {
		refresh_token: refreshToken,
		...await executeTokenRequest(authorizationServerUrl, {
			metadata,
			tokenRequestParams: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: refreshToken
			}),
			clientInformation,
			addClientAuthentication,
			resource,
			fetchFn
		})
	};
}
/**
* Unified token fetching that works with any grant type via provider.prepareTokenRequest().
*
* This function provides a single entry point for obtaining tokens regardless of the
* OAuth grant type. The provider's prepareTokenRequest() method determines which grant
* to use and supplies the grant-specific parameters.
*
* @param provider - OAuth client provider that implements prepareTokenRequest()
* @param authorizationServerUrl - The authorization server's base URL
* @param options - Configuration for the token request
* @returns Promise resolving to OAuth tokens
* @throws {Error} When provider doesn't implement prepareTokenRequest or token fetch fails
*
* @example
* // Provider for client_credentials:
* class MyProvider implements OAuthClientProvider {
*   prepareTokenRequest(scope) {
*     const params = new URLSearchParams({ grant_type: 'client_credentials' });
*     if (scope) params.set('scope', scope);
*     return params;
*   }
*   // ... other methods
* }
*
* const tokens = await fetchToken(provider, authServerUrl, { metadata });
*/
async function fetchToken(provider, authorizationServerUrl, { metadata, resource, authorizationCode, fetchFn } = {}) {
	const scope = provider.clientMetadata.scope;
	let tokenRequestParams;
	if (provider.prepareTokenRequest) tokenRequestParams = await provider.prepareTokenRequest(scope);
	if (!tokenRequestParams) {
		if (!authorizationCode) throw new Error("Either provider.prepareTokenRequest() or authorizationCode is required");
		if (!provider.redirectUrl) throw new Error("redirectUrl is required for authorization_code flow");
		tokenRequestParams = prepareAuthorizationCodeRequest(authorizationCode, await provider.codeVerifier(), provider.redirectUrl);
	}
	const clientInformation = await provider.clientInformation();
	return executeTokenRequest(authorizationServerUrl, {
		metadata,
		tokenRequestParams,
		clientInformation: clientInformation ?? void 0,
		addClientAuthentication: provider.addClientAuthentication,
		resource,
		fetchFn
	});
}
/**
* Performs OAuth 2.0 Dynamic Client Registration according to RFC 7591.
*
* If `scope` is provided, it overrides `clientMetadata.scope` in the registration
* request body. This allows callers to apply the Scope Selection Strategy (SEP-835)
* consistently across both DCR and the subsequent authorization request.
*/
async function registerClient(authorizationServerUrl, { metadata, clientMetadata, scope, fetchFn }) {
	let registrationUrl;
	if (metadata) {
		if (!metadata.registration_endpoint) throw new Error("Incompatible auth server: does not support dynamic client registration");
		registrationUrl = new URL(metadata.registration_endpoint);
	} else registrationUrl = new URL("/register", authorizationServerUrl);
	const response = await (fetchFn ?? fetch)(registrationUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			...clientMetadata,
			...scope !== void 0 ? { scope } : {}
		})
	});
	if (!response.ok) throw await parseErrorResponse(response);
	return OAuthClientInformationFullSchema.parse(await response.json());
}
//#endregion
Object.defineProperty(exports, "CallToolRequestSchema", {
	enumerable: true,
	get: function() {
		return CallToolRequestSchema;
	}
});
Object.defineProperty(exports, "CallToolResultSchema", {
	enumerable: true,
	get: function() {
		return CallToolResultSchema;
	}
});
Object.defineProperty(exports, "CancelTaskRequestSchema", {
	enumerable: true,
	get: function() {
		return CancelTaskRequestSchema;
	}
});
Object.defineProperty(exports, "CancelTaskResultSchema", {
	enumerable: true,
	get: function() {
		return CancelTaskResultSchema;
	}
});
Object.defineProperty(exports, "CancelledNotificationSchema", {
	enumerable: true,
	get: function() {
		return CancelledNotificationSchema;
	}
});
Object.defineProperty(exports, "CompleteRequestSchema", {
	enumerable: true,
	get: function() {
		return CompleteRequestSchema;
	}
});
Object.defineProperty(exports, "CompleteResultSchema", {
	enumerable: true,
	get: function() {
		return CompleteResultSchema;
	}
});
Object.defineProperty(exports, "CreateMessageRequestSchema", {
	enumerable: true,
	get: function() {
		return CreateMessageRequestSchema;
	}
});
Object.defineProperty(exports, "CreateMessageResultSchema", {
	enumerable: true,
	get: function() {
		return CreateMessageResultSchema;
	}
});
Object.defineProperty(exports, "CreateMessageResultWithToolsSchema", {
	enumerable: true,
	get: function() {
		return CreateMessageResultWithToolsSchema;
	}
});
Object.defineProperty(exports, "CreateTaskResultSchema", {
	enumerable: true,
	get: function() {
		return CreateTaskResultSchema;
	}
});
Object.defineProperty(exports, "DEFAULT_NEGOTIATED_PROTOCOL_VERSION", {
	enumerable: true,
	get: function() {
		return DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
	}
});
Object.defineProperty(exports, "ElicitRequestSchema", {
	enumerable: true,
	get: function() {
		return ElicitRequestSchema;
	}
});
Object.defineProperty(exports, "ElicitResultSchema", {
	enumerable: true,
	get: function() {
		return ElicitResultSchema;
	}
});
Object.defineProperty(exports, "EmptyResultSchema", {
	enumerable: true,
	get: function() {
		return EmptyResultSchema;
	}
});
Object.defineProperty(exports, "ErrorCode", {
	enumerable: true,
	get: function() {
		return ErrorCode;
	}
});
Object.defineProperty(exports, "GetPromptRequestSchema", {
	enumerable: true,
	get: function() {
		return GetPromptRequestSchema;
	}
});
Object.defineProperty(exports, "GetPromptResultSchema", {
	enumerable: true,
	get: function() {
		return GetPromptResultSchema;
	}
});
Object.defineProperty(exports, "GetTaskPayloadRequestSchema", {
	enumerable: true,
	get: function() {
		return GetTaskPayloadRequestSchema;
	}
});
Object.defineProperty(exports, "GetTaskRequestSchema", {
	enumerable: true,
	get: function() {
		return GetTaskRequestSchema;
	}
});
Object.defineProperty(exports, "GetTaskResultSchema", {
	enumerable: true,
	get: function() {
		return GetTaskResultSchema;
	}
});
Object.defineProperty(exports, "InitializeRequestSchema", {
	enumerable: true,
	get: function() {
		return InitializeRequestSchema;
	}
});
Object.defineProperty(exports, "InitializeResultSchema", {
	enumerable: true,
	get: function() {
		return InitializeResultSchema;
	}
});
Object.defineProperty(exports, "InitializedNotificationSchema", {
	enumerable: true,
	get: function() {
		return InitializedNotificationSchema;
	}
});
Object.defineProperty(exports, "JSONRPCMessageSchema", {
	enumerable: true,
	get: function() {
		return JSONRPCMessageSchema;
	}
});
Object.defineProperty(exports, "LATEST_PROTOCOL_VERSION", {
	enumerable: true,
	get: function() {
		return LATEST_PROTOCOL_VERSION;
	}
});
Object.defineProperty(exports, "ListChangedOptionsBaseSchema", {
	enumerable: true,
	get: function() {
		return ListChangedOptionsBaseSchema;
	}
});
Object.defineProperty(exports, "ListPromptsRequestSchema", {
	enumerable: true,
	get: function() {
		return ListPromptsRequestSchema;
	}
});
Object.defineProperty(exports, "ListPromptsResultSchema", {
	enumerable: true,
	get: function() {
		return ListPromptsResultSchema;
	}
});
Object.defineProperty(exports, "ListResourceTemplatesRequestSchema", {
	enumerable: true,
	get: function() {
		return ListResourceTemplatesRequestSchema;
	}
});
Object.defineProperty(exports, "ListResourceTemplatesResultSchema", {
	enumerable: true,
	get: function() {
		return ListResourceTemplatesResultSchema;
	}
});
Object.defineProperty(exports, "ListResourcesRequestSchema", {
	enumerable: true,
	get: function() {
		return ListResourcesRequestSchema;
	}
});
Object.defineProperty(exports, "ListResourcesResultSchema", {
	enumerable: true,
	get: function() {
		return ListResourcesResultSchema;
	}
});
Object.defineProperty(exports, "ListRootsResultSchema", {
	enumerable: true,
	get: function() {
		return ListRootsResultSchema;
	}
});
Object.defineProperty(exports, "ListTasksRequestSchema", {
	enumerable: true,
	get: function() {
		return ListTasksRequestSchema;
	}
});
Object.defineProperty(exports, "ListTasksResultSchema", {
	enumerable: true,
	get: function() {
		return ListTasksResultSchema;
	}
});
Object.defineProperty(exports, "ListToolsRequestSchema", {
	enumerable: true,
	get: function() {
		return ListToolsRequestSchema;
	}
});
Object.defineProperty(exports, "ListToolsResultSchema", {
	enumerable: true,
	get: function() {
		return ListToolsResultSchema;
	}
});
Object.defineProperty(exports, "LoggingLevelSchema", {
	enumerable: true,
	get: function() {
		return LoggingLevelSchema;
	}
});
Object.defineProperty(exports, "McpError", {
	enumerable: true,
	get: function() {
		return McpError;
	}
});
Object.defineProperty(exports, "PingRequestSchema", {
	enumerable: true,
	get: function() {
		return PingRequestSchema;
	}
});
Object.defineProperty(exports, "ProgressNotificationSchema", {
	enumerable: true,
	get: function() {
		return ProgressNotificationSchema;
	}
});
Object.defineProperty(exports, "PromptListChangedNotificationSchema", {
	enumerable: true,
	get: function() {
		return PromptListChangedNotificationSchema;
	}
});
Object.defineProperty(exports, "RELATED_TASK_META_KEY", {
	enumerable: true,
	get: function() {
		return RELATED_TASK_META_KEY;
	}
});
Object.defineProperty(exports, "ReadResourceRequestSchema", {
	enumerable: true,
	get: function() {
		return ReadResourceRequestSchema;
	}
});
Object.defineProperty(exports, "ReadResourceResultSchema", {
	enumerable: true,
	get: function() {
		return ReadResourceResultSchema;
	}
});
Object.defineProperty(exports, "ResourceListChangedNotificationSchema", {
	enumerable: true,
	get: function() {
		return ResourceListChangedNotificationSchema;
	}
});
Object.defineProperty(exports, "SUPPORTED_PROTOCOL_VERSIONS", {
	enumerable: true,
	get: function() {
		return SUPPORTED_PROTOCOL_VERSIONS;
	}
});
Object.defineProperty(exports, "SetLevelRequestSchema", {
	enumerable: true,
	get: function() {
		return SetLevelRequestSchema;
	}
});
Object.defineProperty(exports, "TaskStatusNotificationSchema", {
	enumerable: true,
	get: function() {
		return TaskStatusNotificationSchema;
	}
});
Object.defineProperty(exports, "ToolListChangedNotificationSchema", {
	enumerable: true,
	get: function() {
		return ToolListChangedNotificationSchema;
	}
});
Object.defineProperty(exports, "UnauthorizedError", {
	enumerable: true,
	get: function() {
		return UnauthorizedError;
	}
});
Object.defineProperty(exports, "assertCompleteRequestPrompt", {
	enumerable: true,
	get: function() {
		return assertCompleteRequestPrompt;
	}
});
Object.defineProperty(exports, "assertCompleteRequestResourceTemplate", {
	enumerable: true,
	get: function() {
		return assertCompleteRequestResourceTemplate;
	}
});
Object.defineProperty(exports, "auth", {
	enumerable: true,
	get: function() {
		return auth;
	}
});
Object.defineProperty(exports, "auth_exports", {
	enumerable: true,
	get: function() {
		return auth_exports;
	}
});
Object.defineProperty(exports, "extractWWWAuthenticateParams", {
	enumerable: true,
	get: function() {
		return extractWWWAuthenticateParams;
	}
});
Object.defineProperty(exports, "isInitializeRequest", {
	enumerable: true,
	get: function() {
		return isInitializeRequest;
	}
});
Object.defineProperty(exports, "isInitializedNotification", {
	enumerable: true,
	get: function() {
		return isInitializedNotification;
	}
});
Object.defineProperty(exports, "isJSONRPCErrorResponse", {
	enumerable: true,
	get: function() {
		return isJSONRPCErrorResponse;
	}
});
Object.defineProperty(exports, "isJSONRPCNotification", {
	enumerable: true,
	get: function() {
		return isJSONRPCNotification;
	}
});
Object.defineProperty(exports, "isJSONRPCRequest", {
	enumerable: true,
	get: function() {
		return isJSONRPCRequest;
	}
});
Object.defineProperty(exports, "isJSONRPCResultResponse", {
	enumerable: true,
	get: function() {
		return isJSONRPCResultResponse;
	}
});
Object.defineProperty(exports, "isTaskAugmentedRequestParams", {
	enumerable: true,
	get: function() {
		return isTaskAugmentedRequestParams;
	}
});
