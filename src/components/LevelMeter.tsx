import type { ColorSlot } from "@/lib/types";

export function LevelMeter({
  level,
  max,
  slot,
  name,
}: {
  level: number | null;
  max: number;
  slot: ColorSlot;
  name: string;
}) {
  const pct = level === null ? 0 : Math.min(100, Math.max(0, (level / max) * 100));
  return (
    <div
      className="meter"
      role="meter"
      aria-valuemin={1}
      aria-valuemax={max}
      aria-valuenow={level ?? undefined}
      aria-valuetext={level === null ? "Level unknown" : `Level ${level} of ${max}`}
      aria-label={`${name} level progress`}
      style={{ ["--meter-color" as string]: `var(--series-${slot})` }}
    >
      {pct > 0 && <span className="meter-fill" style={{ width: `${pct}%` }} />}
    </div>
  );
}
