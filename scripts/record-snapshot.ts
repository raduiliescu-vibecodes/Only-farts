/**
 * Record manual snapshots (values read from a character's AOTC.gg page).
 *
 * One character:
 *   npm run snapshot -- --character taipan-ismydaddy --level 42 --gear-score 1234 \
 *     [--item-level 48] [--class Warrior] [--race Orc] [--guild "Only Farts"] \
 *     [--note "Hit 42 in Stranglethorn"] [--at 2026-11-07T18:00:00Z]
 *
 * All characters at once from environment variables (used by the GitHub workflow):
 *   npm run snapshot -- --from-env
 *   LEVEL_TAIPAN_ISMYDADDY=42 GEAR_SCORE_TAIPAN_ISMYDADDY=1234 ITEM_LEVEL_… NOTE=… AT=…
 */
import { parseArgs } from "node:util";
import { appendSnapshot } from "../src/lib/snapshots";
import type { CharacterConfig, Snapshot } from "../src/lib/types";
import { PATHS, nowIso, readCharacters, readHistory, writeJsonIfChanged } from "./files";

function envKey(slug: string): string {
  return slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function int(name: string, raw: string | undefined, min: number, max: number): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw.replace(/,/g, "").trim());
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be a whole number between ${min} and ${max} (got "${raw}").`);
  }
  return n;
}

function decimal(name: string, raw: string | undefined, min: number, max: number): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${name} must be a number between ${min} and ${max} (got "${raw}").`);
  }
  return Math.round(n * 10) / 10;
}

function text(raw: string | undefined): string | null {
  const s = raw?.trim();
  return s ? s.slice(0, 120) : null;
}

function timestamp(raw: string | undefined): string {
  if (!raw || !raw.trim()) return nowIso();
  const t = Date.parse(raw);
  if (Number.isNaN(t)) throw new Error(`--at must be an ISO date/time (got "${raw}").`);
  if (t > Date.now() + 5 * 60_000) throw new Error("--at cannot be in the future.");
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function build(
  c: CharacterConfig,
  maxLevel: number,
  values: {
    level?: string;
    gearScore?: string;
    itemLevel?: string;
    className?: string;
    race?: string;
    guild?: string;
    note?: string;
  },
  capturedAt: string,
): Snapshot | null {
  const level = int(`${c.displayName} level`, values.level, 1, maxLevel);
  const gearScore = int(`${c.displayName} Gear Score`, values.gearScore, 1, 50_000);
  const itemLevel = decimal(`${c.displayName} item level`, values.itemLevel, 1, 999);
  if (level === null && gearScore === null && itemLevel === null) return null;
  const snap: Snapshot = { character: c.slug, capturedAt, source: "manual", level, gearScore, itemLevel };
  const className = text(values.className);
  const race = text(values.race);
  const guild = text(values.guild);
  const note = text(values.note);
  if (className) snap.className = className;
  if (race) snap.race = race;
  if (guild) snap.guild = guild;
  if (note) snap.note = note;
  return snap;
}

async function main() {
  const { values } = parseArgs({
    options: {
      character: { type: "string", short: "c" },
      level: { type: "string", short: "l" },
      "gear-score": { type: "string", short: "g" },
      "item-level": { type: "string" },
      class: { type: "string" },
      race: { type: "string" },
      guild: { type: "string" },
      note: { type: "string" },
      at: { type: "string" },
      "from-env": { type: "boolean" },
    },
  });

  const { characters, maxLevel } = await readCharacters();
  let history = await readHistory();
  const snaps: Snapshot[] = [];

  if (values["from-env"]) {
    const capturedAt = timestamp(process.env.AT);
    for (const c of characters) {
      const k = envKey(c.slug);
      const snap = build(
        c,
        maxLevel,
        {
          level: process.env[`LEVEL_${k}`],
          gearScore: process.env[`GEAR_SCORE_${k}`],
          itemLevel: process.env[`ITEM_LEVEL_${k}`],
          note: process.env.NOTE,
        },
        capturedAt,
      );
      if (snap) snaps.push(snap);
    }
  } else {
    const c = characters.find((x) => x.slug === values.character);
    if (!c) {
      throw new Error(
        `--character must be one of: ${characters.map((x) => x.slug).join(", ")} (got "${values.character ?? ""}").`,
      );
    }
    const snap = build(
      c,
      maxLevel,
      {
        level: values.level,
        gearScore: values["gear-score"],
        itemLevel: values["item-level"],
        className: values.class,
        race: values.race,
        guild: values.guild,
        note: values.note,
      },
      timestamp(values.at),
    );
    if (snap) snaps.push(snap);
  }

  if (snaps.length === 0) throw new Error("Nothing to record: give at least a level, Gear Score or item level.");
  for (const s of snaps) history = appendSnapshot(history, s);
  await writeJsonIfChanged(PATHS.history, history);
  for (const s of snaps) {
    console.log(
      `Recorded ${s.character} @ ${s.capturedAt}: level ${s.level ?? "–"}, GS ${s.gearScore ?? "–"}, ilvl ${s.itemLevel ?? "–"}`,
    );
  }
}

main().catch((err) => {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
});
