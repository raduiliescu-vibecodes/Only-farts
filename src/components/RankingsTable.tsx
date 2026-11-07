"use client";

import Link from "next/link";
import { useState } from "react";
import { rankBy } from "@/lib/stats";
import { formatDateTime, formatInt } from "@/lib/format";
import type { CharacterSummary, RankMetric } from "@/lib/types";
import { LevelMeter } from "./LevelMeter";
import { Delta } from "./Delta";

const METRICS: { id: RankMetric; label: string }[] = [
  { id: "gearScore", label: "Gear Score" },
  { id: "level", label: "Level" },
];

export function RankingsTable({
  rows,
  maxLevel,
}: {
  rows: CharacterSummary[];
  maxLevel: number;
}) {
  const [metric, setMetric] = useState<RankMetric>("gearScore");
  const ranked = rankBy(rows, metric);

  return (
    <div className="rankings">
      <div className="segmented" role="group" aria-label="Rank by">
        <span className="segmented-label">Rank by</span>
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={metric === m.id}
            onClick={() => setMetric(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="table-scroll">
        <table className="data-table rankings-table">
          <caption className="sr-only">
            Character rankings by {metric === "gearScore" ? "Gear Score" : "level"}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="num">#</th>
              <th scope="col">Character</th>
              <th scope="col" className="level-col">Level</th>
              <th scope="col" className="num">Gear Score</th>
              <th scope="col" className="num col-optional">Item level</th>
              <th scope="col" className="col-optional">Last update</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.slug}>
                <td className="num rank-cell">{r.rank ?? "–"}</td>
                <td>
                  <div className="who">
                    <span className="swatch" style={{ background: `var(--series-${r.colorSlot})` }} aria-hidden />
                    <div>
                      <Link href={`/character/${r.slug}`} className="who-name">
                        {r.displayName}
                      </Link>
                      <div className="who-sub">
                        {[r.race, r.className].filter(Boolean).join(" ") || r.slug}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="level-col">
                  <div className="level-cell">
                    <span className="level-num">{formatInt(r.level)}</span>
                    <LevelMeter level={r.level} max={maxLevel} slot={r.colorSlot} name={r.displayName} />
                  </div>
                  <Delta delta={r.levelDelta} />
                </td>
                <td className="num">
                  <div>{formatInt(r.gearScore)}</div>
                  <Delta delta={r.gearScoreDelta} />
                </td>
                <td className="num col-optional">{formatInt(r.itemLevel)}</td>
                <td className="nowrap secondary col-optional">{r.lastUpdated ? formatDateTime(r.lastUpdated) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
