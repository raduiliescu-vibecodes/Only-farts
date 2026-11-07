import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyResponse,
  detectCheckpoint,
  fetchProfile,
  parseProfile,
  robotsAllows,
  USER_AGENT,
} from "@/lib/aotc";

const checkpointHtml = readFileSync(new URL("./fixtures/vercel-checkpoint.html", import.meta.url), "utf8");

describe("detectCheckpoint", () => {
  it("recognises the Vercel Security Checkpoint by header", () => {
    expect(detectCheckpoint(429, { "x-vercel-mitigated": "challenge" }, "")).toMatch(/Vercel Security Checkpoint/);
  });

  it("recognises the Vercel Security Checkpoint by body", () => {
    expect(detectCheckpoint(429, {}, checkpointHtml)).toMatch(/Vercel Security Checkpoint/);
  });

  it("does not flag an ordinary page", () => {
    expect(detectCheckpoint(200, {}, "<html><body>Level 60 Warrior</body></html>")).toBeNull();
  });
});

describe("classifyResponse", () => {
  it("reports the observed AOTC.gg response as blocked", () => {
    const o = classifyResponse(429, new Headers({ "x-vercel-mitigated": "challenge" }), checkpointHtml);
    expect(o.kind).toBe("blocked");
  });

  it("reports non-2xx responses as http errors", () => {
    expect(classifyResponse(500, {}, "oops").kind).toBe("http_error");
  });

  it("reports unreadable pages as parse failures", () => {
    expect(classifyResponse(200, {}, "<html><body>Hello</body></html>").kind).toBe("parse_failed");
  });
});

describe("parseProfile", () => {
  it("reads an embedded JSON character record", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          meta: { level: 3 },
          character: {
            name: "Taipan",
            level: 42,
            gearScore: 1234,
            itemLevel: 47.5,
            class: { name: "Hunter" },
            race: "Night Elf",
            guild: { name: "Only Farts" },
          },
        },
      },
    })}</script></html>`;
    expect(parseProfile(html)).toEqual({
      level: 42,
      gearScore: 1234,
      itemLevel: 47.5,
      className: "Hunter",
      race: "Night Elf",
      guild: "Only Farts",
      strategy: "json",
    });
  });

  it("reads a framework payload pushed as string chunks", () => {
    const chunk = JSON.stringify('3:{"character":{"level":58,"gear_score":"2,105","className":"Mage"}}');
    const html = `<script>self.__next_f.push([1,${chunk}])</script>`;
    const p = parseProfile(html);
    expect(p?.level).toBe(58);
    expect(p?.gearScore).toBe(2105);
    expect(p?.className).toBe("Mage");
    expect(p?.strategy).toBe("payload");
  });

  it("falls back to visible text and does not confuse item level with level", () => {
    const html = `<html><body><h1>Fishlock</h1><div>Item Level: 55</div><div>Level 37 Gnome Warlock</div>
      <div><span>Gear Score</span><span>1,480</span></div></body></html>`;
    const p = parseProfile(html);
    expect(p?.level).toBe(37);
    expect(p?.gearScore).toBe(1480);
    expect(p?.itemLevel).toBe(55);
    expect(p?.strategy).toBe("text");
  });

  it("rejects implausible values", () => {
    const html = `<script type="application/json">{"level": 999, "gearScore": -5}</script>`;
    expect(parseProfile(html)).toBeNull();
  });

  it("returns null for the checkpoint page", () => {
    expect(parseProfile(checkpointHtml)).toBeNull();
  });
});

describe("robotsAllows", () => {
  const robots = `
User-agent: *
Disallow: /forever/
Allow: /forever/character/

User-agent: BadBot
Disallow: /
`;
  it("applies the longest matching rule", () => {
    expect(robotsAllows(robots, USER_AGENT, "/forever/character/eu/sisu-jr")).toBe(true);
    expect(robotsAllows(robots, USER_AGENT, "/forever/guild/x")).toBe(false);
  });
  it("uses a specific group when one matches", () => {
    expect(robotsAllows(robots, "BadBot/1.0", "/forever/character/eu/sisu-jr")).toBe(false);
  });
  it("allows everything for an empty file", () => {
    expect(robotsAllows("", USER_AGENT, "/anything")).toBe(true);
  });
});

describe("fetchProfile", () => {
  const url = "https://www.aotc.gg/forever/character/eu/sisu-jr";

  it("does not request a path robots.txt disallows", async () => {
    let called = false;
    const fakeFetch = (async () => {
      called = true;
      return new Response("");
    }) as typeof fetch;
    const o = await fetchProfile(url, "User-agent: *\nDisallow: /", fakeFetch);
    expect(o.kind).toBe("blocked");
    expect(called).toBe(false);
  });

  it("identifies itself and classifies the checkpoint as blocked", async () => {
    let ua: string | null = null;
    const fakeFetch = (async (_: RequestInfo | URL, init?: RequestInit) => {
      ua = new Headers(init?.headers).get("user-agent");
      return new Response(checkpointHtml, { status: 429, headers: { "x-vercel-mitigated": "challenge" } });
    }) as typeof fetch;
    const o = await fetchProfile(url, null, fakeFetch);
    expect(o.kind).toBe("blocked");
    expect(ua).toBe(USER_AGENT);
  });

  it("reports network failures", async () => {
    const fakeFetch = (async () => {
      throw new Error("ENOTFOUND");
    }) as typeof fetch;
    const o = await fetchProfile(url, null, fakeFetch);
    expect(o.kind).toBe("network_error");
  });
});
