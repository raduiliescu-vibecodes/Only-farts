import { STAT_DEFS } from "./extra";
import type { CharactersFile, HistoryFile, Snapshot } from "./types";

/**
 * Structural checks for the JSON data files, run at build time. A malformed
 * file fails the build with a readable message instead of rendering a broken
 * page (Vercel then keeps serving the previous deployment).
 */

const STAT_KEYS = new Set(STAT_DEFS.map((d) => d.key));

function fail(msg: string): never {
  throw new Error(`Invalid data: ${msg}`);
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const optNum = (v: unknown) => v === undefined || v === null || isNum(v);
const optStr = (v: unknown) => v === undefined || v === null || typeof v === "string";

export function validateCharacters(raw: unknown): CharactersFile {
  const f = raw as CharactersFile;
  if (!f || !Array.isArray(f.characters) || !isNum(f.maxLevel)) fail("characters.json needs maxLevel and characters[]");
  const slugs = new Set<string>();
  for (const c of f.characters) {
    if (!c || typeof c.slug !== "string" || !/^[a-z0-9-]+$/.test(c.slug)) fail(`bad character slug ${JSON.stringify(c?.slug)}`);
    if (slugs.has(c.slug)) fail(`duplicate character slug ${c.slug}`);
    slugs.add(c.slug);
    if (typeof c.displayName !== "string" || !c.displayName) fail(`${c.slug}: displayName is required`);
    if (![1, 2, 3, 4].includes(c.colorSlot)) fail(`${c.slug}: colorSlot must be 1-4`);
    if (typeof c.aotcUrl !== "string" || typeof c.region !== "string") fail(`${c.slug}: aotcUrl and region are required`);
  }
  return f;
}

function validateSnapshot(s: Snapshot, i: number, slugs: Set<string>, maxLevel: number): void {
  const at = `history.json snapshot #${i + 1}`;
  if (!s || !slugs.has(s.character)) fail(`${at}: unknown character ${JSON.stringify(s?.character)}`);
  if (typeof s.capturedAt !== "string" || Number.isNaN(Date.parse(s.capturedAt))) fail(`${at}: bad capturedAt`);
  if (s.source !== "aotc" && s.source !== "manual" && s.source !== "blizzard") {
    fail(`${at}: source must be "aotc", "manual" or "blizzard"`);
  }
  if (!(s.level === null || (Number.isInteger(s.level) && s.level >= 1 && s.level <= maxLevel))) fail(`${at}: bad level`);
  if (!(s.gearScore === null || isNum(s.gearScore))) fail(`${at}: bad gearScore`);
  if (!optNum(s.itemLevel) || !optNum(s.honorableKills)) fail(`${at}: bad itemLevel/honorableKills`);
  if (!optStr(s.className) || !optStr(s.race) || !optStr(s.guild) || !optStr(s.note) || !optStr(s.lastLogin)) {
    fail(`${at}: text fields must be strings`);
  }
  if (s.stats !== undefined && s.stats !== null) {
    for (const [k, v] of Object.entries(s.stats)) {
      if (!STAT_KEYS.has(k)) fail(`${at}: unknown stat "${k}"`);
      if (!isNum(v)) fail(`${at}: stat "${k}" must be a number`);
    }
  }
  if (s.talents !== undefined && s.talents !== null) {
    if (!Array.isArray(s.talents) || s.talents.some((t) => typeof t?.tree !== "string" || !Number.isInteger(t?.points))) {
      fail(`${at}: talents must be [{ tree, points }]`);
    }
  }
}

export function validateHistory(raw: unknown, characters: CharactersFile): HistoryFile {
  const h = raw as HistoryFile;
  if (!h || !Array.isArray(h.snapshots)) fail("history.json needs snapshots[]");
  const slugs = new Set(characters.characters.map((c) => c.slug));
  const seen = new Set<string>();
  h.snapshots.forEach((s, i) => {
    validateSnapshot(s, i, slugs, characters.maxLevel);
    const key = `${s.character}@${Date.parse(s.capturedAt)}`;
    if (seen.has(key)) fail(`duplicate snapshot for ${s.character} at ${s.capturedAt}`);
    seen.add(key);
  });
  return h;
}
