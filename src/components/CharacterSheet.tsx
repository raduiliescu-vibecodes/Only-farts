import { STAT_DEFS } from "@/lib/extra";
import { formatDateTime, formatInt } from "@/lib/format";
import type { CharacterSummary } from "@/lib/types";

const pct = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** Latest recorded character-sheet stats, talents and honorable kills. */
export function CharacterSheet({ c }: { c: CharacterSummary }) {
  const sheet = c.sheet;
  if (!sheet && c.honorableKills === null) return null;

  const stats = STAT_DEFS.filter((d) => sheet?.stats[d.key] !== undefined);
  const talents = sheet?.talents ?? null;

  return (
    <section aria-labelledby="sheet-h" className="section panel">
      <div className="section-head">
        <h2 id="sheet-h">Character sheet</h2>
        {sheet && <p className="secondary">As of {formatDateTime(sheet.capturedAt)}</p>}
      </div>

      {(stats.length > 0 || c.honorableKills !== null) && (
        <dl className="sheet-grid">
          {stats.map((d) => (
            <div key={d.key}>
              <dt>{d.label}</dt>
              <dd>{d.percent ? `${pct.format(sheet!.stats[d.key])}%` : formatInt(sheet!.stats[d.key])}</dd>
            </div>
          ))}
          {c.honorableKills !== null && (
            <div>
              <dt>Honorable Kills</dt>
              <dd>{formatInt(c.honorableKills)}</dd>
            </div>
          )}
        </dl>
      )}

      {talents && talents.length > 0 && (
        <div className="talents">
          <h3 className="talents-title">
            Talents{" "}
            <span className="secondary">
              ({talents.map((t) => t.points).join(" / ")})
            </span>
          </h3>
          <ul className="talent-list">
            {talents.map((t) => (
              <li key={t.tree}>
                <span className="talent-tree">{t.tree}</span>
                <span className="talent-points">{t.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
