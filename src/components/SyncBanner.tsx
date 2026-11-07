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

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="status-icon">
      <circle cx="8" cy="8" r="7" fill="var(--ink-2)" />
      <path d="M8 7.2v4" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="4.8" r="0.95" fill="var(--surface)" />
    </svg>
  );
}

/** Status of the automatic source (the Blizzard API), as written by the sync job. */
export function SyncBanner({ statuses }: { statuses: CharacterSyncStatus[] }) {
  const successes = statuses
    .map((s) => s.lastSuccessAt)
    .filter((t): t is string => Boolean(t))
    .sort();
  const lastSuccess = successes[successes.length - 1] ?? null;
  const ok = statuses.filter((s) => s.result === "ok").length;
  const notConfigured = statuses.every((s) => s.result === "not_configured" || s.result === "never");
  const problems = statuses.filter((s) => !["ok", "not_configured", "never"].includes(s.result));

  if (notConfigured) {
    return (
      <div className="sync" role="note">
        <InfoIcon />
        <div>
          <strong>Automatic sync is ready but not connected yet.</strong> Snapshots will come from the
          official Blizzard API every 6 hours once the site&apos;s Battle.net API access is set up.
          Until then the history shows snapshots recorded from AOTC.gg screenshots.
        </div>
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <p className="sync sync-ok">
        <OkIcon />
        <span>
          <strong>Auto-sync active.</strong> Data from the Blizzard API, refreshed every 6 hours
          {lastSuccess ? `; last sync ${formatDateTime(lastSuccess)}` : ""}. Characters update after they log out.
        </span>
      </p>
    );
  }

  const first = problems[0];
  return (
    <div className="sync sync-warn" role="note">
      <WarningIcon />
      <div>
        <strong>
          Auto-sync problem for {problems.length} of {statuses.length} characters.
        </strong>{" "}
        {first.message}
        {first.since ? ` (since ${formatDateTime(first.since)})` : ""}
        {ok > 0 && <> {ok} synced normally.</>}
        {lastSuccess && <> Last successful sync {formatDateTime(lastSuccess)}.</>}
      </div>
    </div>
  );
}
