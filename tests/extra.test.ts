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

  it("reads Phender's full sheet (Paladin: decimals, defense, mana regen, 0 spell power)", () => {
    const r = parseExtra(
      "health=574; mana=539; strength=65; agility=30; intellect=31; stamina=59; spirit=42; attack power=167; main hand dps=24.2; melee crit=5.4%; ranged crit=3.4%; spell power=0; spell crit=5.9%; mana regen=52; armor=1314; defense=85; dodge=4.4%; parry=4.8%; block=4.8%; honorable kills=0; talents=Holy 0 / Protection 9 / Retribution 0",
    );
    expect(r.stats).toEqual({
      health: 574, mana: 539, strength: 65, agility: 30, intellect: 31, stamina: 59, spirit: 42,
      attackPower: 167, mainHandDps: 24.2, meleeCrit: 5.4, rangedCrit: 3.4, spellPower: 0, spellCrit: 5.9,
      manaRegen: 52, armor: 1314, defense: 85, dodge: 4.4, parry: 4.8, block: 4.8,
    });
    expect(r.honorableKills).toBe(0);
    expect(r.talents).toEqual([
      { tree: "Holy", points: 0 },
      { tree: "Protection", points: 9 },
      { tree: "Retribution", points: 0 },
    ]);
  });

  it("reads Fishlock's full sheet (Warlock: 0% parry and block are kept, not dropped)", () => {
    const r = parseExtra(
      "health=453; mana=868; strength=27; agility=26; intellect=56; stamina=46; spirit=47; attack power=20; main hand dps=9.4; melee crit=3.9%; ranged crit=5.8%; spell power=29; spell crit=6.3%; mana regen=58; armor=220; defense=80; dodge=4.7%; parry=0%; block=0%; honorable kills=0; talents=Affliction 8 / Demonology 0 / Destruction 0",
    );
    expect(r.stats?.parry).toBe(0);
    expect(r.stats?.block).toBe(0);
    expect(r.stats?.mainHandDps).toBe(9.4);
    expect(Object.keys(r.stats ?? {})).toHaveLength(19);
    expect(r.talents?.map((t) => t.points)).toEqual([8, 0, 0]);
  });

  it("reads Sisu's full sheet (Rogue: energy, off hand DPS, no mana)", () => {
    const r = parseExtra(
      "health=380; energy=100; strength=34; agility=57; intellect=23; stamina=37; spirit=34; attack power=105; main hand dps=14.0; off hand dps=7.1; melee crit=9.4%; ranged crit=9.0%; spell power=4; spell crit=1.0%; armor=403; defense=79; dodge=17.0%; parry=4.8%; block=0%; honorable kills=0; talents=Assassination 0 / Combat 0 / Subtlety 7",
    );
    expect(r.stats).toMatchObject({ energy: 100, mainHandDps: 14, offHandDps: 7.1, dodge: 17, block: 0 });
    expect(r.stats?.mana).toBeUndefined();
    expect(r.stats?.manaRegen).toBeUndefined();
    expect(r.talents).toEqual([
      { tree: "Assassination", points: 0 },
      { tree: "Combat", points: 0 },
      { tree: "Subtlety", points: 7 },
    ]);
  });

  it("enforces each stat's kind", () => {
    expect(() => parseExtra("defense=85.5")).toThrow(/whole number/);
    expect(() => parseExtra("main hand dps=24.2%")).toThrow(/not a percentage/);
    expect(() => parseExtra("armor=226%")).toThrow(/not a percentage/);
    expect(parseExtra("main hand dps=24.25").stats).toEqual({ mainHandDps: 24.25 });
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
