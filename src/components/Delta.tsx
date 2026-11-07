import { formatDelta, formatWindow } from "@/lib/format";
import type { Delta as DeltaValue } from "@/lib/types";

/** Signed change with direction carried by sign and arrow, not color alone. */
export function Delta({ delta }: { delta: DeltaValue | null }) {
  if (!delta) return null;
  const text = formatDelta(delta.value);
  if (!text) return null;
  const up = delta.value > 0;
  return (
    <span className={up ? "delta delta-up" : "delta delta-down"}>
      <span aria-hidden>{up ? "▲" : "▼"}</span> {text}
      <span className="delta-period"> in {formatWindow(delta.days)}</span>
    </span>
  );
}
