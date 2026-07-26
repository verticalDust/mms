import { appBaseUrl } from "@/lib/url";
import { getSettings } from "@/lib/setup";
import { factoryStartOfDay, formatDate } from "@/lib/format";
import {
  listOverdueWorkOrders,
  searchParts,
  adminRecipients,
} from "@/lib/queries";
import { mailEnabled, sendMail } from "@/lib/email";

// The daily planner digest (E6-S3): overdue jobs + low-stock parts, one English
// email per admin, early factory morning. Silent on a clean day. Best-effort —
// a relay outage is logged and simply retried by tomorrow's run (the digest is
// stateless: it recomputes fresh each morning, so there is nothing to queue).

export type DigestData = {
  overdue: {
    workOrderId: number;
    machineCode: string;
    machineName: string;
    title: string;
    daysOverdue: number;
  }[];
  lowStock: {
    partId: number;
    sku: string;
    name: string;
    onHand: number;
    minLevel: number;
  }[];
};

const DAY = 86_400_000;

export async function collectDigest(startOfToday: number): Promise<DigestData> {
  const [overdueRows, lowRows] = await Promise.all([
    listOverdueWorkOrders(startOfToday),
    searchParts({ low: true }),
  ]);
  return {
    overdue: overdueRows.map((w) => ({
      workOrderId: w.id,
      machineCode: w.machineCode,
      machineName: w.machineName,
      title: w.title,
      // Whole days past due, measured from the factory-TZ start of today — the
      // same formula the queue's DueCell uses (lib/format dueState). The query
      // only returns rows with a due date, so dueDate is always present here.
      daysOverdue: Math.max(
        1,
        Math.round((startOfToday - w.dueDate!.getTime()) / DAY),
      ),
    })),
    lowStock: lowRows.map((p) => ({
      partId: p.id,
      sku: p.sku,
      name: p.name,
      onHand: p.onHand,
      minLevel: p.minLevel,
    })),
  };
}

// A clean day has nothing overdue AND nothing low — no email is sent.
export function isClean(d: DigestData): boolean {
  return d.overdue.length === 0 && d.lowStock.length === 0;
}

// Minimal HTML entity escape — every value below is factory-supplied text
// (machine/part names, job titles) dropped into an HTML email.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Palette mirrors the on-screen chips so the email reads as the same product.
// Email clients strip <style>/web fonts, so everything is inline + system fonts.
const C = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  hair: "#E2E8F0",
  ink: "#0F172A",
  muted: "#475569",
  quiet: "#64748B",
  orange: "#EA580C",
  red: "#B91C1C",
  amber: "#B45309",
} as const;
const MONO =
  "font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-variant-numeric:tabular-nums;";
const SANS =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function sectionHeader(label: string): string {
  return `<tr><td style="padding:18px 24px 6px;${SANS}font-size:13px;font-weight:600;letter-spacing:.03em;color:${C.muted};">${esc(
    label,
  )}</td></tr>`;
}

function overdueRow(
  r: DigestData["overdue"][number],
  baseUrl: string,
): string {
  return `<tr><td style="padding:0 24px;">
    <a href="${baseUrl}/work-orders/${r.workOrderId}" style="display:block;text-decoration:none;border-left:3px solid #DC2626;padding:10px 12px;border-bottom:1px solid ${C.hair};">
      <span style="${MONO}font-size:12px;color:${C.quiet};">WO-${r.workOrderId}</span>
      <span style="${SANS}color:${C.ink};font-size:15px;"> · ${esc(r.title)}</span><br>
      <span style="${SANS}color:${C.quiet};font-size:13px;"><span style="${MONO}">${esc(
        r.machineCode,
      )}</span> · ${esc(r.machineName)}</span>
      <span style="${SANS}color:${C.red};font-size:13px;"> &nbsp;●&nbsp;${r.daysOverdue}d over</span>
    </a></td></tr>`;
}

function lowRow(r: DigestData["lowStock"][number], baseUrl: string): string {
  return `<tr><td style="padding:0 24px;">
    <a href="${baseUrl}/parts/${r.partId}" style="display:block;text-decoration:none;padding:10px 12px;border-bottom:1px solid ${C.hair};">
      <span style="${SANS}color:${C.ink};font-size:15px;">${esc(r.name)}</span>
      <span style="${MONO}font-size:12px;color:${C.quiet};"> &nbsp;${esc(r.sku)}</span><br>
      <span style="${SANS}color:${C.amber};font-size:13px;">▲ on hand <span style="${MONO}">${r.onHand}</span> / min <span style="${MONO}">${r.minLevel}</span></span>
    </a></td></tr>`;
}

export function renderDigestHtml(
  d: DigestData,
  baseUrl: string,
  factoryName: string,
  dateStr: string,
): string {
  const overdue =
    d.overdue.length > 0
      ? sectionHeader(`Overdue jobs (${d.overdue.length})`) +
        d.overdue.map((r) => overdueRow(r, baseUrl)).join("")
      : "";
  const low =
    d.lowStock.length > 0
      ? sectionHeader(`Low-stock parts (${d.lowStock.length})`) +
        d.lowStock.map((r) => lowRow(r, baseUrl)).join("")
      : "";
  return `<!doctype html><html><body style="margin:0;background:${C.bg};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg};">
    <tr><td align="center" style="padding:24px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:${C.card};border:1px solid ${C.hair};border-radius:8px;">
        <tr><td style="padding:20px 24px 14px;border-bottom:3px solid ${C.orange};">
          <div style="${SANS}font-size:18px;font-weight:600;letter-spacing:.02em;color:${C.ink};">MMS</div>
          <div style="${SANS}font-size:13px;color:${C.quiet};">${esc(factoryName)} · ${esc(dateStr)}</div>
        </td></tr>
        ${overdue}
        ${low}
        <tr><td style="padding:16px 24px;border-top:1px solid ${C.hair};${SANS}font-size:12px;color:${C.quiet};">
          Open the dashboard → <a href="${baseUrl}/dashboard" style="color:${C.orange};text-decoration:none;">MMS</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

export function renderDigestText(
  d: DigestData,
  baseUrl: string,
  factoryName: string,
  dateStr: string,
): string {
  const lines: string[] = [`MMS — ${factoryName} — ${dateStr}`, ""];
  if (d.overdue.length) {
    lines.push(`Overdue jobs (${d.overdue.length}):`);
    for (const r of d.overdue)
      lines.push(
        `  WO-${r.workOrderId} · ${r.title} — ${r.machineCode} ${r.machineName} — ${r.daysOverdue}d over  ${baseUrl}/work-orders/${r.workOrderId}`,
      );
    lines.push("");
  }
  if (d.lowStock.length) {
    lines.push(`Low-stock parts (${d.lowStock.length}):`);
    for (const r of d.lowStock)
      lines.push(
        `  ${r.name} (${r.sku}) — on hand ${r.onHand} / min ${r.minLevel}  ${baseUrl}/parts/${r.partId}`,
      );
    lines.push("");
  }
  lines.push(`Dashboard: ${baseUrl}/dashboard`);
  return lines.join("\n");
}

export type DigestResult = {
  skipped?: "mail-not-configured" | "clean-day" | "no-admins";
  recipients?: number;
  sent?: number;
  failed?: number;
  overdue?: number;
  lowStock?: number;
};

// Orchestrator called by the cron route. Returns a summary for the JSON body.
export async function sendDailyDigest(
  now: Date = new Date(),
): Promise<DigestResult> {
  if (!mailEnabled()) return { skipped: "mail-not-configured" };

  const settings = await getSettings();
  const timeZone = settings?.timezone ?? "UTC";
  const factoryName = settings?.factoryName ?? "MMS";
  const startOfToday = factoryStartOfDay(timeZone, now);

  const data = await collectDigest(startOfToday);
  if (isClean(data)) return { skipped: "clean-day" }; // the hard rule

  const admins = await adminRecipients();
  if (admins.length === 0) return { skipped: "no-admins" };

  const baseUrl = await appBaseUrl();
  const dateStr = formatDate(now, timeZone);
  const html = renderDigestHtml(data, baseUrl, factoryName, dateStr);
  const text = renderDigestText(data, baseUrl, factoryName, dateStr);
  const subject = `${factoryName} · ${data.overdue.length} overdue, ${data.lowStock.length} low on stock`;

  let sent = 0;
  let failed = 0;
  for (const a of admins) {
    const ok = await sendMail({ to: a.email, subject, html, text });
    ok ? sent++ : failed++;
  }
  return {
    recipients: admins.length,
    sent,
    failed,
    overdue: data.overdue.length,
    lowStock: data.lowStock.length,
  };
}
