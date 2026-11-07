import Link from "next/link";
import { formatDateTime, formatInt } from "@/lib/format";
import type { CharacterSummary } from "@/lib/types";
import { LevelMeter } from "./LevelMeter";

export function CharacterCard({
  c,
  maxLevel,
}: {
  c: CharacterSummary;
  maxLevel: number;
}) {
  const subtitle = [c.race, c.className].filter(Boolean).join(" ");
  return (
    <article className="card" aria-labelledby={`card-${c.slug}`}>
      <header className="card-head">
        <span className="swatch swatch-lg" style={{ background: `var(--series-${c.colorSlot})` }} aria-hidden />
        <div>
          <h3 id={`card-${c.slug}`} className="card-title">
            <Link href={`/character/${c.slug}`}>{c.displayName}</Link>
          </h3>
          <div className="card-sub">
            {c.slug} · {c.region.toUpperCase()}
            {subtitle && <> · {subtitle}</>}
          </div>
        </div>
      </header>

      <div className="card-level">
        <div className="card-level-row">
          <span className="card-metric-label">Level</span>
          <span className="card-level-value">
            {formatInt(c.level)}
            <span className="muted"> / {maxLevel}</span>
          </span>
        </div>
        <LevelMeter level={c.level} max={maxLevel} slot={c.colorSlot} name={c.displayName} />
      </div>

      <dl className="card-stats">
        <div>
          <dt>Gear Score</dt>
          <dd>{formatInt(c.gearScore)}</dd>
        </div>
        <div>
          <dt>Item level</dt>
          <dd>{formatInt(c.itemLevel)}</dd>
        </div>
        <div>
          <dt>Snapshots</dt>
          <dd>{formatInt(c.snapshotCount)}</dd>
        </div>
      </dl>

      <footer className="card-foot">
        <span className="secondary">
          {c.lastUpdated ? `Updated ${formatDateTime(c.lastUpdated)}` : "No data yet"}
        </span>
        <span className="card-links">
          <Link href={`/character/${c.slug}`}>History</Link>
          <a href={c.aotcUrl} target="_blank" rel="noopener noreferrer">
            AOTC.gg<span aria-hidden> ↗</span>
          </a>
        </span>
      </footer>
    </article>
  );
}
