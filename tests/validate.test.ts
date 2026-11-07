import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCharacters, validateHistory } from "@/lib/validate";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8")) as unknown;
const characters = validateCharacters(read("characters.json"));

describe("data files in the repository", () => {
  it("characters.json and history.json are valid", () => {
    expect(() => validateHistory(read("history.json"), characters)).not.toThrow();
  });
});

describe("validateHistory", () => {
  const ok = {
    character: "sisu-jr",
    capturedAt: "2026-11-07T15:51:00Z",
    source: "manual",
    level: 17,
    gearScore: 41,
  };

  it("accepts snapshots with different stat sets side by side", () => {
    const h = {
      snapshots: [
        { ...ok, character: "taipan-ismydaddy", capturedAt: "2026-11-07T15:27:00Z", stats: { mana: 839, spellCrit: 5.3 } },
        { ...ok, stats: { energy: 100, offHandDps: 7.1 }, talents: [{ tree: "Subtlety", points: 7 }] },
      ],
    };
    expect(validateHistory(h, characters).snapshots).toHaveLength(2);
  });

  it.each([
    [{ ...ok, character: "nobody" }, /unknown character/],
    [{ ...ok, capturedAt: "yesterday" }, /bad capturedAt/],
    [{ ...ok, source: "guess" }, /source must be/],
    [{ ...ok, level: 61 }, /bad level/],
    [{ ...ok, stats: { helth: 1 } }, /unknown stat/],
    [{ ...ok, stats: { health: "380" } }, /must be a number/],
    [{ ...ok, talents: [{ tree: "Combat" }] }, /talents must be/],
  ])("rejects %j", (snap, msg) => {
    expect(() => validateHistory({ snapshots: [snap] }, characters)).toThrow(msg);
  });

  it("rejects duplicate snapshots for the same character and time", () => {
    expect(() => validateHistory({ snapshots: [ok, { ...ok }] }, characters)).toThrow(/duplicate snapshot/);
  });
});
