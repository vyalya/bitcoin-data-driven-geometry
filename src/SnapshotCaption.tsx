import type { NetworkSnapshot } from "./types";

export function SnapshotCaption({ snapshot }: {
  snapshot: Pick<NetworkSnapshot, "snapshotTime" | "label">;
}) {
  // Keep the UTC snapshot date intact; local-time formatting can shift the day.
  const date = snapshot.snapshotTime.slice(0, 10);
  return (
    <div className="snapshot-caption">
      <time dateTime={date}>{date}<span className="snapshot-caption-zone"> UTC</span></time>
      <span className="snapshot-caption-event" title={snapshot.label}>{snapshot.label}</span>
    </div>
  );
}
