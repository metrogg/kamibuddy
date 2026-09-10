import { n as __esmMin } from "./rolldown-runtime-D5a2oYpF.js";
//#region ../../packages/workbuddy-server/src/tencent-lexiang/contract.ts
/**
* 类型守卫：判断一个未知错误是否是 `LexiangSpApiError` 实例。
*
* 跨 bundle / 热重载时 `instanceof` 可能失效，兜底按 `name` 判断。
*/
function isLexiangSpApiError(err) {
	return err instanceof LexiangSpApiError || typeof err === "object" && err !== null && err.name === "LexiangSpApiError";
}
var TENCENT_LEXIANG_RPC_CHANNELS, LexiangSpApiError;
var init_contract = __esmMin((() => {
	TENCENT_LEXIANG_RPC_CHANNELS = {
		GATEWAY_POST: "tencentLexiang:gatewayPost",
		UPLOAD_LEXIANG_FILE: "tencentLexiang:uploadLexiangFile",
		UPLOAD_LEXIANG_FOLDER: "tencentLexiang:uploadLexiangFolder",
		UPLOAD_LEXIANG_HTML: "tencentLexiang:uploadLexiangHtml",
		CLEAR_WEB_COOKIES: "tencentLexiang:clearWebCookies",
		CHECK_LICENSE: "tencentLexiang:checkLicense",
		CHECK_COMPANY_STATUS: "tencentLexiang:checkCompanyStatus",
		SP_API_REQUEST: "tencentLexiang:spApiRequest",
		INVALIDATE_ACCESS_TOKEN: "tencentLexiang:invalidateAccessToken"
	};
	LexiangSpApiError = class extends Error {
		constructor(opts) {
			super(opts.message);
			this.name = "LexiangSpApiError";
			this.status = opts.status;
			this.method = opts.method;
			this.path = opts.path;
			this.reqId = opts.reqId;
			this.serverRequestId = opts.serverRequestId;
			this.bodySnippet = opts.bodySnippet;
		}
	};
}));
//#endregion
export { init_contract as n, isLexiangSpApiError as r, TENCENT_LEXIANG_RPC_CHANNELS as t };
