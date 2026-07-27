// Display-time translation for tokens the database stores in English. The DB is
// a single source of truth in one language; we translate only when rendering, so
// a row created under one locale reads correctly under the other (and history
// stays stable). Pure functions — no React, importable anywhere.
import type { Messages } from "./messages";

// A history "toStatus" token: work statuses (open/in_progress/done/cancelled)
// plus plan-change verbs (reassigned/rescheduled/reprioritized). Unknown tokens
// fall back to a readable form so a future status never renders as a raw enum.
export function historyStatusLabel(toStatus: string, t: Messages): string {
  const map = t.system.toStatus as Record<string, string>;
  return map[toStatus] ?? toStatus.replace(/_/g, " ");
}

// A stored audit note. Exact matches translate directly; composite notes like
// "Low → High" or "No date → 12 Mar 2026" are split on " → " and translated
// segment-by-segment, so recognised tokens (priorities, "Unassigned", "No date")
// localize while names and historical dates pass through untouched. Free-text
// notes a human typed have no matching key and fall through as-is.
export function translateSystemNote(note: string, t: Messages): string {
  const map = t.system.notes as Record<string, string>;
  if (note in map) return map[note];
  if (note.includes(" → ")) {
    return note
      .split(" → ")
      .map((seg) => map[seg] ?? seg)
      .join(" → ");
  }
  return note;
}
