/**
 * 探针：API Key 跨进程持久化。
 *
 * 回答的问题：设置页填的 key，daemon 重启后还在吗？
 *
 * 背景（用户实测踩到的 bug）：曾只用 `runtime.setRuntimeApiKey()` 存 key，
 * 而 pi 的 RuntimeCredentials 自述是 "overlay for **non-persistent** runtime API keys"
 * —— 只写进程内 Map。修复后先写 auth.json（core/api-keys.ts）再同步 runtime。
 *
 * 本探针的判据模拟真实重启：第一个 ModelCatalog 实例存 key，
 * 然后**新建**第二个实例（等价于重启后重新 create），检查它把该 provider
 * 报告为 configured，来源为 "stored"（= 从 auth.json 读到）。
 *
 * 用法：npx tsx scripts/probe-key-persistence.ts
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export {};

const workDir = mkdtempSync(join(tmpdir(), "kami-keypersist-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");

const { ModelCatalog } = await import("../src/core/model-catalog.ts");

const PROVIDER = "deepseek"; // pi 内置服务商，无需自定义配置即可存 key

// 第一次「运行」：填 key（等价用户在设置页操作）。
const first = await ModelCatalog.create();
await first.setApiKey(PROVIDER, "sk-probe-persist-test");
const duringFirst = first.snapshot(undefined).providers.find((p) => p.id === PROVIDER);
console.log(`第一次运行内：configured=${duringFirst?.configured} source=${duringFirst?.source}`);

// 第二次「运行」：全新实例，等价 daemon 重启后重新 create。
const second = await ModelCatalog.create();
const after = second.snapshot(undefined).providers.find((p) => p.id === PROVIDER);
console.log(`重启后（新实例）：configured=${after?.configured} source=${after?.source}`);

// 清掉测试凭据，并验证删除也跨实例生效。
await second.removeApiKey(PROVIDER);
const third = await ModelCatalog.create();
const cleaned = third.snapshot(undefined).providers.find((p) => p.id === PROVIDER);
console.log(`删除并再次重启后：configured=${cleaned?.configured}`);

rmSync(workDir, { recursive: true, force: true });

const pass = after?.configured === true && after?.source === "stored" && cleaned?.configured === false;
console.log(`\n${pass ? "PASS：key 跨重启持久化，删除亦然" : "FAIL：持久化不成立"}`);
if (!pass) process.exitCode = 1;
