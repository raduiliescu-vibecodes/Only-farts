# Only Farts

A public dashboard for four **World of Warcraft: Forever** characters: rankings, Gear Score, level
progression and history charts.

**Live:** https://only-farts-nine.vercel.app

| Character | AOTC.gg profile |
|---|---|
| Taipan | [taipan-ismydaddy](https://www.aotc.gg/forever/character/eu/taipan-ismydaddy) |
| Phender | [phender-kx](https://www.aotc.gg/forever/character/eu/phender-kx) |
| Fishlock | [fishlock-thefirst](https://www.aotc.gg/forever/character/eu/fishlock-thefirst) |
| Sisu | [sisu-jr](https://www.aotc.gg/forever/character/eu/sisu-jr) |

## How it works

- **Next.js 16 (App Router), fully static.** Every page is prerendered at build time from the JSON
  files in [`data/`](data). There is no database and no server runtime.
- **Git is the database.** Each snapshot is a row in [`data/history.json`](data/history.json).
  Every commit that changes `data/` triggers a fresh Vercel deploy, so the history charts are
  simply the git-tracked history.
- **Rankings** order characters by Gear Score or level. Ties share a rank, and unknown values rank last.
- **Charts** are step lines: a value holds until the next snapshot. Each chart has a legend,
  keyboard- and pointer-driven tooltips, and a data-table view.

## Data sources and AOTC.gg sync

AOTC.gg has no public API. [`scripts/sync-aotc.ts`](scripts/sync-aotc.ts) runs every 6 hours from
[`.github/workflows/sync-aotc.yml`](.github/workflows/sync-aotc.yml) and:

1. identifies itself with a descriptive User-Agent and reads `robots.txt`;
2. requests each profile once, sequentially, with a pause between requests;
3. parses level, Gear Score, item level, class, race and guild from embedded JSON, framework
   payloads or visible text;
4. appends a snapshot when something changed (or once per UTC day), and records the outcome in
   [`data/sync-status.json`](data/sync-status.json).

**Current status: blocked.** Since 7 Nov 2026 every automated request to AOTC.gg (including
`robots.txt`) has been answered with HTTP 429 and a *Vercel Security Checkpoint* (bot protection).
The sync treats that as a hard stop. It records `blocked` and never tries to solve or get around
the challenge. As a result, the parser has not yet been verified against a real AOTC.gg profile
page. If AOTC.gg adds an API or allows this dashboard's User-Agent, the sync starts recording
snapshots with no code changes, as long as the page exposes the data in one of the parsed shapes.

### Manual snapshots

Until then, record values by hand from each character's AOTC.gg page:

- **From GitHub (works on mobile):** Actions → *Record snapshot* → *Run workflow*, one character
  per run. Pick the character and fill in what the AOTC.gg page shows; leave unknown fields blank.
  - **Captured at:** when you read the values, with a time zone, e.g. `2026-11-07T17:27+02:00`
    (Romania in winter is `+02:00`, in summer `+03:00`). Blank means "now".
  - **Extra stats:** optional character-sheet details as `key=value` pairs separated by `;`, e.g.
    `health=357; mana=839; intellect=52; spirit=62; stamina=31; spell power=35; spell crit=5.3%; armor=226; honorable kills=0; talents=Discipline 2 / Holy 0 / Shadow 7`.
    Unknown keys are rejected, so typos never reach the site. Supported: health, mana, energy,
    strength, agility, intellect, stamina, spirit, attack power, ranged attack power, main/off
    hand DPS, melee/ranged/spell crit, spell power, healing power, hit, mana regen, armor,
    defense, dodge, parry, block, honorable kills and talents.
  - **Re-running is safe:** recording the identical snapshot again changes nothing, and a
    *different* snapshot for the same character and time is refused instead of overwriting
    history. The workflow also checks the data with the test suite before committing.
- **From a terminal:**

  ```bash
  npm run snapshot -- --character taipan-ismydaddy --level 18 --gear-score 78 \
    --item-level 8 --class Priest --race Human --at 2026-11-07T17:27+02:00 \
    --extra "health=357; mana=839; talents=Discipline 2 / Holy 0 / Shadow 7" \
    --note "From AOTC.gg screenshots"
  ```

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (vitest)
npm run lint && npm run typecheck
npm run build
npm run sync -- --dry   # try the AOTC.gg sync without writing anything
```

Requires Node 22+.

## Deploying to Vercel

The Vercel project `only-farts` serves https://only-farts-nine.vercel.app and is connected to
this repository through the Vercel GitHub App:

- Every push to the **production branch** (the repository's default branch,
  `claude/kind-albattani-t3k7tg`) deploys to production. That includes the commits made by the
  *Sync AOTC.gg* and *Record snapshot* workflows, so new data goes live without manual steps.
- Pushes to any other branch get a preview deployment.
- The scheduled sync runs on the default branch, so if you rename it (for example to `main`),
  update the production branch in **Vercel → only-farts → Settings → Git** too.

No environment variables are needed.

---

Only Farts is a fan project and is not affiliated with AOTC.gg or Blizzard Entertainment.
World of Warcraft is a trademark of Blizzard Entertainment, Inc.
