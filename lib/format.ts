// Elapsed downtime as a compact instrument readout, e.g. "2h 30m", "3d 4h".
export function downtimeSince(startedAt: Date, now: Date = new Date()): string {
  return formatDuration(now.getTime() - startedAt.getTime());
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${m}m`;
  return `${m}m`;
}

// Date in the factory timezone (falls back to the runtime zone if invalid).
export function formatDate(date: Date, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: timezone || undefined,
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}
