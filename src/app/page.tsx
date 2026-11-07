import { CharacterCard } from "@/components/CharacterCard";
import { LineChart } from "@/components/LineChart";
import { RankingsTable } from "@/components/RankingsTable";
import { StatTile } from "@/components/StatTile";
import { SyncBanner } from "@/components/SyncBanner";
import { characters, charactersFile, history, MAX_LEVEL, syncStatus } from "@/lib/data";
import { formatInt } from "@/lib/format";
import { rankBy, seriesFor, summarize } from "@/lib/stats";
import type { CharacterSyncStatus } from "@/lib/types";

const LEVEL_TICKS = [1, 10, 20, 30, 40, 50, 60];

const NEVER: CharacterSyncStatus = { result: "never", message: "", since: null, lastSuccessAt: null };

export default function Dashboard() {
  const summaries = characters.map((c) => summarize(c, history.snapshots));
  const topGs = rankBy(summaries, "gearScore")[0];
  const topLevel = rankBy(summaries, "level")[0];
  const knownLevels = summaries.map((s) => s.level).filter((l): l is number => l !== null);
  const avgLevel = knownLevels.length
    ? knownLevels.reduce((a, b) => a + b, 0) / knownLevels.length
    : null;
  const capped = knownLevels.filter((l) => l >= MAX_LEVEL).length;

  const levelSeries = seriesFor(characters, history.snapshots, "level");
  const gsSeries = seriesFor(characters, history.snapshots, "gearScore");

  return (
    <>
      <section className="intro">
        <p className="eyebrow">{charactersFile.game}</p>
        <h1>The Only Farts progress board</h1>
        <p className="lede">
          Four heroes, one leaderboard: who levels fastest and who wears the best gear. Rankings,
          Gear Score and level history for{" "}
          {new Intl.ListFormat("en-GB", { type: "conjunction" }).format(characters.map((c) => c.displayName))}.
        </p>
        <SyncBanner statuses={characters.map((c) => syncStatus.characters[c.slug] ?? NEVER)} />
      </section>

      <section aria-label="Headline numbers" className="tiles">
        <StatTile
          label="Top Gear Score"
          value={formatInt(topGs?.gearScore ?? null)}
          detail={topGs?.gearScore != null ? topGs.displayName : "No data yet"}
        />
        <StatTile
          label="Highest level"
          value={formatInt(topLevel?.level ?? null)}
          detail={topLevel?.level != null ? topLevel.displayName : "No data yet"}
        />
        <StatTile
          label="Average level"
          value={avgLevel === null ? "—" : avgLevel.toFixed(1)}
          detail={`${knownLevels.length} of ${characters.length} characters known`}
        />
        <StatTile
          label={`At level ${MAX_LEVEL}`}
          value={`${capped} / ${characters.length}`}
          detail={`${formatInt(history.snapshots.length)} ${history.snapshots.length === 1 ? "snapshot" : "snapshots"} recorded`}
        />
      </section>

      <section aria-labelledby="rankings-h" className="section">
        <div className="section-head">
          <h2 id="rankings-h">Rankings</h2>
          <p className="secondary">Ties share a rank. Unknown values rank last.</p>
        </div>
        <RankingsTable rows={summaries} maxLevel={MAX_LEVEL} />
      </section>

      <section aria-labelledby="chars-h" className="section">
        <div className="section-head">
          <h2 id="chars-h">Characters</h2>
        </div>
        <div className="card-grid">
          {summaries.map((s) => (
            <CharacterCard key={s.slug} c={s} maxLevel={MAX_LEVEL} />
          ))}
        </div>
      </section>

      <section aria-labelledby="level-h" className="section panel">
        <div className="section-head">
          <h2 id="level-h">Level progression</h2>
          <p className="secondary">Level at each snapshot, 1–{MAX_LEVEL}. A value holds until the next snapshot.</p>
        </div>
        <LineChart
          series={levelSeries}
          label="Level over time"
          valueName="Level"
          yDomain={[1, MAX_LEVEL]}
          yTicks={LEVEL_TICKS}
        />
      </section>

      <section aria-labelledby="gs-h" className="section panel">
        <div className="section-head">
          <h2 id="gs-h">Gear Score history</h2>
          <p className="secondary">Gear Score as reported on each character&apos;s AOTC.gg profile.</p>
        </div>
        <LineChart series={gsSeries} label="Gear Score over time" valueName="Gear Score" />
      </section>

      <section aria-labelledby="how-h" className="section how">
        <h2 id="how-h">How the data gets here</h2>
        <ol>
          <li>
            <strong>Automatic sync.</strong> A scheduled GitHub Action checks each AOTC.gg profile
            every 6 hours with an identified, rate-limited request. When it can read a profile, it
            records a snapshot and the site redeploys.
          </li>
          <li>
            <strong>When AOTC.gg refuses automated requests</strong> (right now it does), the sync
            records that status and changes nothing. It never tries to get past the site&apos;s bot
            protection.
          </li>
          <li>
            <strong>Manual snapshots.</strong> Run the <em>Record snapshot</em> workflow from the
            repository&apos;s Actions tab with a character&apos;s current level and Gear Score from
            their AOTC.gg page. History and charts update on the next deploy.
          </li>
        </ol>
      </section>
    </>
  );
}
