import type { WorkStatus } from "@/lib/queries";

// Anonymous-form hardening knobs (PLAN §1.5). Every limit is PER-MACHINE because
// the abuse vector is a single QR label. Serverless has no shared memory, so the
// limits are enforced by counting rows in `reports` (correct across instances).
// The numbers are generous for real use — a machine almost never gets a human
// report every few seconds — so only floods hit them.
export const REPORT_DESC_MAX = 1000;
export const REPORT_NAME_MAX = 80;
export const REPORT_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const REPORT_BURST_WINDOW_MS = 60_000; // 1 minute
// ≤10 per machine per minute. A real flood is orders of magnitude faster, so
// this still absorbs bots; the headroom keeps several workers scanning the same
// visibly-broken machine within a minute from silently losing genuine reports.
export const REPORT_BURST_MAX = 10;
export const REPORT_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REPORT_DAILY_MAX = 40; // ≤40 per machine per 24h

// Per-device pointer (no login): the recent-report cookie drives the re-scan
// status view (E5-S3). The language cookie now lives in lib/i18n/config
// (LANG_COOKIE) because it's shared with the whole app, not just this surface.
export const recentReportCookie = (machineId: number) => `mms_rep_${machineId}`;

export type CoarseStatus = "received" | "working" | "fixed" | "reviewed";

// The ONLY thing an operator sees on re-scan — coarse, no names, no internal
// notes (SCREENS §7.3). "reviewed" covers a dismissed report or a cancelled job:
// honest and no-blame, and never implies a fix that didn't happen.
export function coarseStatus(
  reportStatus: "new" | "handled" | "dismissed",
  workOrderStatus: WorkStatus | null,
): CoarseStatus {
  if (reportStatus === "dismissed") return "reviewed";
  if (workOrderStatus === "done") return "fixed";
  if (workOrderStatus === "cancelled") return "reviewed";
  if (workOrderStatus === "open" || workOrderStatus === "in_progress")
    return "working";
  return "received";
}
