import { describe, expect, it } from "vitest";
import { computeGear, itemScore, type EquippedItem } from "@/lib/gearscore";

const item = (slot: string, inv: string, quality: string, level: number): EquippedItem => ({
  slot: { type: slot },
  inventory_type: { type: inv },
  quality: { type: quality },
  level: { value: level },
});

describe("itemScore (classic GearScore formula)", () => {
  it.each([
    // floor(((15 - 8) / 2) * 1 * 1.8618) = floor(6.516) = 6
    ["uncommon ilvl 15 chest", item("CHEST", "CHEST", "UNCOMMON", 15), 6],
    // common counts at 0.5%: floor(1 * 1.8618 * 0.005) = 0
    ["common ilvl 10 legs", item("LEGS", "LEGS", "COMMON", 10), 0],
    // floor(((20 - 0.75) / 1.8) * 2 * 1.8618) = floor(39.82) = 39
    ["rare ilvl 20 two-hander", item("MAIN_HAND", "TWOHWEAPON", "RARE", 20), 39],
    // floor(((60 - 26) / 1.2) * 1 * 1.8618) = floor(52.75) = 52
    ["epic ilvl 60 head", item("HEAD", "HEAD", "EPIC", 60), 52],
    // ilvl > 120 uses the high table: floor(((130 - 91.45) / 0.65) * 1.8618) = 110
    ["epic ilvl 130 head", item("HEAD", "HEAD", "EPIC", 130), 110],
    // negative scores clamp to 0
    ["uncommon ilvl 5 ring", item("FINGER_1", "FINGER", "UNCOMMON", 5), 0],
  ])("%s", (_label, it_, expected) => {
    expect(itemScore(it_)).toBe(expected);
  });

  it("returns null for items it cannot score", () => {
    expect(itemScore(item("BAG", "BAG", "UNCOMMON", 20))).toBeNull();
    expect(itemScore({ slot: { type: "HEAD" }, inventory_type: { type: "HEAD" }, quality: { type: "UNCOMMON" } })).toBeNull();
  });
});

describe("computeGear", () => {
  const gear = [
    item("CHEST", "CHEST", "UNCOMMON", 15), // 6
    item("MAIN_HAND", "TWOHWEAPON", "RARE", 20), // 39
    item("LEGS", "LEGS", "COMMON", 10), // 0
    item("SHIRT", "BODY", "COMMON", 1), // ignored
    item("TABARD", "TABARD", "COMMON", 1), // ignored
  ];

  it("sums item scores and averages item levels of scored items", () => {
    expect(computeGear(gear, "Priest")).toEqual({ gearScore: 45, averageItemLevel: 15, scoredItems: 3, unscoredItems: 0 });
  });

  it("applies the hunter weapon and ranged weights", () => {
    const hunter = [
      item("MAIN_HAND", "TWOHWEAPON", "RARE", 20), // 39 * 0.3164 = 12.34
      item("RANGED", "RANGED", "RARE", 20), // floor(10.694 * 0.3164 * 1.8618) = 6 → * 5.3224 = 31.93
    ];
    expect(computeGear(hunter, "Hunter").gearScore).toBe(44);
    expect(computeGear(hunter, "Priest").gearScore).toBe(45);
  });

  it("counts unscorable items separately", () => {
    expect(computeGear([...gear, item("BAG", "BAG", "UNCOMMON", 20)], "Rogue").unscoredItems).toBe(1);
  });
});
