// Display-time translation for tokens the database stores in English. The DB is
// a single source of truth in one language; we translate only when rendering, so
// a row created under one locale reads correctly under the other (and history
// stays stable). Pure functions — no React, importable anywhere.
import { formatDate } from "../format";
import type { Locale } from "./config";
import type { Messages } from "./messages";

// A stored due-date inside a composite note: persisted as a full ISO timestamp
// (write side stores `date.toISOString()`), then formatted in the viewer's
// language here — so "reschedule" history reads natively for both locales.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

// A history "toStatus" token: work statuses (open/in_progress/done/cancelled)
// plus plan-change verbs (reassigned/rescheduled/reprioritized). Unknown tokens
// fall back to a readable form so a future status never renders as a raw enum.
export function historyStatusLabel(toStatus: string, t: Messages): string {
  const map = t.system.toStatus as Record<string, string>;
  return map[toStatus] ?? toStatus.replace(/_/g, " ");
}

// A stored audit note. Exact matches translate directly; composite notes like
// "Low → High" or "<iso> → No date" are split on " → " and resolved
// segment-by-segment: recognised tokens (priorities, "Unassigned", "No date")
// localize, ISO dates format in `locale`, and names pass through untouched.
// Free-text notes a human typed have no matching key and fall through as-is.
export function translateSystemNote(
  note: string,
  t: Messages,
  locale: Locale,
  timeZone?: string,
): string {
  const map = t.system.notes as Record<string, string>;
  if (note in map) return map[note];
  // Code-generated reversal note ("Reversed on WO-6") — localize the phrasing,
  // keep the WO reference. Matched before the split so the number stays intact.
  const reversed = /^Reversed on (WO-\d+)$/.exec(note);
  if (reversed) return t.system.reversedOnWo(reversed[1]);
  if (note.includes(" → ")) {
    return note
      .split(" → ")
      .map((seg) => {
        if (seg in map) return map[seg];
        if (ISO_TIMESTAMP.test(seg)) {
          const d = new Date(seg);
          if (!isNaN(d.getTime())) return formatDate(d, locale, timeZone);
        }
        return seg;
      })
      .join(" → ");
  }
  return note;
}
