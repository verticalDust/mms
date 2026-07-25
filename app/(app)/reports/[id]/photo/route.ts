import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { readPhoto } from "@/lib/uploads";

// Streams a report's photo for the triage thumbnail. Gated to the SAME planner
// permission as the rest of triage (report:triage) — a stranger's uploaded photo
// must not be enumerable by a technician who can't even see the triage queue. A
// 404 (not 403) avoids confirming which report ids carry a photo.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!can(user, "report:triage"))
    return new NextResponse("Not found", { status: 404 });
  const id = Number((await params).id);
  if (!Number.isInteger(id))
    return new NextResponse("Not found", { status: 404 });

  const [r] = await db
    .select({ photoPath: reports.photoPath })
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  if (!r?.photoPath) return new NextResponse("Not found", { status: 404 });

  const buf = await readPhoto(r.photoPath);
  if (!buf) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  });
}
