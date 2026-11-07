import { describe, expect, it } from "vitest";
import {
  BlizzardError,
  characterUrl,
  getAccessToken,
  getJson,
  mapStatistics,
  mapTalents,
  rejectReason,
  toSnapshot,
  type CharacterFetch,
} from "@/lib/blizzard";

const cfg = { region: "eu", locale: "en_GB" };

// Shapes follow the Blizzard Profile API (Classic/Forever) with locale set.
const profile = {
  name: "Taipan",
  surname: "Ismydaddy",
  level: 19,
  race: { name: "Human" },
  character_class: { name: "Priest" },
  equipped_item_level: 9,
  last_login_timestamp: Date.parse("2026-11-07T18:00:00Z"),
};
const equipment = {
  equipped_items: [
    { slot: { type: "CHEST" }, inventory_type: { type: "ROBE" }, quality: { type: "UNCOMMON" }, level: { value: 15 } },
    { slot: { type: "MAIN_HAND" }, inventory_type: { type: "TWOHWEAPON" }, quality: { type: "RARE" }, level: { value: 20 } },
    { slot: { type: "SHIRT" }, inventory_type: { type: "BODY" }, quality: { type: "COMMON" }, level: { value: 1 } },
  ],
};
const statistics = {
  health: 380,
  power: 839,
  power_type: { name: "Mana", type: "MANA" },
  strength: { base: 20, effective: 22 },
  intellect: { base: 50, effective: 52 },
  spirit: { base: 60, effective: 62 },
  stamina: { base: 30, effective: 31 },
  spell_power: 35,
  spell_crit: { value: 5.2999 },
  main_hand_dps: 9.4123,
  off_hand_dps: 0,
  mana_regen: 40,
  armor: { base: 200, effective: 226 },
  dodge: { value: 4.7 },
};
const specializations = {
  specialization_groups: [
    { is_active: true, specializations: [{ specialization_name: "Shadow", spent_points: 8 }, { specialization_name: "Discipline", spent_points: 2 }] },
  ],
};

const full: CharacterFetch = { profile, equipment, statistics, specializations, pvp: { honorable_kills: 3 } };

describe("characterUrl", () => {
  it("uses the realmless Forever profile route", () => {
    expect(characterUrl(cfg, "Taipan-Ismydaddy", "equipment")).toBe(
      "https://eu.api.blizzard.com/profile/wow/character/taipan-ismydaddy/equipment?namespace=profile-forever-eu&locale=en_GB",
    );
  });
});

describe("mapping", () => {
  it("maps statistics to our stat keys, keeping only what the API gives", () => {
    expect(mapStatistics(statistics)).toEqual({
      health: 380,
      mana: 839,
      strength: 22,
      intellect: 52,
      spirit: 62,
      stamina: 31,
      spellPower: 35,
      spellCrit: 5.3,
      mainHandDps: 9.41,
      manaRegen: 40,
      armor: 226,
      dodge: 4.7,
    });
  });

  it("maps energy users without inventing mana or mana regen", () => {
    const s = mapStatistics({ health: 380, power: 100, power_type: { name: "Energy" }, mana_regen: 0, off_hand_dps: 7.1 });
    expect(s).toEqual({ health: 380, energy: 100, offHandDps: 7.1 });
  });

  it("lists all three class trees in game order, with 0 for unspent trees", () => {
    expect(mapTalents(specializations, "Priest")).toEqual([
      { tree: "Discipline", points: 2 },
      { tree: "Holy", points: 0 },
      { tree: "Shadow", points: 8 },
    ]);
  });

  it("builds a full snapshot", () => {
    const { snapshot, warnings } = toSnapshot("taipan-ismydaddy", full, "2026-11-07T21:41:00Z");
    expect(warnings).toEqual([]);
    expect(snapshot).toMatchObject({
      character: "taipan-ismydaddy",
      source: "blizzard",
      level: 19,
      gearScore: 45,
      itemLevel: 9,
      className: "Priest",
      race: "Human",
      honorableKills: 3,
      lastLogin: "2026-11-07T18:00:00Z",
    });
    expect(snapshot.stats?.mana).toBe(839);
    expect(snapshot.talents).toHaveLength(3);
  });

  it("leaves fields out instead of guessing when sub-resources are missing", () => {
    const { snapshot, warnings } = toSnapshot(
      "taipan-ismydaddy",
      { profile: { ...profile, equipped_item_level: undefined }, equipment: null, statistics: null, specializations: null, pvp: null },
      "2026-11-07T21:41:00Z",
    );
    expect(snapshot.gearScore).toBeNull();
    expect(snapshot.itemLevel).toBeNull();
    expect(snapshot.stats).toBeUndefined();
    expect(snapshot.talents).toBeUndefined();
    expect(snapshot.honorableKills).toBeUndefined();
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("drops Gear Score when any equipped item can't be scored", () => {
    const odd = { equipped_items: [...equipment.equipped_items, { slot: { type: "X" }, inventory_type: { type: "MYSTERY" }, quality: { type: "RARE" }, level: { value: 20 } }] };
    const { snapshot, warnings } = toSnapshot("taipan-ismydaddy", { ...full, equipment: odd }, "2026-11-07T21:41:00Z");
    expect(snapshot.gearScore).toBeNull();
    expect(warnings.join(" ")).toMatch(/could not be scored/);
  });
});

describe("rejectReason (never record unverified data)", () => {
  const snap = toSnapshot("taipan-ismydaddy", full, "2026-11-07T21:41:00Z").snapshot;

  it("accepts a consistent snapshot", () => {
    expect(rejectReason("taipan-ismydaddy", full, snap, 18, 60)).toBeNull();
  });
  it("rejects a different character", () => {
    expect(rejectReason("phender-kx", full, snap, null, 60)).toMatch(/different character/);
  });
  it("rejects a level that went down (stale data)", () => {
    expect(rejectReason("taipan-ismydaddy", full, snap, 20, 60)).toMatch(/Level went down/);
  });
  it("rejects implausible levels", () => {
    expect(rejectReason("taipan-ismydaddy", full, { ...snap, level: 0 }, null, 60)).toMatch(/Implausible/);
  });
});

describe("HTTP handling", () => {
  it("turns a rejected client into an auth_error", async () => {
    const f = (async () => new Response(JSON.stringify({ error: "unauthorized", error_description: "Bad credentials" }), { status: 401 })) as typeof fetch;
    await expect(getAccessToken("id", "secret", f)).rejects.toMatchObject({ kind: "auth_error", status: 401 });
  });

  it("sends Basic auth to the token endpoint and returns the token", async () => {
    let auth: string | null = null;
    const f = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      auth = new Headers(init?.headers).get("authorization");
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 86399 }), { status: 200 });
    }) as typeof fetch;
    await expect(getAccessToken("id", "secret", f)).resolves.toBe("tok");
    expect(auth).toBe(`Basic ${Buffer.from("id:secret").toString("base64")}`);
  });

  it.each([
    [404, "not_found"],
    [403, "auth_error"],
    [429, "rate_limited"],
    [500, "http_error"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const f = (async () => new Response("{}", { status })) as typeof fetch;
    const err: unknown = await getJson("https://eu.api.blizzard.com/x", "tok", f).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BlizzardError);
    expect((err as BlizzardError).kind).toBe(kind);
  });
});
