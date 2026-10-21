import type { NetworkSnapshot } from "./types";

export function SnapshotCaption({ snapshot, variant, highlighted = false }: {
  snapshot: Pick<NetworkSnapshot, "snapshotTime" | "label">;
  variant: "grid" | "detail";
  highlighted?: boolean;
}) {
  // Keep the UTC snapshot date intact; local-time formatting can shift the day.
  const date = snapshot.snapshotTime.slice(0, 10);
  return (
    <div className={`snapshot-caption snapshot-caption--${variant}${highlighted ? " is-highlighted" : ""}`}>
      <time dateTime={date}>{date}<span className="snapshot-caption-zone"> UTC</span></time>
      <span className="snapshot-caption-event" title={snapshot.label}>{snapshot.label}</span>
    </div>
  );
}
