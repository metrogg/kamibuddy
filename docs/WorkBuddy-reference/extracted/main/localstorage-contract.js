//#region ../../packages/workbuddy-server/src/migration/localstorage-contract.ts
var PINNED_CONVERSATIONS_STORAGE_KEY = "workbuddy-pinned-conversations";
var LEGACY_DISPLAY_LANGUAGE_STORAGE_KEYS = ["CODEBUDDY_IDE_STORAGE_LANG", "workbuddy-language"];
//#endregion
Object.defineProperty(exports, "LEGACY_DISPLAY_LANGUAGE_STORAGE_KEYS", {
	enumerable: true,
	get: function() {
		return LEGACY_DISPLAY_LANGUAGE_STORAGE_KEYS;
	}
});
Object.defineProperty(exports, "PINNED_CONVERSATIONS_STORAGE_KEY", {
	enumerable: true,
	get: function() {
		return PINNED_CONVERSATIONS_STORAGE_KEY;
	}
});
