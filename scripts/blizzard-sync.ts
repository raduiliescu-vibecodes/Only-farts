/**
 * Automatic snapshots from the Blizzard Battle.net API (WoW: Forever).
 *
 *   BLIZZARD_CLIENT_ID=… BLIZZARD_CLIENT_SECRET=… npm run sync:blizzard
 *   npm run sync:blizzard -- --dry     # fetch + compare with recorded data, write nothing
 *
 * Safety rules:
 * - writes snapshots only when data/sources.json has blizzard.enabled = true
 *   (the acceptance gate, opened after a verified dry run);
 * - never records a snapshot that fails identity/level checks;
 * - fields that can't be established are left out, so older valid values stay;
 * - statuses go to data/sync-status.json; real failures exit non-zero so the
 *   scheduled GitHub Action turns red and notifies the owner.
 */
import { appendFile, readFile } from "node:fs/promises";
import {
  BlizzardError,
  characterUrl,
  getAccessToken,
  getJson,
  rejectReason,
  toSnapshot,
  type BlizzardConfig,
  type CharacterFetch,
  type EquipmentResponse,
  type ProfileResponse,
  type PvpSummaryResponse,
  type SpecializationsResponse,
  type StatisticsResponse,
} from "../src/lib/blizzard";
import { appendSnapshot, latestSnapshot, shouldRecord, statusFor } from "../src/lib/snapshots";
import type { CharacterSyncStatus, Snapshot, SyncResult } from "../src/lib/types";
import { PATHS, nowIso, readCharacters, readHistory, readSyncStatus, writeJsonIfChanged } from "./files";

interface SourcesFile {
  blizzard: BlizzardConfig & { enabled: boolean };
}

const dry = process.argv.includes("--dry");
const FAILURES: SyncResult[] = ["auth_error", "http_error", "network_error", "rate_limited"];

const NOT_FOUND_HELP =
  "Blizzard has no public profile for this character (it appears from level 10, after logging out). " +
  "If it persists, check the character is above level 10 and has logged out since.";

async function optional<T>(url: string, token: string, warnings: string[], label: string): Promise<T | null> {
  try {
    return await getJson<T>(url, token);
  } catch (err) {
    warnings.push(`${label}: ${(err as Error).message}`);
    return null;
  }
}

function fmt(v: unknown): string {
  return v === null || v === undefined ? "–" : String(v);
}

async function main() {
  const sources = JSON.parse(await readFile(PATHS.sources, "utf8")) as SourcesFile;
  const cfg = sources.blizzard;
  const { characters, maxLevel } = await readCharacters();
  let history = await readHistory();
  const status = await readSyncStatus();
  status.source = "blizzard";
  const now = nowIso();
  const writes = cfg.enabled && !dry;
  const lines: string[] = [];
  const table: string[] = [
    "| Character | Result | Level (API / recorded) | Gear Score (computed / recorded) | Item level (API / recorded) | Notes |",
    "|---|---|---|---|---|---|",
  ];
  const set = (slug: string, result: SyncResult, message: string) => {
    status.characters[slug] = statusFor(status.characters[slug] as CharacterSyncStatus | undefined, result, message, now);
  };

  const clientId = process.env.BLIZZARD_CLIENT_ID?.trim();
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET?.trim();
  let exitCode = 0;

  if (!clientId || !clientSecret) {
    const msg = "Waiting for Blizzard API access: the BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET secrets are not set.";
    for (const c of characters) set(c.slug, "not_configured", msg);
    lines.push(msg);
    console.log(`::warning title=Blizzard sync not configured::${msg}`);
  } else {
    let token: string | null = null;
    try {
      token = await getAccessToken(clientId, clientSecret);
    } catch (err) {
      const e = err as BlizzardError;
      for (const c of characters) set(c.slug, e.kind ?? "http_error", e.message);
      lines.push(`Token: ${e.message}`);
      console.log(`::error title=Blizzard token failed::${e.message}`);
      exitCode = 1;
    }

    if (token) {
      let notFound = 0;
      for (const c of characters) {
        const recorded = latestSnapshot(history, c.slug);
        const warnings: string[] = [];
        let profile: ProfileResponse;
        try {
          profile = await getJson<ProfileResponse>(characterUrl(cfg, c.slug), token);
        } catch (err) {
          const e = err as BlizzardError;
          const msg = e.kind === "not_found" ? NOT_FOUND_HELP : e.message;
          set(c.slug, e.kind, msg);
          if (e.kind === "not_found") notFound++;
          if (FAILURES.includes(e.kind)) exitCode = 1;
          table.push(`| ${c.displayName} | ${e.kind} | – / ${fmt(recorded?.level)} | – / ${fmt(recorded?.gearScore)} | – / ${fmt(recorded?.itemLevel)} | ${msg} |`);
          continue;
        }
        const data: CharacterFetch = {
          profile,
          equipment: await optional<EquipmentResponse>(characterUrl(cfg, c.slug, "equipment"), token, warnings, "equipment"),
          statistics: await optional<StatisticsResponse>(characterUrl(cfg, c.slug, "statistics"), token, warnings, "statistics"),
          specializations: await optional<SpecializationsResponse>(
            characterUrl(cfg, c.slug, "specializations"), token, warnings, "specializations"),
          pvp: await optional<PvpSummaryResponse>(characterUrl(cfg, c.slug, "pvp-summary"), token, warnings, "pvp-summary"),
        };
        const mapped = toSnapshot(c.slug, data, now);
        warnings.push(...mapped.warnings);
        const snap: Snapshot = mapped.snapshot;
        const reason = rejectReason(c.slug, data, snap, recorded?.level ?? null, maxLevel);

        let note = warnings.join(" ");
        if (reason) {
          set(c.slug, "rejected", reason);
          note = `${reason} ${note}`;
        } else {
          set(c.slug, "ok", `Read from the Blizzard API (${Object.keys(snap.stats ?? {}).length} stats${snap.talents ? ", talents" : ""}).`);
          if (writes && shouldRecord(recorded, snap)) {
            history = appendSnapshot(history, snap);
            note = `recorded. ${note}`;
          } else if (writes) {
            note = `unchanged, not recorded. ${note}`;
          }
        }
        table.push(
          `| ${c.displayName} | ${reason ? "rejected" : "ok"} | ${fmt(snap.level)} / ${fmt(recorded?.level)} | ` +
            `${fmt(snap.gearScore)} / ${fmt(recorded?.gearScore)} | ${fmt(snap.itemLevel)} / ${fmt(recorded?.itemLevel)} | ${note.trim()} |`,
        );
        if (dry) console.log(`${c.slug}: ${JSON.stringify(snap)}`);
      }
      if (notFound === characters.length) {
        console.log("::error title=No characters found::Every character returned 404 from the Blizzard API.");
        exitCode = 1;
      }
    }
  }

  if (!dry) {
    const wroteHistory = await writeJsonIfChanged(PATHS.history, history);
    const wroteStatus = await writeJsonIfChanged(PATHS.syncStatus, status);
    lines.push(`history.json ${wroteHistory ? "updated" : "unchanged"}, sync-status.json ${wroteStatus ? "updated" : "unchanged"}.`);
  }
  if (!cfg.enabled) lines.push("Acceptance gate closed (data/sources.json blizzard.enabled = false): no snapshots written.");
  if (dry) lines.push("Dry run: nothing written.");

  const report = [table.length > 2 ? table.join("\n") : "", ...lines].filter(Boolean).join("\n\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Blizzard API sync${dry ? " (dry run)" : ""}\n\n${report}\n`);
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
