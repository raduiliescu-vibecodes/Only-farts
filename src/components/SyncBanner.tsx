import { formatDateTime } from "@/lib/format";
import type { CharacterSyncStatus } from "@/lib/types";

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="status-icon">
      <path d="M8 1.5 15 14H1L8 1.5Z" fill="var(--status-warning)" />
      <path d="M8 6v3.5" stroke="#0b0b0b" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.9" fill="#0b0b0b" />
    </svg>
  );
}

function OkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="status-icon">
      <circle cx="8" cy="8" r="7" fill="var(--status-good)" />
      <path d="m4.8 8.2 2.1 2.1 4.3-4.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SyncBanner({ statuses }: { statuses: CharacterSyncStatus[] }) {
  const blocked = statuses.filter((s) => s.result === "blocked");
  const failing = statuses.filter((s) => s.result !== "ok" && s.result !== "blocked" && s.result !== "never");
  const successes = statuses
    .map((s) => s.lastSuccessAt)
    .filter((t): t is string => Boolean(t))
    .sort();
  const lastSuccess = successes[successes.length - 1] ?? null;

  if (blocked.length === 0 && failing.length === 0) {
    return (
      <p className="sync sync-ok">
        <OkIcon />
        <span>
          <strong>Auto-sync active.</strong>{" "}
          {lastSuccess ? `Last AOTC.gg sync ${formatDateTime(lastSuccess)}.` : "Waiting for the first AOTC.gg sync."}
        </span>
      </p>
    );
  }

  const since = blocked.map((s) => s.since).filter(Boolean).sort()[0] ?? null;
  return (
    <div className="sync sync-warn" role="note">
      <WarningIcon />
      <div>
        <strong>Auto-sync paused.</strong>{" "}
        {blocked.length > 0 ? (
          <>
            AOTC.gg protects its pages with a bot checkpoint, so automated requests are refused
            {since ? ` (seen since ${formatDateTime(since)})` : ""}. Snapshots are recorded manually
            until AOTC.gg offers an API or allows this dashboard&apos;s requests.
          </>
        ) : (
          <>The last AOTC.gg sync failed for {failing.length} character(s).</>
        )}
        {lastSuccess && <> Last successful sync {formatDateTime(lastSuccess)}.</>}
      </div>
    </div>
  );
}
