/**
 * Sync character snapshots from AOTC.gg.
 *
 *   npm run sync            # all characters
 *   npm run sync -- --dry   # fetch and report, write nothing
 *
 * Exits 0 when AOTC.gg blocks or fails; that is a reported state, not a crash.
 */
import { appendFile } from "node:fs/promises";
import { fetchProfile, fetchRobots, type FetchOutcome } from "../src/lib/aotc";
import {
  appendSnapshot,
  latestSnapshot,
  nextSyncStatus,
  shouldRecord,
  snapshotFromProfile,
} from "../src/lib/snapshots";
import {
  PATHS,
  nowIso,
  readCharacters,
  readHistory,
  readSyncStatus,
  writeJsonIfChanged,
} from "./files";

const DELAY_MS = 3_000;
const dry = process.argv.includes("--dry");

function describe(o: FetchOutcome): string {
  if (o.kind === "ok") {
    const p = o.profile;
    return `ok: level ${p.level ?? "?"}, GS ${p.gearScore ?? "?"}, ilvl ${p.itemLevel ?? "?"} (${p.strategy})`;
  }
  return `${o.kind}: ${o.message}`;
}

async function main() {
  const { characters } = await readCharacters();
  let history = await readHistory();
  const status = await readSyncStatus();
  const lines: string[] = [];

  const origin = new URL(characters[0].aotcUrl).origin;
  const robots = await fetchRobots(origin);
  lines.push(`robots.txt: ${robots === null ? "unavailable" : robots === "" ? "none" : "read"}`);

  let recorded = 0;
  for (const [i, c] of characters.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    const now = nowIso();
    const outcome = await fetchProfile(c.aotcUrl, robots);
    status.characters[c.slug] = nextSyncStatus(status.characters[c.slug], outcome, now);

    let note = "";
    if (outcome.kind === "ok") {
      const snap = snapshotFromProfile(c.slug, outcome.profile, now);
      if (shouldRecord(latestSnapshot(history, c.slug), snap)) {
        history = appendSnapshot(history, snap);
        recorded++;
        note = " → snapshot recorded";
      } else {
        note = " → unchanged, no snapshot";
      }
    }
    lines.push(`${c.slug}: ${describe(outcome)}${note}`);
  }

  if (!dry) {
    const wroteHistory = await writeJsonIfChanged(PATHS.history, history);
    const wroteStatus = await writeJsonIfChanged(PATHS.syncStatus, status);
    lines.push(`history.json ${wroteHistory ? "updated" : "unchanged"}, sync-status.json ${wroteStatus ? "updated" : "unchanged"}`);
  } else {
    lines.push("dry run: nothing written");
  }
  lines.push(`${recorded} new snapshot(s)`);

  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## AOTC.gg sync\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
