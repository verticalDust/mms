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
    // Floor at 1 so a job past `startOfToday` never renders a nonsensical
    // "0d over" (matches the digest's day count in lib/digest.ts).
    return {
      kind: "overdue",
      days: Math.max(1, Math.round((startOfToday - due) / 86_400_000)),
    };
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

// ── Factory-timezone day/week boundaries (PLAN §1.5) ─────────────────────────
// All timestamps are stored UTC; the factory timezone is applied only at these
// read edges (the Today/This-week buckets and the "overdue" line). Reading the
// SERVER's zone is the "naive TZ handling" the invariant warns against — these
// helpers do it in the configured `timeZone` instead, using the
// same Intl primitive `formatDate` already relies on (no external date library).

// Offset (ms) of `timeZone` at instant `at`. Positive east of UTC. Works by
// reading the zone's wall-clock for the instant and treating it as if it were UTC.
function tzOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const f: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") f[p.type] = Number(p.value);
  const asUTC = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
  return asUTC - at.getTime();
}

// Epoch-ms of local midnight for calendar day (y, m, d) in `timeZone`. Date.UTC
// normalizes overflow, so d+1 / d+7 are valid. "Guess as-if-UTC, then correct by
// the real offset." A second correction handles the rare zone that transitions
// AT local midnight (the offset at the 00:00-UTC guess can differ from the one at
// true local midnight); re-sampling at the first result pins it exactly.
export function startOfDayEpoch(
  timeZone: string,
  y: number,
  m: number,
  d: number,
): number {
  const guess = Date.UTC(y, m - 1, d);
  const once = guess - tzOffsetMs(timeZone, new Date(guess));
  const twice = guess - tzOffsetMs(timeZone, new Date(once));
  return twice;
}

// The factory-TZ calendar date (year, month 1-12, day) for an instant.
function factoryYmd(
  timeZone: string,
  now: Date,
): { y: number; m: number; d: number } {
  // en-CA yields YYYY-MM-DD, sortable and unambiguous.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return { y, m, d };
}

// Epoch-ms of the start of today in the factory timezone — the single source of
// "today" for every overdue/bucket decision, so it means the same on every surface.
export function factoryStartOfDay(
  timeZone: string,
  now: Date = new Date(),
): number {
  const { y, m, d } = factoryYmd(timeZone, now);
  return startOfDayEpoch(timeZone, y, m, d);
}

export type BucketBoundaries = {
  startOfToday: number;
  startOfTomorrow: number;
  startOfNextWeek: number; // next Monday 00:00 factory-local (ISO week, Mon-start)
};

// The three factory-TZ boundaries that split open work into
// Overdue / Today / This week / Later. "This week" runs through the end of the
// current ISO week (Sunday); the week is Monday-start (Europe/Bulgaria).
export function bucketBoundaries(
  timeZone: string,
  now: Date = new Date(),
): BucketBoundaries {
  const { y, m, d } = factoryYmd(timeZone, now);
  const startOfToday = startOfDayEpoch(timeZone, y, m, d);
  const startOfTomorrow = startOfDayEpoch(timeZone, y, m, d + 1);
  // Weekday of the CALENDAR date y-m-d (not getUTCDay() of the midnight instant,
  // which is the prior day for a positive-offset zone). 0=Sun..6=Sat.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const isoDow = ((dow + 6) % 7) + 1; // Mon=1 … Sun=7
  const daysToNextMonday = 8 - isoDow; // Mon→7, Sun→1 (always ≥1: strictly next week)
  const startOfNextWeek = startOfDayEpoch(timeZone, y, m, d + daysToNextMonday);
  return { startOfToday, startOfTomorrow, startOfNextWeek };
}

export type WorkBucket = "overdue" | "today" | "week" | "later";

// Place a stored due date (UTC epoch-ms, or null) into exactly one bucket
// relative to the factory-TZ boundaries. Undated work sorts into "later".
export function bucketOf(
  dueDate: Date | null,
  b: BucketBoundaries,
): WorkBucket {
  if (!dueDate) return "later";
  const due = dueDate.getTime();
  if (due < b.startOfToday) return "overdue"; // strictly before today
  if (due < b.startOfTomorrow) return "today"; // due today is due, not late
  if (due < b.startOfNextWeek) return "week"; // tomorrow … Sunday
  return "later"; // next Monday onward
}
