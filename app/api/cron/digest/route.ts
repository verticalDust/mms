import { sendDailyDigest } from "@/lib/digest";

// Daily planner digest (E6-S3), triggered by Vercel Cron (see vercel.json). Like
// the PM cron it's exempt from the login gate (proxy PUBLIC_PREFIXES) so it FAILS
// CLOSED: it requires CRON_SECRET (Vercel sends it as a Bearer token). Always
// returns 200 on a valid call — even when a relay send fails — so a transient
// mail outage doesn't mark the cron failed; the digest is best-effort and the
// next daily run recomputes fresh. A clean day (or no relay configured) sends
// nothing; the JSON body reports what happened.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await sendDailyDigest();
  return Response.json({ ok: true, ...result });
}
