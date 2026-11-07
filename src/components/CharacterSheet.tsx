import { STAT_DEFS, type StatDef, type StatGroup } from "@/lib/extra";
import { formatDateTime, formatInt } from "@/lib/format";
import type { CharacterSummary } from "@/lib/types";

// At least one decimal, so 17 shows as "17.0%" and 14 DPS as "14.0", like the game's sheet.
const oneDecimal = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function formatStat(def: StatDef, value: number): string {
  if (def.kind === "percent") return `${oneDecimal.format(value)}%`;
  if (def.kind === "decimal") return oneDecimal.format(value);
  return formatInt(value);
}

const GROUPS: { id: StatGroup; title: string }[] = [
  { id: "base", title: "Base stats" },
  { id: "combat", title: "Combat" },
];

/** Latest recorded character-sheet stats, talents and honorable kills. */
export function CharacterSheet({ c }: { c: CharacterSummary }) {
  const sheet = c.sheet;
  if (!sheet && c.honorableKills === null) return null;

  const stats = sheet?.stats ?? {};
  const talents = sheet?.talents ?? null;

  return (
    <section aria-labelledby="sheet-h" className="section panel">
      <div className="section-head">
        <h2 id="sheet-h">Character sheet</h2>
        {sheet && <p className="secondary">As of {formatDateTime(sheet.capturedAt)}</p>}
      </div>

      {GROUPS.map((g) => {
        const defs = STAT_DEFS.filter((d) => d.group === g.id && stats[d.key] !== undefined);
        const showHk = g.id === "base" && c.honorableKills !== null;
        if (defs.length === 0 && !showHk) return null;
        return (
          <div key={g.id} className="sheet-group">
            <h3 className="sheet-group-title">{g.title}</h3>
            <dl className="sheet-grid">
              {defs.map((d) => (
                <div key={d.key}>
                  <dt>{d.label}</dt>
                  <dd>{formatStat(d, stats[d.key])}</dd>
                </div>
              ))}
              {showHk && (
                <div>
                  <dt>Honorable Kills</dt>
                  <dd>{formatInt(c.honorableKills)}</dd>
                </div>
              )}
            </dl>
          </div>
        );
      })}

      {talents && talents.length > 0 && (
        <div className="talents">
          <h3 className="talents-title">
            Talents{" "}
            <span className="secondary">({talents.map((t) => t.points).join(" / ")})</span>
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
