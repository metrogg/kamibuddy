import { Ys as SHARE_TASK_TITLE_CONTAINS_SENSITIVE_CONTENT_CODE, Zs as ShareTaskError, cW as init_common, nc as init_share_selection_utils } from "./ui-docs-viewer-C2jT2eXi.js";
import { r as init_share_html_zip, t as buildHtmlDependencyZip } from "./share-html-zip-CXVcRCMB.js";
//#region ../../packages/agent-ui/src/components/share-preview/task/html-generator/artifact-upload.ts
init_common();
init_share_selection_utils();
init_share_html_zip();
/**
* 并行上传所有产物到知识空间，返回 path → { url, type } 映射。
* 单个产物上传失败时该 path 不出现在返回 Map 中，整体不 reject。
*/
async function uploadArtifacts(artifacts, backendProvider, knowledgeOptions) {
	const results = /* @__PURE__ */ new Map();
	if (!backendProvider.uploadToKnowledge) {
		console.warn("[uploadArtifacts] uploadToKnowledge not available, skip all artifacts");
		return results;
	}
	await Promise.all(artifacts.map(async (artifact) => {
		if (!artifact.blob) return;
		try {
			let uploadBlob = artifact.blob;
			let uploadName = artifact.name;
			if (artifact.name.toLowerCase().endsWith(".html") && artifact.readBlob) {
				const htmlText = await artifact.blob.text();
				const zipResult = await buildHtmlDependencyZip({
					entryPath: artifact.path,
					entryBlob: artifact.blob,
					entryText: htmlText,
					readBlob: artifact.readBlob,
					entryName: artifact.name
				});
				if (zipResult) {
					const stem = artifact.name.replace(/\.html?$/i, "");
					uploadBlob = zipResult.blob;
					uploadName = `${stem}.zip`;
				}
			}
			const res = await backendProvider.uploadToKnowledge(uploadBlob, uploadName, knowledgeOptions);
			if (res && "errorCode" in res && res.errorCode === 619610) {
				console.warn("[uploadArtifacts] artifact title blocked by moderation:", artifact.name);
				throw new ShareTaskError(SHARE_TASK_TITLE_CONTAINS_SENSITIVE_CONTENT_CODE);
			}
			if (res && "url" in res && res.url) results.set(artifact.path, {
				url: res.url,
				type: "knowledge",
				nodeId: res.nodeId,
				nodeKind: res.nodeKind,
				size: artifact.blob?.size
			});
		} catch (err) {
			if (err instanceof ShareTaskError) throw err;
			console.warn("[uploadArtifacts] failed to upload artifact:", artifact.name, err);
		}
	}));
	return results;
}
//#endregion
export { uploadArtifacts as t };
