/**
 * AOTC.gg profile reader.
 *
 * Etiquette, by design:
 * - identifies itself with a descriptive User-Agent and a link to this repo;
 * - honours robots.txt;
 * - makes one request per profile, sequentially, a few times a day;
 * - treats bot-protection challenges as a hard "blocked" result and never
 *   attempts to solve, evade or retry around them.
 *
 * AOTC.gg publishes no API. The parser therefore tries several generic
 * strategies (embedded JSON, framework payloads, visible text). It has not been
 * verified against a real profile page, because every automated request so far
 * has been answered with a bot checkpoint.
 */

export const USER_AGENT =
  "OnlyFartsDashboard/1.0 (+https://github.com/raduiliescu-vibecodes/Only-farts; fan dashboard; 4 profiles, every 6h)";

export const MAX_PLAUSIBLE_LEVEL = 80;
const MAX_PLAUSIBLE_GS = 50_000;

export interface ParsedProfile {
  level: number | null;
  gearScore: number | null;
  itemLevel: number | null;
  className: string | null;
  race: string | null;
  guild: string | null;
  strategy: "json" | "payload" | "text";
}

export type FetchOutcome =
  | { kind: "ok"; status: number; profile: ParsedProfile }
  | { kind: "blocked"; status: number; message: string }
  | { kind: "http_error"; status: number; message: string }
  | { kind: "network_error"; message: string }
  | { kind: "parse_failed"; status: number; message: string };

// ---------------------------------------------------------------------------
// Bot-protection detection
// ---------------------------------------------------------------------------

type HeaderBag = Headers | Record<string, string | undefined>;

function header(h: HeaderBag, name: string): string | null {
  if (h instanceof Headers) return h.get(name);
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? (h[key] ?? null) : null;
}

export function detectCheckpoint(status: number, headers: HeaderBag, body: string): string | null {
  const mitigated = header(headers, "x-vercel-mitigated");
  if (mitigated) return `Vercel Security Checkpoint (x-vercel-mitigated: ${mitigated}, HTTP ${status})`;
  if (/Vercel Security Checkpoint/i.test(body)) return `Vercel Security Checkpoint (HTTP ${status})`;
  if (header(headers, "cf-mitigated") === "challenge" || /cf-chl-|challenge-platform|Just a moment\.\.\./i.test(body)) {
    return `Cloudflare challenge (HTTP ${status})`;
  }
  if ((status === 403 || status === 429) && /captcha|are you a (human|robot)|verify you are human/i.test(body)) {
    return `Bot challenge page (HTTP ${status})`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/** Minimal robots.txt evaluation: longest matching Allow/Disallow rule wins. */
export function robotsAllows(robotsTxt: string, userAgent: string, path: string): boolean {
  const ua = userAgent.toLowerCase();
  const groups: { agents: string[]; rules: { allow: boolean; prefix: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === "allow" || field === "disallow") && current) {
      if (value) current.rules.push({ allow: field === "allow", prefix: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const token = ua.split("/")[0];
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const applicable = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = applicable.flatMap((g) => g.rules);

  let best: { allow: boolean; prefix: string } | null = null;
  for (const r of rules) {
    const prefix = r.prefix.replace(/\*$/, "").replace(/\$$/, "");
    if (path.startsWith(prefix) && (!best || prefix.length > best.prefix.length)) {
      best = { allow: r.allow, prefix };
    }
  }
  return best ? best.allow : true;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const KEY = {
  level: /^(level|lvl|char_?level|character_?level)$/i,
  gearScore: /^(gear_?score|gs|gear_?score_?value)$/i,
  itemLevel: /^(item_?level|ilvl|avg_?ilvl|average_?item_?level|equipped_?item_?level)$/i,
  className: /^(class|class_?name|character_?class|playable_?class)$/i,
  race: /^(race|race_?name|playable_?race)$/i,
  guild: /^(guild|guild_?name)$/i,
};

function asLevel(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_PLAUSIBLE_LEVEL ? n : null;
}

function asGearScore(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_PLAUSIBLE_GS ? Math.round(n) : null;
}

function asItemLevel(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 10) / 10 : null;
}

function asName(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    return s && s.length <= 40 ? s : null;
  }
  if (v && typeof v === "object" && "name" in v) return asName((v as { name: unknown }).name);
  return null;
}

type Fields = Omit<ParsedProfile, "strategy">;

const EMPTY: Fields = { level: null, gearScore: null, itemLevel: null, className: null, race: null, guild: null };

/** Read profile fields from one object's own keys. */
function fieldsOf(obj: Record<string, unknown>): Fields {
  const out: Fields = { ...EMPTY };
  for (const [k, v] of Object.entries(obj)) {
    if (out.level === null && KEY.level.test(k)) out.level = asLevel(v);
    else if (out.gearScore === null && KEY.gearScore.test(k)) out.gearScore = asGearScore(v);
    else if (out.itemLevel === null && KEY.itemLevel.test(k)) out.itemLevel = asItemLevel(v);
    else if (out.className === null && KEY.className.test(k)) out.className = asName(v);
    else if (out.race === null && KEY.race.test(k)) out.race = asName(v);
    else if (out.guild === null && KEY.guild.test(k)) out.guild = asName(v);
  }
  return out;
}

/**
 * Walk a JSON value. Prefer the first object that has both a level and a gear
 * score (the character record); otherwise fall back to the first of each.
 */
export function extractFromJson(root: unknown): Fields | null {
  let best: Fields | null = null;
  const fallback: Fields = { ...EMPTY };
  const stack: unknown[] = [root];
  let visited = 0;

  while (stack.length && visited < 200_000) {
    const node = stack.pop();
    visited++;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
    } else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const f = fieldsOf(obj);
      if (!best && f.level !== null && f.gearScore !== null) best = f;
      for (const key of Object.keys(EMPTY) as (keyof Fields)[]) {
        if (fallback[key] === null && f[key] !== null) (fallback as Record<string, unknown>)[key] = f[key];
      }
      for (const v of Object.values(obj)) if (v && typeof v === "object") stack.push(v);
    }
  }

  const result = best ? { ...fallback, ...stripNulls(best) } : fallback;
  return result.level !== null || result.gearScore !== null ? result : null;
}

function stripNulls<T extends object>(o: T): Fields {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as Fields;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function jsonScripts(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* not JSON */
    }
  }
  return out;
}

/** Framework payloads embedded as JS string literals (e.g. Next.js RSC chunks). */
function payloadText(html: string): string {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\(\[\d+,\s*("(?:[^"\\]|\\.)*")\]\)/g;
  for (const m of html.matchAll(re)) {
    try {
      chunks.push(JSON.parse(m[1]) as string);
    } catch {
      /* skip */
    }
  }
  return chunks.join("");
}

function fromKeyValueText(text: string): Fields | null {
  const num = (re: RegExp) => text.match(re)?.[1] ?? null;
  const str = (re: RegExp) => text.match(re)?.[1] ?? null;
  const out: Fields = {
    level: asLevel(Number(num(/"(?:level|characterLevel|lvl)"\s*:\s*"?(\d{1,2})"?/i))),
    gearScore: asGearScore(num(/"(?:gearScore|gear_score|gs)"\s*:\s*"?(\d[\d,.]*)"?/i)),
    itemLevel: asItemLevel(num(/"(?:itemLevel|item_level|ilvl|averageItemLevel)"\s*:\s*"?([\d.]+)"?/i)),
    className: asName(str(/"(?:className|class_name|class)"\s*:\s*"([^"]{2,30})"/i)),
    race: asName(str(/"(?:race|raceName)"\s*:\s*"([^"]{2,30})"/i)),
    guild: asName(str(/"(?:guildName|guild)"\s*:\s*"([^"]{1,40})"/i)),
  };
  return out.level !== null || out.gearScore !== null ? out : null;
}

function visibleText(html: string): string {
  const meta = Array.from(
    html.matchAll(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]*>/gi),
  )
    .map((m) => m[0].match(/content=["']([^"']*)["']/i)?.[1] ?? "")
    .join(" \n ");
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " \n ");
  return decodeEntities(`${meta} \n ${body}`).replace(/[ \t]+/g, " ");
}

function fromVisibleText(text: string): Fields | null {
  const out: Fields = {
    ...EMPTY,
    level: asLevel(Number(text.match(/(?<!item\s{0,3})\b(?:Level|Lvl\.?)\s*[:\-]?\s*(\d{1,2})\b/i)?.[1])),
    gearScore: asGearScore(text.match(/\b(?:Gear\s*Score|GS)\s*[:\-]?\s*\n?\s*([\d][\d,.]*)/i)?.[1] ?? null),
    itemLevel: asItemLevel(text.match(/\b(?:Item\s*Level|iLvl)\s*[:\-]?\s*\n?\s*(\d{1,3}(?:\.\d+)?)/i)?.[1] ?? null),
  };
  return out.level !== null || out.gearScore !== null ? out : null;
}

export function parseProfile(html: string): ParsedProfile | null {
  for (const blob of jsonScripts(html)) {
    const r = extractFromJson(blob);
    if (r) return { ...r, strategy: "json" };
  }
  const payload = payloadText(html);
  if (payload) {
    const r = fromKeyValueText(payload);
    if (r) return { ...r, strategy: "payload" };
  }
  const inline = fromKeyValueText(html.replace(/\\"/g, '"'));
  if (inline) return { ...inline, strategy: "payload" };
  const text = fromVisibleText(visibleText(html));
  if (text) return { ...text, strategy: "text" };
  return null;
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export function classifyResponse(status: number, headers: HeaderBag, body: string): FetchOutcome {
  const checkpoint = detectCheckpoint(status, headers, body);
  if (checkpoint) return { kind: "blocked", status, message: `AOTC.gg answered with a ${checkpoint}. Automated requests are not served.` };
  if (status < 200 || status >= 300) return { kind: "http_error", status, message: `AOTC.gg returned HTTP ${status}.` };
  const profile = parseProfile(body);
  if (!profile) {
    return {
      kind: "parse_failed",
      status,
      message: "Profile page loaded but no level or Gear Score could be found. The page layout may have changed.",
    };
  }
  return { kind: "ok", status, profile };
}

export async function fetchText(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; headers: Headers; body: string }> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json;q=0.9,*/*;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.text();
  return { status: res.status, headers: res.headers, body: body.slice(0, 5_000_000) };
}

/** Fetch robots.txt once per run. Returns null when it cannot be read. */
export async function fetchRobots(origin: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await fetchText(new URL("/robots.txt", origin).toString(), fetchImpl);
    if (r.status === 200 && !detectCheckpoint(r.status, r.headers, r.body)) return r.body;
    if (r.status === 404) return "";
    return null;
  } catch {
    return null;
  }
}

export async function fetchProfile(
  url: string,
  robotsTxt: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchOutcome> {
  const path = new URL(url).pathname;
  if (robotsTxt && !robotsAllows(robotsTxt, USER_AGENT, path)) {
    return { kind: "blocked", status: 0, message: "AOTC.gg's robots.txt disallows this profile path, so it is not fetched." };
  }
  try {
    const r = await fetchText(url, fetchImpl);
    return classifyResponse(r.status, r.headers, r.body);
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    const cause = e.cause?.code ?? e.cause?.message;
    return { kind: "network_error", message: `Request failed: ${e.message}${cause ? ` (${cause})` : ""}` };
  }
}
