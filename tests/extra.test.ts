import { describe, expect, it } from "vitest";
import { parseExtra } from "@/lib/extra";

describe("parseExtra", () => {
  it("returns nothing for empty input", () => {
    expect(parseExtra("")).toEqual({});
    expect(parseExtra(undefined)).toEqual({});
  });

  it("reads a full character sheet with loose key spelling", () => {
    const r = parseExtra(
      "Health=357; mana: 839; Intellect=52; spirit=62; Stamina=31; Spell Power=35; spell_crit=5.3%; ARMOR=226; Honorable Kills=0; talents=Discipline 2 / Holy 0 / Shadow 7",
    );
    expect(r.stats).toEqual({
      health: 357,
      mana: 839,
      intellect: 52,
      spirit: 62,
      stamina: 31,
      spellPower: 35,
      spellCrit: 5.3,
      armor: 226,
    });
    expect(r.honorableKills).toBe(0);
    expect(r.talents).toEqual([
      { tree: "Discipline", points: 2 },
      { tree: "Holy", points: 0 },
      { tree: "Shadow", points: 7 },
    ]);
  });

  it("accepts newlines as separators and thousands separators in values", () => {
    expect(parseExtra("health=1,234\nhk=12").stats).toEqual({ health: 1234 });
    expect(parseExtra("health=1,234\nhk=12").honorableKills).toBe(12);
  });

  it("rejects unknown keys instead of storing them", () => {
    expect(() => parseExtra("helth=357")).toThrow(/Unknown stat "helth"/);
  });

  it("rejects bad values", () => {
    expect(() => parseExtra("health=lots")).toThrow(/non-negative number/);
    expect(() => parseExtra("spell crit=140%")).toThrow(/at most 100/);
    expect(() => parseExtra("armor=22.5")).toThrow(/whole number/);
    expect(() => parseExtra("health=-1")).toThrow(/non-negative/);
  });

  it("rejects duplicates and malformed entries", () => {
    expect(() => parseExtra("health=1; Health=2")).toThrow(/more than once/);
    expect(() => parseExtra("health 357")).toThrow(/key=value/);
    expect(() => parseExtra("talents=Discipline two")).toThrow(/talent tree/);
  });
});
