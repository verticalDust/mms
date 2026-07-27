"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import {
  getMachineByCode,
  countReportsForMachineSince,
} from "@/lib/queries";
import {
  storePhoto,
  looksLikeImage,
  photosEnabled,
  stripJpegExif,
} from "@/lib/uploads";
import {
  recentReportCookie,
  REPORT_DESC_MAX,
  REPORT_NAME_MAX,
  REPORT_PHOTO_MAX_BYTES,
  REPORT_BURST_WINDOW_MS,
  REPORT_BURST_MAX,
  REPORT_DAILY_WINDOW_MS,
  REPORT_DAILY_MAX,
} from "@/lib/reports";
import { LANG_COOKIE, pickLocale, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export type SubmitState = { error?: string };

const YEAR = 365 * 24 * 60 * 60; // seconds
const RECENT_MAX_AGE = 14 * 24 * 60 * 60; // 14 days

async function rememberLang(locale: Locale): Promise<void> {
  const jar = await cookies();
  // Not httpOnly: the form's instant toggle also writes this so the choice
  // carries to the confirmation / re-scan without a round-trip.
  jar.set(LANG_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR,
  });
}

export async function submitReport(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const code = String(formData.get("code") ?? "");
  const locale = pickLocale(String(formData.get("lang") ?? ""));
  const t = getMessages(locale).public;

  const machine = await getMachineByCode(code);
  // A dead or retired label can't take a report — bounce to the friendly page
  // (never 500, never leak). The form shouldn't render for these, but a stale
  // tab or a direct POST could still land here.
  if (!machine || machine.retiredAt) redirect(`/m/${encodeURIComponent(code)}`);

  await rememberLang(locale);

  // Honeypot: a hidden field no human fills. If it's set, this is a bot — take
  // the SAME confirmation path but store nothing, so the bot learns nothing.
  const honeypot = String(formData.get("website") ?? "").trim();
  if (honeypot) redirect(`/m/${encodeURIComponent(code)}/thanks`);

  // Per-machine rate limit / daily quota (PLAN §1.5). Serverless-safe (counts
  // rows, no shared memory). A flood is silently absorbed into the same
  // confirmation — generous limits mean real reporting never trips them.
  const now = Date.now();
  const [burst, daily] = await Promise.all([
    countReportsForMachineSince(machine.id, now - REPORT_BURST_WINDOW_MS),
    countReportsForMachineSince(machine.id, now - REPORT_DAILY_WINDOW_MS),
  ]);
  if (burst >= REPORT_BURST_MAX || daily >= REPORT_DAILY_MAX)
    redirect(`/m/${encodeURIComponent(code)}/thanks`);

  const description = String(formData.get("description") ?? "")
    .trim()
    .slice(0, REPORT_DESC_MAX);
  if (!description) return { error: t.descRequired };

  const reporterNameRaw = String(formData.get("reporterName") ?? "").trim();
  const reporterName = reporterNameRaw
    ? reporterNameRaw.slice(0, REPORT_NAME_MAX)
    : null;

  const [row] = await db
    .insert(reports)
    .values({ machineId: machine.id, description, reporterName, status: "new" })
    .returning({ id: reports.id });

  // Optional photo. A failure here must NOT lose the report (the words matter
  // most), so it's isolated: scrub EXIF, cap size, verify the bytes are really
  // an image, then store id-keyed and link it.
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0 && photosEnabled()) {
    try {
      if (file.size <= REPORT_PHOTO_MAX_BYTES) {
        const raw = Buffer.from(await file.arrayBuffer());
        if (looksLikeImage(raw)) {
          const clean = stripJpegExif(raw);
          // Random token in the key so the stored object isn't enumerable by
          // sequential id even if the (public) Blob store base URL ever leaks —
          // the auth-gated route stays the intended path, this closes the direct
          // one. The full ref (with token) is what we persist + resolve.
          const key = `reports/report-${row.id}-${randomBytes(6).toString("hex")}.jpg`;
          const ref = await storePhoto(key, clean);
          await db
            .update(reports)
            .set({ photoPath: ref })
            .where(eq(reports.id, row.id));
        }
      }
    } catch {
      // Photo lost, report kept — acceptable. Nothing is surfaced to Ivan.
    }
  }

  // Per-device pointer for the re-scan status view (E5-S3). httpOnly — only the
  // server reads it; the operator never needs to.
  const jar = await cookies();
  jar.set(recentReportCookie(machine.id), String(row.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: RECENT_MAX_AGE,
  });

  // The new report shows up in triage + on the dashboard badge immediately.
  revalidatePath("/reports");
  revalidatePath("/dashboard");

  redirect(`/m/${encodeURIComponent(code)}/thanks`);
}
