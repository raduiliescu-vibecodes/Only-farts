import type {
  CharacterConfig,
  Delta,
  CharacterSummary,
  ChartSeries,
  RankMetric,
  RankedRow,
  Snapshot,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function time(s: Snapshot): number {
  return Date.parse(s.capturedAt);
}

/** Snapshots for one character, oldest first. Invalid timestamps are dropped. */
export function snapshotsFor(snapshots: Snapshot[], slug: string): Snapshot[] {
  return snapshots
    .filter((s) => s.character === slug && Number.isFinite(time(s)))
    .sort((a, b) => time(a) - time(b));
}

type NumericField = "level" | "gearScore" | "itemLevel" | "honorableKills";
type TextField = "className" | "race" | "guild";

function latestValue<K extends NumericField | TextField>(
  ordered: Snapshot[],
  field: K,
): NonNullable<Snapshot[K]> | null {
  for (let i = ordered.length - 1; i >= 0; i--) {
    const v = ordered[i][field];
    if (v !== null && v !== undefined && v !== "") {
      return v as NonNullable<Snapshot[K]>;
    }
  }
  return null;
}

/** Value of `field` as of time `t`: the latest non-null value at or before t. */
export function valueAsOf(
  ordered: Snapshot[],
  field: NumericField,
  t: number,
): number | null {
  let result: number | null = null;
  for (const s of ordered) {
    if (time(s) > t) break;
    const v = s[field];
    if (typeof v === "number" && Number.isFinite(v)) result = v;
  }
  return result;
}

function delta7d(ordered: Snapshot[], field: NumericField): Delta | null {
  const known = ordered.filter((s) => typeof s[field] === "number");
  if (known.length < 2) return null;
  const last = known[known.length - 1];
  const end = time(last);
  const cutoff = end - 7 * DAY_MS;
  const before = valueAsOf(known, field, cutoff);
  // Fall back to the earliest known value when tracking started less than 7 days ago.
  const base = before !== null ? { v: before, t: cutoff } : { v: known[0][field] as number, t: time(known[0]) };
  const days = (end - base.t) / DAY_MS;
  if (days <= 0) return null;
  return { value: (last[field] as number) - base.v, days };
}

function latestSheet(ordered: Snapshot[]): CharacterSummary["sheet"] {
  for (let i = ordered.length - 1; i >= 0; i--) {
    const s = ordered[i];
    const hasStats = s.stats && Object.keys(s.stats).length > 0;
    if (hasStats || (s.talents && s.talents.length > 0)) {
      return { capturedAt: s.capturedAt, stats: s.stats ?? {}, talents: s.talents ?? null };
    }
  }
  return null;
}

export function summarize(
  character: CharacterConfig,
  snapshots: Snapshot[],
): CharacterSummary {
  const ordered = snapshotsFor(snapshots, character.slug);
  const last = ordered[ordered.length - 1];
  return {
    slug: character.slug,
    displayName: character.displayName,
    region: character.region,
    realm: character.realm ?? null,
    aotcUrl: character.aotcUrl,
    colorSlot: character.colorSlot,
    level: latestValue(ordered, "level"),
    gearScore: latestValue(ordered, "gearScore"),
    itemLevel: latestValue(ordered, "itemLevel"),
    className: latestValue(ordered, "className"),
    race: latestValue(ordered, "race"),
    guild: latestValue(ordered, "guild"),
    honorableKills: latestValue(ordered, "honorableKills"),
    sheet: latestSheet(ordered),
    lastUpdated: last ? last.capturedAt : null,
    snapshotCount: ordered.length,
    levelDelta: delta7d(ordered, "level"),
    gearScoreDelta: delta7d(ordered, "gearScore"),
  };
}

/**
 * Rank characters by a metric, highest first. Ties share a rank (1, 1, 3);
 * the secondary metric breaks display order only. Unknown values sort last
 * with a null rank.
 */
export function rankBy(rows: CharacterSummary[], metric: RankMetric): RankedRow[] {
  const secondary: RankMetric = metric === "gearScore" ? "level" : "gearScore";
  const sorted = [...rows].sort((a, b) => {
    const av = a[metric];
    const bv = b[metric];
    if (av === null && bv === null) return a.displayName.localeCompare(b.displayName);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (bv !== av) return bv - av;
    const as = a[secondary] ?? -Infinity;
    const bs = b[secondary] ?? -Infinity;
    if (bs !== as) return bs - as;
    return a.displayName.localeCompare(b.displayName);
  });

  let lastValue: number | null = null;
  let lastRank = 0;
  return sorted.map((row, i) => {
    const v = row[metric];
    if (v === null) return { ...row, rank: null };
    const rank = v === lastValue ? lastRank : i + 1;
    lastValue = v;
    lastRank = rank;
    return { ...row, rank };
  });
}

export function seriesFor(
  characters: CharacterConfig[],
  snapshots: Snapshot[],
  field: NumericField,
): ChartSeries[] {
  return characters.map((c) => ({
    id: c.slug,
    name: c.displayName,
    slot: c.colorSlot,
    points: snapshotsFor(snapshots, c.slug).flatMap((s) => {
      const v = s[field];
      return typeof v === "number" && Number.isFinite(v)
        ? [{ t: time(s), v }]
        : [];
    }),
  }));
}

/** Average levels gained per day over (up to) the last 7 days of tracking. */
export function levelPace(ordered: Snapshot[]): { perDay: number; days: number } | null {
  const withLevel = ordered.filter((s) => typeof s.level === "number");
  if (withLevel.length < 2) return null;
  const end = withLevel[withLevel.length - 1];
  const windowStart = time(end) - 7 * DAY_MS;
  const start = withLevel.find((s) => time(s) >= windowStart) ?? withLevel[0];
  const days = (time(end) - time(start)) / DAY_MS;
  if (days <= 0 || start === end) return null;
  return { perDay: ((end.level as number) - (start.level as number)) / days, days };
}
