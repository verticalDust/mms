import { generateDuePmWorkOrders } from "@/lib/pm";

// Daily PM generation (E4-S2), triggered by Vercel Cron (see vercel.json). The
// generation is idempotent, so a missed day is caught up on the next run and a
// double-fire never duplicates. This route is exempt from the login gate, so it
// FAILS CLOSED: it requires CRON_SECRET (Vercel sends it as a Bearer token). If
// the secret isn't configured the endpoint refuses — the planner's manual
// "Generate due jobs" button covers generation in the meantime.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const generated = await generateDuePmWorkOrders();
  return Response.json({ ok: true, generated });
}
