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

- **From GitHub (works on mobile):** Actions → *Record snapshot* → *Run workflow*. Fill in any
  levels / Gear Scores you have and leave the rest blank.
- **From a terminal:**

  ```bash
  npm run snapshot -- --character taipan-ismydaddy --level 42 --gear-score 1234 \
    --item-level 48 --class Hunter --race "Night Elf" --note "Dinged 42"
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

The Vercel project `only-farts` exists and serves https://only-farts-nine.vercel.app. It was
first deployed from the CLI (`npx vercel deploy --prod`), so it is **not yet connected to this
repository**. To get automatic deploys on every push, including the sync and manual-snapshot
commits:

1. Install the [Vercel GitHub App](https://github.com/apps/vercel) on the
   `raduiliescu-vibecodes` account, with access to `Only-farts`.
2. In Vercel: **only-farts → Settings → Git → Connect Git Repository** and pick
   `raduiliescu-vibecodes/Only-farts`.
3. Set the production branch to the repository's default branch. The scheduled sync runs on
   the default branch, so the two must match.

No environment variables are needed.

---

Only Farts is a fan project and is not affiliated with AOTC.gg or Blizzard Entertainment.
World of Warcraft is a trademark of Blizzard Entertainment, Inc.
