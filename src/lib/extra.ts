/**
 * Optional character-sheet details recorded with a manual snapshot, entered as
 * a single "key=value; key=value" string (one workflow input), e.g.
 *
 *   health=357; mana=839; intellect=52; spirit=62; stamina=31; spell power=35;
 *   main hand dps=24.2; spell crit=5.3%; armor=226; honorable kills=0;
 *   talents=Discipline 2 / Holy 0 / Shadow 7
 *
 * Keys are matched case- and punctuation-insensitively against an allowlist so
 * a typo is rejected instead of silently stored.
 */

/** "int": whole number; "decimal": e.g. weapon DPS 24.2; "percent": 0–100, e.g. 5.3 for 5.3%. */
export type StatKind = "int" | "decimal" | "percent";
export type StatGroup = "base" | "combat";

export interface StatDef {
  key: string;
  label: string;
  kind: StatKind;
  group: StatGroup;
}

/** Allowlist and display order (the order AOTC.gg's character sheet uses). */
export const STAT_DEFS: StatDef[] = [
  { key: "health", label: "Health", kind: "int", group: "base" },
  { key: "mana", label: "Mana", kind: "int", group: "base" },
  { key: "energy", label: "Energy", kind: "int", group: "base" },
  { key: "strength", label: "Strength", kind: "int", group: "base" },
  { key: "agility", label: "Agility", kind: "int", group: "base" },
  { key: "intellect", label: "Intellect", kind: "int", group: "base" },
  { key: "stamina", label: "Stamina", kind: "int", group: "base" },
  { key: "spirit", label: "Spirit", kind: "int", group: "base" },
  { key: "attackPower", label: "Attack Power", kind: "int", group: "combat" },
  { key: "rangedAttackPower", label: "Ranged Attack Power", kind: "int", group: "combat" },
  { key: "mainHandDps", label: "Main Hand DPS", kind: "decimal", group: "combat" },
  { key: "offHandDps", label: "Off Hand DPS", kind: "decimal", group: "combat" },
  { key: "meleeCrit", label: "Melee Crit", kind: "percent", group: "combat" },
  { key: "rangedCrit", label: "Ranged Crit", kind: "percent", group: "combat" },
  { key: "spellPower", label: "Spell Power", kind: "int", group: "combat" },
  { key: "healingPower", label: "Healing Power", kind: "int", group: "combat" },
  { key: "spellCrit", label: "Spell Crit", kind: "percent", group: "combat" },
  { key: "hit", label: "Hit", kind: "percent", group: "combat" },
  { key: "manaRegen", label: "Mana Regen", kind: "int", group: "combat" },
  { key: "armor", label: "Armor", kind: "int", group: "combat" },
  { key: "defense", label: "Defense", kind: "int", group: "combat" },
  { key: "dodge", label: "Dodge", kind: "percent", group: "combat" },
  { key: "parry", label: "Parry", kind: "percent", group: "combat" },
  { key: "block", label: "Block", kind: "percent", group: "combat" },
];

export interface TalentTree {
  tree: string;
  points: number;
}

export interface ExtraDetails {
  stats?: Record<string, number>;
  honorableKills?: number;
  talents?: TalentTree[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const STAT_BY_NORM = new Map(STAT_DEFS.map((d) => [norm(d.key), d]));
const ALIASES: Record<string, string> = { hk: "honorablekills", hks: "honorablekills", ap: "attackpower", sp: "spellpower" };

function parseNumber(key: string, raw: string, kind: StatKind): number {
  const trimmed = raw.trim();
  if (kind !== "percent" && trimmed.endsWith("%")) {
    throw new Error(`"${key}" is not a percentage (got "${trimmed}").`);
  }
  const cleaned = trimmed.replace(/,/g, "").replace(/%$/, "").trim();
  const n = Number(cleaned);
  if (cleaned === "" || !Number.isFinite(n) || n < 0) {
    throw new Error(`"${key}" needs a non-negative number (got "${trimmed}").`);
  }
  if (kind === "percent" && n > 100) throw new Error(`"${key}" is a percentage and must be at most 100 (got ${n}).`);
  if (kind !== "percent" && n > 1_000_000) throw new Error(`"${key}" looks too large (got ${n}).`);
  if (kind === "int" && !Number.isInteger(n)) throw new Error(`"${key}" must be a whole number (got ${n}).`);
  return kind === "int" ? n : Math.round(n * 100) / 100;
}

function parseTalents(raw: string): TalentTree[] {
  const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 4) {
    throw new Error(`talents should look like "Discipline 2 / Holy 0 / Shadow 7" (got "${raw.trim()}").`);
  }
  return parts.map((p) => {
    const m = p.match(/^([A-Za-z][A-Za-z' -]{0,23}?)\s*[:=]?\s*(\d{1,2})$/);
    if (!m) throw new Error(`Could not read talent tree "${p}". Use "<Tree name> <points>".`);
    const points = Number(m[2]);
    if (points > 61) throw new Error(`Talent tree "${m[1]}" has too many points (${points}).`);
    return { tree: m[1].trim(), points };
  });
}

export function parseExtra(input: string | undefined | null): ExtraDetails {
  const out: ExtraDetails = {};
  if (!input || !input.trim()) return out;
  const seen = new Set<string>();

  for (const entry of input.split(/[;\n]/).map((e) => e.trim()).filter(Boolean)) {
    const m = entry.match(/^([^=:]+)[=:](.*)$/);
    if (!m) throw new Error(`Expected "key=value" but got "${entry}".`);
    const rawKey = m[1].trim();
    let k = norm(rawKey);
    k = ALIASES[k] ?? k;
    if (seen.has(k)) throw new Error(`"${rawKey}" is given more than once.`);
    seen.add(k);

    if (k === "talents" || k === "talent") {
      out.talents = parseTalents(m[2]);
    } else if (k === "honorablekills" || k === "honourablekills") {
      out.honorableKills = parseNumber(rawKey, m[2], "int");
    } else {
      const def = STAT_BY_NORM.get(k);
      if (!def) {
        const allowed = [...STAT_DEFS.map((d) => d.label), "Honorable Kills", "Talents"].join(", ");
        throw new Error(`Unknown stat "${rawKey}". Allowed: ${allowed}.`);
      }
      out.stats = { ...out.stats, [def.key]: parseNumber(rawKey, m[2], def.kind) };
    }
  }
  return out;
}
