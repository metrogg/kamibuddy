//#region ../../node_modules/.pnpm/normalize-path@3.0.0/node_modules/normalize-path/index.js
var require_normalize_path = /* @__PURE__ */ require("./chunk.js").__commonJSMin(((exports, module) => {
	/*!
	* normalize-path <https://github.com/jonschlinkert/normalize-path>
	*
	* Copyright (c) 2014-2018, Jon Schlinkert.
	* Released under the MIT License.
	*/
	module.exports = function(path, stripTrailing) {
		if (typeof path !== "string") throw new TypeError("expected path to be a string");
		if (path === "\\" || path === "/") return "/";
		var len = path.length;
		if (len <= 1) return path;
		var prefix = "";
		if (len > 4 && path[3] === "\\") {
			var ch = path[2];
			if ((ch === "?" || ch === ".") && path.slice(0, 2) === "\\\\") {
				path = path.slice(2);
				prefix = "//";
			}
		}
		var segs = path.split(/[/\\]+/);
		if (stripTrailing !== false && segs[segs.length - 1] === "") segs.pop();
		return prefix + segs.join("/");
	};
}));
//#endregion
Object.defineProperty(exports, "require_normalize_path", {
	enumerable: true,
	get: function() {
		return require_normalize_path;
	}
});
