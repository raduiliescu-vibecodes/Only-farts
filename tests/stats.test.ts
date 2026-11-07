import { describe, expect, it } from "vitest";
import { levelPace, rankBy, seriesFor, summarize, valueAsOf, snapshotsFor } from "@/lib/stats";
import type { CharacterConfig, CharacterSummary, Snapshot } from "@/lib/types";

const taipan: CharacterConfig = {
  slug: "taipan-ismydaddy",
  region: "eu",
  displayName: "Taipan",
  aotcUrl: "https://www.aotc.gg/forever/character/eu/taipan-ismydaddy",
  colorSlot: 1,
};

function snap(partial: Partial<Snapshot> & Pick<Snapshot, "capturedAt">): Snapshot {
  return { character: taipan.slug, source: "manual", level: null, gearScore: null, ...partial };
}

function row(name: string, level: number | null, gearScore: number | null): CharacterSummary {
  return {
    slug: name.toLowerCase(),
    displayName: name,
    region: "eu",
    realm: null,
    aotcUrl: "",
    colorSlot: 1,
    level,
    gearScore,
    itemLevel: null,
    className: null,
    race: null,
    guild: null,
    honorableKills: null,
    sheet: null,
    lastUpdated: null,
    snapshotCount: 0,
    levelDelta: null,
    gearScoreDelta: null,
  };
}

describe("summarize", () => {
  it("returns nulls when there are no snapshots", () => {
    const s = summarize(taipan, []);
    expect(s.level).toBeNull();
    expect(s.gearScore).toBeNull();
    expect(s.lastUpdated).toBeNull();
    expect(s.snapshotCount).toBe(0);
  });

  it("takes the latest non-null value per field regardless of input order", () => {
    const s = summarize(taipan, [
      snap({ capturedAt: "2026-11-06T10:00:00Z", level: 20, gearScore: 300, className: "Hunter" }),
      snap({ capturedAt: "2026-11-07T10:00:00Z", level: 24, gearScore: null }),
      snap({ capturedAt: "2026-11-05T10:00:00Z", level: 12, gearScore: 150 }),
    ]);
    expect(s.level).toBe(24);
    expect(s.gearScore).toBe(300);
    expect(s.className).toBe("Hunter");
    expect(s.lastUpdated).toBe("2026-11-07T10:00:00Z");
    expect(s.snapshotCount).toBe(3);
  });

  it("computes 7-day deltas, falling back to the first snapshot when history is shorter", () => {
    const s = summarize(taipan, [
      snap({ capturedAt: "2026-11-05T10:00:00Z", level: 10, gearScore: 100 }),
      snap({ capturedAt: "2026-11-07T10:00:00Z", level: 25, gearScore: 400 }),
    ]);
    expect(s.levelDelta).toEqual({ value: 15, days: 2 });
    expect(s.gearScoreDelta).toEqual({ value: 300, days: 2 });
  });

  it("uses the value as of 7 days before the latest snapshot when available", () => {
    const s = summarize(taipan, [
      snap({ capturedAt: "2026-10-01T00:00:00Z", level: 5 }),
      snap({ capturedAt: "2026-11-01T00:00:00Z", level: 40 }),
      snap({ capturedAt: "2026-11-10T00:00:00Z", level: 50 }),
    ]);
    expect(s.levelDelta).toEqual({ value: 10, days: 7 });
  });
});

describe("character sheet", () => {
  it("takes stats and talents from the latest snapshot that has them, without mixing", () => {
    const s = summarize(taipan, [
      snap({ capturedAt: "2026-11-06T10:00:00Z", level: 15, stats: { health: 300, mana: 700 }, honorableKills: 0 }),
      snap({
        capturedAt: "2026-11-07T10:00:00Z",
        level: 18,
        stats: { health: 357 },
        talents: [{ tree: "Shadow", points: 7 }],
      }),
      snap({ capturedAt: "2026-11-08T10:00:00Z", level: 19 }),
    ]);
    expect(s.sheet).toEqual({
      capturedAt: "2026-11-07T10:00:00Z",
      stats: { health: 357 },
      talents: [{ tree: "Shadow", points: 7 }],
    });
    expect(s.honorableKills).toBe(0);
    expect(s.level).toBe(19);
  });

  it("is null when no snapshot has stats", () => {
    expect(summarize(taipan, [snap({ capturedAt: "2026-11-07T10:00:00Z", level: 3 })]).sheet).toBeNull();
  });
});

describe("rankBy", () => {
  it("ranks highest first, shares ranks on ties and puts unknowns last", () => {
    const ranked = rankBy(
      [row("A", 30, 500), row("B", 40, 700), row("C", 20, 700), row("D", null, null)],
      "gearScore",
    );
    expect(ranked.map((r) => [r.displayName, r.rank])).toEqual([
      ["B", 1], // tie on GS, level breaks display order
      ["C", 1],
      ["A", 3],
      ["D", null],
    ]);
  });

  it("ranks by level", () => {
    const ranked = rankBy([row("A", 30, 900), row("B", 40, 100)], "level");
    expect(ranked[0].displayName).toBe("B");
    expect(ranked[0].rank).toBe(1);
  });
});

describe("series and helpers", () => {
  const snaps = [
    snap({ capturedAt: "2026-11-05T00:00:00Z", level: 10 }),
    snap({ capturedAt: "2026-11-06T00:00:00Z", level: null, gearScore: 200 }),
    snap({ capturedAt: "2026-11-07T00:00:00Z", level: 17 }),
  ];

  it("builds series points only where the field has a value", () => {
    const [s] = seriesFor([taipan], snaps, "level");
    expect(s.points.map((p) => p.v)).toEqual([10, 17]);
    expect(s.slot).toBe(1);
  });

  it("valueAsOf holds the last known value", () => {
    const ordered = snapshotsFor(snaps, taipan.slug);
    expect(valueAsOf(ordered, "level", Date.parse("2026-11-06T12:00:00Z"))).toBe(10);
    expect(valueAsOf(ordered, "level", Date.parse("2026-11-04T00:00:00Z"))).toBeNull();
  });

  it("levelPace is levels per day over the window", () => {
    const pace = levelPace(snapshotsFor(snaps, taipan.slug));
    expect(pace?.perDay).toBeCloseTo(3.5);
    expect(pace?.days).toBe(2);
    expect(levelPace([])).toBeNull();
  });
});
