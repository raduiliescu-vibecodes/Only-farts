import type { TalentTree } from "./extra";

export type ColorSlot = 1 | 2 | 3 | 4;

export interface CharacterConfig {
  /** AOTC.gg profile slug, e.g. "taipan-ismydaddy". */
  slug: string;
  region: string;
  /** Realm or realm type as shown on AOTC.gg, e.g. "Normal". Omitted when unknown. */
  realm?: string;
  displayName: string;
  aotcUrl: string;
  /** Fixed categorical color slot. Color follows the character, never its rank. */
  colorSlot: ColorSlot;
}

export interface CharactersFile {
  game: string;
  maxLevel: number;
  characters: CharacterConfig[];
}

export type SnapshotSource = "aotc" | "manual";

/** One observation of a character at a point in time. Unknown values are null. */
export interface Snapshot {
  character: string;
  /** ISO 8601 timestamp (UTC). */
  capturedAt: string;
  source: SnapshotSource;
  level: number | null;
  gearScore: number | null;
  itemLevel?: number | null;
  className?: string | null;
  race?: string | null;
  guild?: string | null;
  honorableKills?: number | null;
  /** Character-sheet stats keyed by STAT_DEFS keys (percentages as numbers, e.g. 5.3). */
  stats?: Record<string, number> | null;
  talents?: TalentTree[] | null;
  note?: string | null;
}

export interface HistoryFile {
  snapshots: Snapshot[];
}

export type SyncResult =
  | "ok"
  | "blocked"
  | "http_error"
  | "network_error"
  | "parse_failed"
  | "never";

export interface CharacterSyncStatus {
  result: SyncResult;
  message: string;
  /** When the current result was first observed (ISO). */
  since: string | null;
  lastSuccessAt: string | null;
}

export interface SyncStatusFile {
  characters: Record<string, CharacterSyncStatus>;
}

/** Latest known values for a character, merged across its snapshots. */
export interface CharacterSummary {
  slug: string;
  displayName: string;
  region: string;
  realm: string | null;
  aotcUrl: string;
  colorSlot: ColorSlot;
  level: number | null;
  gearScore: number | null;
  itemLevel: number | null;
  className: string | null;
  race: string | null;
  guild: string | null;
  honorableKills: number | null;
  /** Stats and talents from the latest snapshot that has them (never mixed across snapshots). */
  sheet: { capturedAt: string; stats: Record<string, number>; talents: TalentTree[] | null } | null;
  lastUpdated: string | null;
  snapshotCount: number;
  /**
   * Change over (up to) the 7 days before the latest snapshot, and the length
   * of that window in days. Shorter when tracking started less than 7 days ago.
   */
  levelDelta: Delta | null;
  gearScoreDelta: Delta | null;
}

export interface Delta {
  value: number;
  days: number;
}

export type RankMetric = "gearScore" | "level";

export interface RankedRow extends CharacterSummary {
  /** Standard competition rank (1, 1, 3); null when the metric is unknown. */
  rank: number | null;
}

export interface SeriesPoint {
  t: number;
  v: number;
}

export interface ChartSeries {
  id: string;
  name: string;
  slot: ColorSlot;
  points: SeriesPoint[];
}
