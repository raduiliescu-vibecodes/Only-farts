// Fixed locale and time zone so server-rendered and client-rendered text match.
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const shortDateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const integer = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function formatDateTime(iso: string | number | null): string {
  if (iso === null) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${dateTime.format(d)} UTC`;
}

export function formatShortDate(t: number): string {
  return shortDate.format(new Date(t));
}

export function formatShortDateTime(t: number): string {
  return shortDateTime.format(new Date(t));
}

export function formatInt(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? integer.format(n) : "—";
}

/** "7d", "3d" or "18h" for a window length in days. */
export function formatWindow(days: number): string {
  if (days >= 6.95) return "7d";
  if (days >= 1) return `${Math.round(days)}d`;
  return `${Math.max(1, Math.round(days * 24))}h`;
}

export function formatDelta(n: number | null): string | null {
  if (n === null || n === 0) return null;
  return `${n > 0 ? "+" : "−"}${integer.format(Math.abs(n))}`;
}
