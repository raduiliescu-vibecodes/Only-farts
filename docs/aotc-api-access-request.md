# API access request for AOTC.gg

Send to **hello@aotc.gg** (contact address in the AOTC.gg privacy policy) or post in the AOTC.gg
Discord (invite linked from the aotc.gg homepage). Copy-paste ready:

---

**Subject:** Read-only API access for a small fan dashboard (4 WoW Forever characters)

Hi AOTC.gg team,

I run **Only Farts** (https://only-farts-nine.vercel.app), a small, non-commercial fan dashboard that
tracks the progress of four friends' World of Warcraft: Forever characters (EU, Normal):

- https://www.aotc.gg/forever/character/eu/taipan-ismydaddy
- https://www.aotc.gg/forever/character/eu/phender-kx
- https://www.aotc.gg/forever/character/eu/fishlock-thefirst
- https://www.aotc.gg/forever/character/eu/sisu-jr

We'd like to show your **Gear Score and item level** for these four characters, with a link back to
each AOTC.gg profile. Automated requests to aotc.gg are (rightly) stopped by your Vercel Security
Checkpoint, and we don't want to work around it, so we're asking for an authorised route instead:

- a read-only API endpoint or JSON feed for a character's level, Gear Score and item level, **or**
- an API key / allow-listing for our identified client
  (`User-Agent: OnlyFartsDashboard/1.0 (+https://github.com/raduiliescu-vibecodes/Only-farts)`).

**Volume:** 4 characters, every 6 hours, about 16 requests a day, from GitHub Actions. We're happy
to go slower, cache longer, add attribution wherever you like, or stop at any time on request.

If there's a terms-of-use page or a preferred way to integrate, please point us to it.

Thanks for building AOTC.gg!

Radu, Only Farts

---

Notes for us:

- Source code: https://github.com/raduiliescu-vibecodes/Only-farts. The AOTC.gg reader is already
  written (`src/lib/aotc.ts`, manual workflow `sync-aotc.yml`) and only needs an allowed endpoint.
- If they offer an API, point `scripts/sync-aotc.ts` at it and re-enable the schedule.
