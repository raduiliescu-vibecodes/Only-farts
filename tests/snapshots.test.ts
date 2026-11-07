import { describe, expect, it } from "vitest";
import { addSnapshot, appendSnapshot, nextSyncStatus, sameSnapshot, shouldRecord } from "@/lib/snapshots";
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

describe("addSnapshot (idempotent manual recording)", () => {
  const manual: Snapshot = {
    character: "phender-kx",
    capturedAt: "2026-11-07T15:43:00Z",
    source: "manual",
    level: 18,
    gearScore: 105,
    itemLevel: 11,
    stats: { health: 574, mainHandDps: 24.2 },
    talents: [{ tree: "Protection", points: 9 }],
  };

  it("adds a new snapshot", () => {
    const r = addSnapshot({ snapshots: [] }, manual);
    expect(r.added).toBe(true);
    expect(r.history.snapshots).toHaveLength(1);
  });

  it("is a no-op when the identical snapshot is recorded again (workflow re-run)", () => {
    const once = addSnapshot({ snapshots: [] }, manual).history;
    // Same content in a different key order (the script normalises timestamps before this).
    const again = addSnapshot(once, {
      talents: [{ points: 9, tree: "Protection" }],
      stats: { mainHandDps: 24.2, health: 574 },
      itemLevel: 11,
      gearScore: 105,
      level: 18,
      source: "manual",
      capturedAt: "2026-11-07T15:43:00Z",
      character: "phender-kx",
    });
    expect(again.added).toBe(false);
    expect(again.history.snapshots).toHaveLength(1);
  });

  it("refuses a different snapshot at the same time instead of overwriting history", () => {
    const once = addSnapshot({ snapshots: [] }, manual).history;
    expect(() => addSnapshot(once, { ...manual, gearScore: 106 })).toThrow(/different snapshot/);
    expect(once.snapshots[0].gearScore).toBe(105);
  });

  it("leaves other characters' snapshots untouched", () => {
    const taipan: Snapshot = { ...base, character: "taipan-ismydaddy", capturedAt: "2026-11-07T15:27:00Z" };
    const r = addSnapshot({ snapshots: [taipan] }, manual);
    expect(r.history.snapshots[0]).toBe(taipan);
    expect(sameSnapshot(r.history.snapshots[0], taipan)).toBe(true);
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
