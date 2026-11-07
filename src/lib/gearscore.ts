/**
 * GearScore from equipped items, using the classic GearScore formula (the
 * GearScoreLite/TacoTip algorithm that "Gear Score" figures for Classic-era
 * characters, including AOTC.gg's, are based on).
 *
 *   itemScore = floor(((itemLevel - A) / B) * slotModifier * 1.8618 * qualityScale)
 *
 * A/B depend on quality and on whether the item level is above 120. Common and
 * poor items count at 0.5% (qualityScale 0.005). Hunters weight weapons x0.3164
 * and ranged x5.3224. The total is the sum of item scores; shirts and tabards
 * don't count.
 *
 * Input shapes follow the Blizzard Profile API `/equipment` response.
 */

export interface EquippedItem {
  slot: { type: string };
  quality: { type: string };
  inventory_type: { type: string };
  level?: { value: number };
  name?: string;
}

const SLOT_MOD: Record<string, number> = {
  HEAD: 1,
  NECK: 0.5625,
  SHOULDER: 0.75,
  CHEST: 1,
  ROBE: 1,
  WAIST: 0.75,
  LEGS: 1,
  FEET: 0.75,
  WRIST: 0.5625,
  HAND: 0.75,
  FINGER: 0.5625,
  TRINKET: 0.5625,
  CLOAK: 0.5625,
  WEAPON: 1,
  SHIELD: 1,
  TWOHWEAPON: 2,
  WEAPONMAINHAND: 1,
  WEAPONOFFHAND: 1,
  HOLDABLE: 1,
  RANGED: 0.3164,
  THROWN: 0.3164,
  RANGEDRIGHT: 0.3164,
  RELIC: 0.3164,
};

const RARITY: Record<string, number> = {
  POOR: 0,
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
  ARTIFACT: 6,
  HEIRLOOM: 7,
};

// [A, B] per rarity, for item level > 120 ("high") and <= 120 ("low").
const FORMULA_HIGH: Record<number, [number, number]> = { 4: [91.45, 0.65], 3: [81.375, 0.8125], 2: [73, 1] };
const FORMULA_LOW: Record<number, [number, number]> = { 4: [26, 1.2], 3: [0.75, 1.8], 2: [8, 2], 1: [0, 2.25] };
const SCALE = 1.8618;

const NOT_SCORED_SLOTS = new Set(["SHIRT", "TABARD"]);
const WEAPON_SLOTS = new Set(["MAIN_HAND", "OFF_HAND"]);
const RANGED_SLOTS = new Set(["RANGED"]);

export function itemScore(item: EquippedItem): number | null {
  const slotMod = SLOT_MOD[item.inventory_type?.type];
  let rarity = RARITY[item.quality?.type];
  let ilvl = item.level?.value;
  if (slotMod === undefined || rarity === undefined || typeof ilvl !== "number") return null;

  let qualityScale = 1;
  if (rarity === 5) {
    qualityScale = 1.3;
    rarity = 4;
  } else if (rarity === 0 || rarity === 1) {
    qualityScale = 0.005;
    rarity = 2;
  } else if (rarity === 7) {
    rarity = 3;
    ilvl = 187.05;
  }
  if (rarity < 2 || rarity > 4) return 0;
  const [a, b] = (ilvl > 120 ? FORMULA_HIGH : FORMULA_LOW)[rarity];
  const score = Math.floor(((ilvl - a) / b) * slotMod * SCALE * qualityScale);
  return Math.max(0, score);
}

export interface GearSummary {
  gearScore: number;
  /** Average item level of scored items, rounded down (GearScore's own average). */
  averageItemLevel: number | null;
  scoredItems: number;
  /** Items present but not scorable (unknown slot/quality/level). */
  unscoredItems: number;
}

export function computeGear(items: EquippedItem[], className: string | null): GearSummary {
  const hunter = (className ?? "").toLowerCase() === "hunter";
  let total = 0;
  let levelSum = 0;
  let scored = 0;
  let unscored = 0;
  for (const item of items) {
    if (NOT_SCORED_SLOTS.has(item.slot?.type)) continue;
    let s = itemScore(item);
    if (s === null) {
      unscored++;
      continue;
    }
    if (hunter && WEAPON_SLOTS.has(item.slot.type)) s *= 0.3164;
    if (hunter && RANGED_SLOTS.has(item.slot.type)) s *= 5.3224;
    total += s;
    levelSum += item.level!.value;
    scored++;
  }
  return {
    gearScore: Math.floor(total),
    averageItemLevel: scored ? Math.floor(levelSum / scored) : null,
    scoredItems: scored,
    unscoredItems: unscored,
  };
}
