import { describe, expect, it } from "vitest";
import { appendSnapshot, nextSyncStatus, shouldRecord } from "@/lib/snapshots";
import type { Snapshot } from "@/lib/types";

const base: Snapshot = {
  character: "sisu-jr",
  capturedAt: "2026-11-07T06:00:00Z",
  source: "aotc",
  level: 30,
  gearScore: 800,
};

describe("shouldRecord", () => {
  it("records the first snapshot", () => {
    expect(shouldRecord(undefined, base)).toBe(true);
  });
  it("skips an unchanged snapshot on the same UTC day", () => {
    expect(shouldRecord(base, { ...base, capturedAt: "2026-11-07T12:00:00Z" })).toBe(false);
  });
  it("records when a value changes", () => {
    expect(shouldRecord(base, { ...base, capturedAt: "2026-11-07T12:00:00Z", level: 31 })).toBe(true);
  });
  it("records a daily heartbeat when values are flat", () => {
    expect(shouldRecord(base, { ...base, capturedAt: "2026-11-08T00:10:00Z" })).toBe(true);
  });
  it("ignores fields the new snapshot does not know", () => {
    expect(shouldRecord(base, { ...base, capturedAt: "2026-11-07T12:00:00Z", gearScore: null })).toBe(false);
  });
});

describe("appendSnapshot", () => {
  it("keeps history sorted and rejects duplicates", () => {
    const h1 = appendSnapshot({ snapshots: [] }, { ...base, capturedAt: "2026-11-07T12:00:00Z" });
    const h2 = appendSnapshot(h1, base);
    expect(h2.snapshots.map((s) => s.capturedAt)).toEqual(["2026-11-07T06:00:00Z", "2026-11-07T12:00:00Z"]);
    expect(() => appendSnapshot(h2, base)).toThrow(/already exists/);
  });
});

describe("nextSyncStatus", () => {
  const blocked = { kind: "blocked" as const, status: 429, message: "Checkpoint" };

  it("keeps `since` while the same failure repeats, so the file does not churn", () => {
    const first = nextSyncStatus(undefined, blocked, "2026-11-07T00:00:00Z");
    const again = nextSyncStatus(first, blocked, "2026-11-07T06:00:00Z");
    expect(again).toEqual(first);
  });

  it("records success time and keeps it through later failures", () => {
    const ok = nextSyncStatus(
      undefined,
      {
        kind: "ok",
        status: 200,
        profile: { level: 1, gearScore: null, itemLevel: null, className: null, race: null, guild: null, strategy: "json" },
      },
      "2026-11-07T00:00:00Z",
    );
    expect(ok.lastSuccessAt).toBe("2026-11-07T00:00:00Z");
    const later = nextSyncStatus(ok, blocked, "2026-11-07T06:00:00Z");
    expect(later.result).toBe("blocked");
    expect(later.lastSuccessAt).toBe("2026-11-07T00:00:00Z");
  });
});
