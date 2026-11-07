import type { FetchOutcome, ParsedProfile } from "./aotc";
import type { CharacterSyncStatus, HistoryFile, Snapshot, SyncResult } from "./types";

const COMPARED: (keyof Snapshot)[] = ["level", "gearScore", "itemLevel", "className", "race", "guild", "honorableKills"];
const COMPARED_DEEP: (keyof Snapshot)[] = ["stats", "talents"];

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Record a synced snapshot when anything changed, or at least once per UTC day
 * so the history keeps a heartbeat while values stay flat.
 */
export function shouldRecord(prev: Snapshot | undefined, next: Snapshot): boolean {
  if (!prev) return true;
  for (const k of COMPARED) {
    const nv = next[k];
    if (nv !== null && nv !== undefined && nv !== prev[k]) return true;
  }
  for (const k of COMPARED_DEEP) {
    const nv = next[k];
    if (nv !== null && nv !== undefined && stableStringify(nv) !== stableStringify(prev[k] ?? null)) return true;
  }
  return utcDay(prev.capturedAt) !== utcDay(next.capturedAt);
}

export function latestSnapshot(history: HistoryFile, slug: string): Snapshot | undefined {
  return history.snapshots
    .filter((s) => s.character === slug)
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
    .at(-1);
}

/** JSON with object keys sorted, so equal content compares equal regardless of key order. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return stableStringify(a) === stableStringify(b);
}

export type AddResult = { history: HistoryFile; added: boolean };

/**
 * Idempotent add for manual snapshots: an identical snapshot (same character,
 * time and values) is a no-op, so re-running the workflow never duplicates.
 * A *different* snapshot at the same character and time is refused, so
 * recorded history is never silently overwritten.
 */
export function addSnapshot(history: HistoryFile, snap: Snapshot): AddResult {
  const existing = history.snapshots.find(
    (s) => s.character === snap.character && Date.parse(s.capturedAt) === Date.parse(snap.capturedAt),
  );
  if (existing) {
    if (sameSnapshot(existing, snap)) return { history, added: false };
    throw new Error(
      `A different snapshot for ${snap.character} at ${snap.capturedAt} already exists. ` +
        "Recorded history is not overwritten; correct data/history.json by hand if it is wrong.",
    );
  }
  return { history: appendSnapshot(history, snap), added: true };
}

export function appendSnapshot(history: HistoryFile, snap: Snapshot): HistoryFile {
  const exists = history.snapshots.some(
    (s) => s.character === snap.character && s.capturedAt === snap.capturedAt,
  );
  if (exists) throw new Error(`A snapshot for ${snap.character} at ${snap.capturedAt} already exists.`);
  const snapshots = [...history.snapshots, snap].sort(
    (a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt) || a.character.localeCompare(b.character),
  );
  return { ...history, snapshots };
}

export function snapshotFromProfile(slug: string, profile: ParsedProfile, capturedAt: string): Snapshot {
  return {
    character: slug,
    capturedAt,
    source: "aotc",
    level: profile.level,
    gearScore: profile.gearScore,
    itemLevel: profile.itemLevel,
    className: profile.className,
    race: profile.race,
    guild: profile.guild,
  };
}

/**
 * Next sync status. `since` only moves when the result or message changes, so a
 * run that sees the same failure again leaves the file (and git) untouched.
 */
/** Status transition for any source: `since` moves only when result or message change. */
export function statusFor(
  prev: CharacterSyncStatus | undefined,
  result: SyncResult,
  message: string,
  now: string,
): CharacterSyncStatus {
  const unchanged = prev && prev.result === result && prev.message === message;
  return {
    result,
    message,
    since: unchanged ? prev.since : now,
    lastSuccessAt: result === "ok" ? now : (prev?.lastSuccessAt ?? null),
  };
}

export function nextSyncStatus(
  prev: CharacterSyncStatus | undefined,
  outcome: FetchOutcome,
  now: string,
): CharacterSyncStatus {
  const result: SyncResult = outcome.kind;
  const message =
    outcome.kind === "ok"
      ? `Profile read from AOTC.gg (${outcome.profile.strategy} strategy).`
      : outcome.message;
  const unchanged = prev && prev.result === result && prev.message === message;
  return {
    result,
    message,
    since: unchanged ? prev.since : now,
    lastSuccessAt: outcome.kind === "ok" ? now : (prev?.lastSuccessAt ?? null),
  };
}
