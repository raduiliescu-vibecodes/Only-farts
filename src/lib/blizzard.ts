/**
 * Blizzard Battle.net API client for World of Warcraft: Forever characters.
 *
 * Forever uses undocumented-but-live Profile API namespaces (community-verified,
 * Nov 2026): `profile-forever-{region}`. Characters are realmless and addressed
 * as `{name}-{surname}` in lowercase, which is exactly our character slug:
 *
 *   GET https://{region}.api.blizzard.com/profile/wow/character/{slug}?namespace=profile-forever-{region}
 *   …/equipment  …/statistics  …/specializations  …/pvp-summary
 *
 * Characters appear from level 10, after they log out; data reflects the last
 * logout. Auth is an OAuth client-credentials token from oauth.battle.net.
 */
import { computeGear, type EquippedItem } from "./gearscore";
import type { TalentTree } from "./extra";
import type { Snapshot } from "./types";

export const TOKEN_URL = "https://oauth.battle.net/token";

export interface BlizzardConfig {
  region: string; // "eu"
  locale: string; // "en_GB"
}

export type FetchLike = typeof fetch;

export class BlizzardError extends Error {
  constructor(
    message: string,
    readonly kind: "auth_error" | "not_found" | "rate_limited" | "http_error" | "network_error",
    readonly status: number,
  ) {
    super(message);
  }
}

export async function getAccessToken(clientId: string, clientSecret: string, fetchImpl: FetchLike = fetch): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new BlizzardError(`Token request failed: ${(err as Error).message}`, "network_error", 0);
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (res.status === 401 || res.status === 403 || res.status === 400) {
    throw new BlizzardError(
      `Battle.net rejected the API client credentials (HTTP ${res.status}${body.error_description ? `: ${body.error_description}` : ""}).`,
      "auth_error",
      res.status,
    );
  }
  if (!res.ok || !body.access_token) {
    throw new BlizzardError(`Token request failed with HTTP ${res.status}.`, "http_error", res.status);
  }
  return body.access_token;
}

export function characterUrl(cfg: BlizzardConfig, slug: string, sub = ""): string {
  const path = `/profile/wow/character/${encodeURIComponent(slug.toLowerCase())}${sub ? `/${sub}` : ""}`;
  return `https://${cfg.region}.api.blizzard.com${path}?namespace=profile-forever-${cfg.region}&locale=${cfg.locale}`;
}

export async function getJson<T>(url: string, token: string, fetchImpl: FetchLike = fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new BlizzardError(`Request failed: ${(err as Error).message}`, "network_error", 0);
  }
  if (res.status === 404) throw new BlizzardError("Not found (HTTP 404).", "not_found", 404);
  if (res.status === 401 || res.status === 403) throw new BlizzardError(`Not authorised (HTTP ${res.status}).`, "auth_error", res.status);
  if (res.status === 429) throw new BlizzardError("Rate limited by Blizzard (HTTP 429).", "rate_limited", 429);
  if (!res.ok) throw new BlizzardError(`Blizzard API returned HTTP ${res.status}.`, "http_error", res.status);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Response shapes (only the fields we use; everything optional = never assume)
// ---------------------------------------------------------------------------

type Named = { name?: string; type?: string } | string | undefined;

export interface ProfileResponse {
  name?: string;
  surname?: string;
  level?: number;
  race?: Named;
  character_class?: Named;
  guild?: { name?: string };
  equipped_item_level?: number;
  average_item_level?: number;
  last_login_timestamp?: number;
}

export interface EquipmentResponse {
  equipped_items?: EquippedItem[];
}

type Rated = { value?: number; effective?: number } | number | undefined;

export interface StatisticsResponse {
  health?: number;
  power?: number;
  power_type?: Named;
  strength?: Rated;
  agility?: Rated;
  intellect?: Rated;
  stamina?: Rated;
  spirit?: Rated;
  attack_power?: number;
  main_hand_dps?: number;
  off_hand_dps?: number;
  melee_crit?: Rated;
  ranged_crit?: Rated;
  spell_power?: number;
  spell_crit?: Rated;
  mana_regen?: number;
  armor?: Rated;
  defense?: Rated;
  dodge?: Rated;
  parry?: Rated;
  block?: Rated;
}

export interface SpecializationsResponse {
  specialization_groups?: {
    is_active?: boolean;
    specializations?: { specialization_name?: string; spent_points?: number }[];
  }[];
}

export interface PvpSummaryResponse {
  honorable_kills?: number;
  pvp_honorable_kills?: number;
}

// ---------------------------------------------------------------------------
// Mapping (pure functions, unit-tested)
// ---------------------------------------------------------------------------

const nameOf = (v: Named): string | null => {
  if (typeof v === "string") return v || null;
  return v?.name ?? null;
};

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const effective = (v: Rated): number | undefined =>
  typeof v === "number" ? num(v) : num(v?.effective ?? v?.value);
const pct = (v: Rated): number | undefined => {
  const n = typeof v === "number" ? num(v) : num(v?.value);
  return n === undefined ? undefined : Math.round(n * 100) / 100;
};
const round2 = (v: unknown) => (num(v) === undefined ? undefined : Math.round((v as number) * 100) / 100);

/** Classic talent trees per class, in the game's order, to show 0-point trees too. */
export const CLASS_TREES: Record<string, string[]> = {
  warrior: ["Arms", "Fury", "Protection"],
  paladin: ["Holy", "Protection", "Retribution"],
  hunter: ["Beast Mastery", "Marksmanship", "Survival"],
  rogue: ["Assassination", "Combat", "Subtlety"],
  priest: ["Discipline", "Holy", "Shadow"],
  shaman: ["Elemental", "Enhancement", "Restoration"],
  mage: ["Arcane", "Fire", "Frost"],
  warlock: ["Affliction", "Demonology", "Destruction"],
  druid: ["Balance", "Feral Combat", "Restoration"],
};

export function mapStatistics(s: StatisticsResponse): Record<string, number> {
  const power = nameOf(s.power_type)?.toLowerCase() ?? (typeof s.power_type === "object" ? s.power_type?.type?.toLowerCase() : undefined);
  const out: Record<string, number | undefined> = {
    health: num(s.health),
    mana: power === "mana" ? num(s.power) : undefined,
    energy: power === "energy" ? num(s.power) : undefined,
    strength: effective(s.strength),
    agility: effective(s.agility),
    intellect: effective(s.intellect),
    stamina: effective(s.stamina),
    spirit: effective(s.spirit),
    attackPower: num(s.attack_power),
    mainHandDps: round2(s.main_hand_dps),
    offHandDps: num(s.off_hand_dps) ? round2(s.off_hand_dps) : undefined,
    meleeCrit: pct(s.melee_crit),
    rangedCrit: pct(s.ranged_crit),
    spellPower: num(s.spell_power),
    spellCrit: pct(s.spell_crit),
    manaRegen: power === "mana" ? num(s.mana_regen) : undefined,
    armor: effective(s.armor),
    defense: effective(s.defense),
    dodge: pct(s.dodge),
    parry: pct(s.parry),
    block: pct(s.block),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as Record<string, number>;
}

export function mapTalents(s: SpecializationsResponse, className: string | null): TalentTree[] | null {
  const groups = s.specialization_groups ?? [];
  const group = groups.find((g) => g.is_active) ?? groups[0];
  if (!group?.specializations) return null;
  const spent = new Map<string, number>();
  for (const sp of group.specializations) {
    if (sp.specialization_name && Number.isInteger(sp.spent_points)) spent.set(sp.specialization_name, sp.spent_points!);
  }
  const trees = CLASS_TREES[(className ?? "").toLowerCase()];
  if (trees && [...spent.keys()].every((k) => trees.includes(k))) {
    return trees.map((tree) => ({ tree, points: spent.get(tree) ?? 0 }));
  }
  return spent.size ? [...spent].map(([tree, points]) => ({ tree, points })) : null;
}

export interface CharacterFetch {
  profile: ProfileResponse;
  equipment: EquipmentResponse | null;
  statistics: StatisticsResponse | null;
  specializations: SpecializationsResponse | null;
  pvp: PvpSummaryResponse | null;
}

export interface MappedSnapshot {
  snapshot: Snapshot;
  /** Why fields were left out, for the run report. */
  warnings: string[];
}

/**
 * Build a snapshot from Blizzard data. Fields we can't establish are left out
 * (never guessed); the caller decides whether the snapshot is acceptable.
 */
export function toSnapshot(slug: string, data: CharacterFetch, capturedAt: string): MappedSnapshot {
  const warnings: string[] = [];
  const p = data.profile;
  const className = nameOf(p.character_class);
  const snap: Snapshot = {
    character: slug,
    capturedAt,
    source: "blizzard",
    level: Number.isInteger(p.level) ? p.level! : null,
    gearScore: null,
    itemLevel: null,
  };

  if (data.equipment?.equipped_items) {
    const gear = computeGear(data.equipment.equipped_items, className);
    if (gear.unscoredItems > 0) {
      warnings.push(`${gear.unscoredItems} equipped item(s) could not be scored; Gear Score left out.`);
    } else {
      snap.gearScore = gear.gearScore;
    }
  } else {
    warnings.push("Equipment unavailable; Gear Score left out.");
  }
  const ilvl = num(p.equipped_item_level) ?? num(p.average_item_level);
  if (ilvl !== undefined && ilvl > 0) snap.itemLevel = ilvl;
  else warnings.push("Item level not in profile; left out.");

  const race = nameOf(p.race);
  if (className) snap.className = className;
  if (race) snap.race = race;
  if (p.guild?.name) snap.guild = p.guild.name;
  if (data.statistics) {
    const stats = mapStatistics(data.statistics);
    if (Object.keys(stats).length) snap.stats = stats;
  } else warnings.push("Statistics unavailable.");
  if (data.specializations) {
    const talents = mapTalents(data.specializations, className);
    if (talents) snap.talents = talents;
  } else warnings.push("Talents unavailable.");
  const hk = num(data.pvp?.honorable_kills) ?? num(data.pvp?.pvp_honorable_kills);
  if (hk !== undefined) snap.honorableKills = hk;
  if (num(p.last_login_timestamp)) snap.lastLogin = new Date(p.last_login_timestamp!).toISOString().replace(/\.\d{3}Z$/, "Z");
  return { snapshot: snap, warnings };
}

/** Reasons to refuse a fetched snapshot instead of recording it. */
export function rejectReason(slug: string, data: CharacterFetch, snap: Snapshot, previousLevel: number | null, maxLevel: number): string | null {
  const p = data.profile;
  const fetchedSlug = p.name && p.surname ? `${p.name}-${p.surname}`.toLowerCase() : null;
  if (fetchedSlug && fetchedSlug !== slug.toLowerCase()) {
    return `Blizzard returned a different character (${fetchedSlug}) for ${slug}.`;
  }
  if (snap.level === null || snap.level < 1 || snap.level > maxLevel) return `Implausible level ${snap.level} for ${slug}.`;
  if (previousLevel !== null && snap.level < previousLevel) {
    return `Level went down (${previousLevel} → ${snap.level}); not recording possibly stale data.`;
  }
  return null;
}
