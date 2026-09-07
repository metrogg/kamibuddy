import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventLog } from "./event-log.ts";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kamibuddy-eventlog-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("EventLog", () => {
	it("追加的记录是一行一个 JSON，且统一带 ts", () => {
		const log = new EventLog(dir, () => new Date("2026-09-07T10:00:00Z").getTime());
		log.append({ kind: "ipc", channel: "session:prompt" });
		log.append({ kind: "session_event", type: "run_started" });

		const lines = readFileSync(join(dir, "events-2026-09-07.jsonl"), "utf8").trim().split("\n");
		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines[0]!)).toEqual({
			ts: new Date("2026-09-07T10:00:00Z").getTime(),
			kind: "ipc",
			channel: "session:prompt",
		});
		expect(JSON.parse(lines[1]!)).toMatchObject({ kind: "session_event", type: "run_started" });
	});

	it("跨天写到不同文件", () => {
		let now = new Date("2026-09-07T23:59:59Z").getTime();
		const log = new EventLog(dir, () => now);
		log.append({ kind: "a" });
		now = new Date("2026-09-08T00:00:01Z").getTime();
		log.append({ kind: "b" });

		expect(readdirSync(dir).sort()).toEqual(["events-2026-09-07.jsonl", "events-2026-09-08.jsonl"]);
	});

	it("目录不存在时自动创建", () => {
		const nested = join(dir, "deep", "logs");
		const log = new EventLog(nested, () => Date.now());
		log.append({ kind: "a" });
		expect(readdirSync(nested)).toHaveLength(1);
	});
});
