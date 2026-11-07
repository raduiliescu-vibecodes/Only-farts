import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterSheet } from "@/components/CharacterSheet";
import { Delta } from "@/components/Delta";
import { LevelMeter } from "@/components/LevelMeter";
import { LineChart } from "@/components/LineChart";
import { StatTile } from "@/components/StatTile";
import { characters, getCharacter, history, MAX_LEVEL, syncStatus } from "@/lib/data";
import { formatDateTime, formatInt, formatWindow } from "@/lib/format";
import { levelPace, rankBy, seriesFor, snapshotsFor, summarize } from "@/lib/stats";

const LEVEL_TICKS = [1, 10, 20, 30, 40, 50, 60];

const RESULT_LABEL: Record<string, string> = {
  ok: "Synced",
  blocked: "Blocked by AOTC.gg bot protection",
  http_error: "AOTC.gg returned an error",
  network_error: "Network error",
  parse_failed: "Profile fetched but could not be read",
  never: "Not attempted yet",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return characters.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/character/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = getCharacter(slug);
  return c
    ? { title: c.displayName, description: `${c.displayName}'s level, Gear Score and history in WoW Forever.` }
    : { title: "Character not found" };
}

export default async function CharacterPage(props: PageProps<"/character/[slug]">) {
  const { slug } = await props.params;
  const config = getCharacter(slug);
  if (!config) notFound();

  const all = characters.map((c) => summarize(c, history.snapshots));
  const c = all.find((s) => s.slug === slug)!;
  const ordered = snapshotsFor(history.snapshots, slug);
  const gsRank = rankBy(all, "gearScore").find((r) => r.slug === slug)?.rank ?? null;
  const levelRank = rankBy(all, "level").find((r) => r.slug === slug)?.rank ?? null;
  const pace = levelPace(ordered);
  const rankedByGs = all.filter((s) => s.gearScore !== null).length;
  const sync = syncStatus.characters[slug];

  const levelSeries = seriesFor([config], history.snapshots, "level");
  const gsSeries = seriesFor([config], history.snapshots, "gearScore");
  const subtitle = [c.race, c.className].filter(Boolean).join(" ");

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link href="/">← All characters</Link>
      </nav>

      <section className="intro char-intro">
        <div className="char-title">
          <span className="swatch swatch-xl" style={{ background: `var(--series-${c.colorSlot})` }} aria-hidden />
          <div>
            <h1>{c.displayName}</h1>
            <p className="secondary">
              {c.slug} · {[c.region.toUpperCase(), c.realm].filter(Boolean).join(" ")}
              {subtitle && <> · {subtitle}</>}
              {c.guild && <> · &lt;{c.guild}&gt;</>}
            </p>
          </div>
        </div>
        <a className="button" href={c.aotcUrl} target="_blank" rel="noopener noreferrer">
          View on AOTC.gg<span aria-hidden> ↗</span>
        </a>
      </section>

      <section aria-label="Current stats" className="tiles">
        <StatTile
          label="Level"
          value={
            <>
              {formatInt(c.level)}
              <span className="tile-of"> / {MAX_LEVEL}</span>
            </>
          }
          detail={
            <>
              <LevelMeter level={c.level} max={MAX_LEVEL} slot={c.colorSlot} name={c.displayName} />
              <Delta delta={c.levelDelta} />
            </>
          }
        />
        <StatTile
          label="Gear Score"
          value={formatInt(c.gearScore)}
          detail={<Delta delta={c.gearScoreDelta} />}
        />
        <StatTile
          label="Rank"
          value={gsRank ? `#${gsRank}` : "—"}
          detail={
            gsRank
              ? `By Gear Score, of ${rankedByGs} with data · #${levelRank ?? "—"} by level`
              : "Needs a Gear Score snapshot"
          }
        />
        <StatTile
          label="Leveling pace"
          value={pace === null ? "—" : pace.perDay.toFixed(1)}
          detail={pace === null ? "Needs two level snapshots" : `Levels per day over the last ${formatWindow(pace.days)}`}
        />
      </section>

      <CharacterSheet c={c} />

      <section aria-labelledby="lvl-h" className="section panel">
        <div className="section-head">
          <h2 id="lvl-h">Level progression</h2>
        </div>
        <LineChart
          series={levelSeries}
          label={`${c.displayName}'s level over time`}
          valueName="Level"
          yDomain={[1, MAX_LEVEL]}
          yTicks={LEVEL_TICKS}
        />
      </section>

      <section aria-labelledby="gsh-h" className="section panel">
        <div className="section-head">
          <h2 id="gsh-h">Gear Score history</h2>
        </div>
        <LineChart series={gsSeries} label={`${c.displayName}'s Gear Score over time`} valueName="Gear Score" />
      </section>

      <section aria-labelledby="snap-h" className="section">
        <div className="section-head">
          <h2 id="snap-h">Snapshots</h2>
          <p className="secondary">
            Sync status: {RESULT_LABEL[sync?.result ?? "never"]}
            {sync?.lastSuccessAt && <> · last success {formatDateTime(sync.lastSuccessAt)}</>}
          </p>
        </div>
        {ordered.length === 0 ? (
          <p className="chart-empty">No snapshots recorded for {c.displayName} yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">All snapshots for {c.displayName}, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Captured (UTC)</th>
                  <th scope="col">Source</th>
                  <th scope="col" className="num">Level</th>
                  <th scope="col" className="num">Gear Score</th>
                  <th scope="col" className="num">Item level</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {[...ordered].reverse().map((s) => (
                  <tr key={`${s.capturedAt}-${s.source}`}>
                    <td className="nowrap">{formatDateTime(s.capturedAt)}</td>
                    <td>{s.source === "aotc" ? "AOTC.gg sync" : "Manual"}</td>
                    <td className="num">{formatInt(s.level)}</td>
                    <td className="num">{formatInt(s.gearScore)}</td>
                    <td className="num">{formatInt(s.itemLevel)}</td>
                    <td className="secondary">{s.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
