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

// Start of today, local time, as epoch ms. Due dates are stored day-granular
// (local midnight), so "overdue" is measured against this, not the wall clock.
export function startOfLocalDay(d: Date = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export type DueState =
  | { kind: "none" }
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "future"; date: Date };

// Day-granular due classification shared by the queue AND the dashboard so
// "overdue" means the same thing everywhere: a job due today is due, not late;
// overdue is strictly before today, measured in whole days.
export function dueState(
  dueDate: Date | null,
  startOfToday: number,
): DueState {
  if (!dueDate) return { kind: "none" };
  const due = dueDate.getTime();
  if (due < startOfToday)
    return { kind: "overdue", days: Math.round((startOfToday - due) / 86_400_000) };
  if (due < startOfToday + 86_400_000) return { kind: "today" };
  return { kind: "future", date: dueDate };
}

// Local Y-M-D for an <input type="date"> value. Due dates are stored at local
// midnight, so this round-trips them without a timezone shift.
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
