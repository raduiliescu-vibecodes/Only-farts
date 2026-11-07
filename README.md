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

## Data sources

### Automatic: Blizzard Battle.net API

[`scripts/blizzard-sync.ts`](scripts/blizzard-sync.ts) runs every 6 hours from
[`.github/workflows/sync-blizzard.yml`](.github/workflows/sync-blizzard.yml). WoW: Forever
characters are in the official Profile API under the (live, not yet documented) namespace
`profile-forever-eu`. Characters are realmless and addressed by `{name}-{surname}`, which is our
slug. Per character the job reads the profile, `/equipment`, `/statistics`, `/specializations` and
`/pvp-summary` (5 requests per character, 20 per run; Blizzard allows 36,000 an hour). A character
appears in the API from level 10, after it logs out.

- **Gear Score** is computed from the equipped items with the classic GearScore formula
  ([`src/lib/gearscore.ts`](src/lib/gearscore.ts)), the algorithm Classic-era Gear Score figures
  are based on. Item level is Blizzard's `equipped_item_level`.
- **Safety:** a snapshot is refused if Blizzard returns a different character or the level goes
  down. Fields the API doesn't provide are left out, so older valid values are never overwritten
  with missing ones. Gear Score is left out if any equipped item can't be scored. A snapshot is
  added only when something changed (or once a day).
- **Monitoring:** per-character status in [`data/sync-status.json`](data/sync-status.json), shown
  in the site banner and on each character page. Every run writes a comparison table to the job
  summary. Token, HTTP or network failures fail the job, and GitHub notifies the repository owner.
- **Acceptance gate:** snapshots are written only when [`data/sources.json`](data/sources.json)
  has `blizzard.enabled: true`. It is switched on after a dry run has been checked against the
  values recorded from AOTC.gg.

**Setup (one time):**

1. Create a free API client at https://develop.battle.net/access/clients (any name; Redirect URL
   and Service URL `https://only-farts-nine.vercel.app`).
2. Add two repository secrets under GitHub → Settings → Secrets and variables → Actions:
   `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET`.
3. Run *Sync Blizzard API* with **Dry run** checked and compare the job summary with the dashboard.
   If it matches, set `blizzard.enabled` to `true` in `data/sources.json`.

Locally: `BLIZZARD_CLIENT_ID=… BLIZZARD_CLIENT_SECRET=… npm run sync:blizzard -- --dry`.

### AOTC.gg (not polled)

AOTC.gg has no public API, and every automated request (including `robots.txt`) is answered with
HTTP 429 and a *Vercel Security Checkpoint*. The reader in [`src/lib/aotc.ts`](src/lib/aotc.ts)
treats that as a hard stop and never tries to get around it. The *Sync AOTC.gg* workflow is now
manual-only, and its statuses go to [`data/aotc-status.json`](data/aotc-status.json). A ready-to-send
access request is in [`docs/aotc-api-access-request.md`](docs/aotc-api-access-request.md).

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
