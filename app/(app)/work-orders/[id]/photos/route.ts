import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { photos, workOrders } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { storePhoto, looksLikeImage, photosEnabled } from "@/lib/uploads";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per photo (AC)
const MAX_PER_JOB = 10;

// POST a new job photo (one file per request; the client uploads several by
// calling this repeatedly). Any signed-in user may document an open job.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!photosEnabled())
    return NextResponse.json(
      { error: "Photo uploads aren't enabled in this deployment." },
      { status: 503 },
    );
  const id = Number((await params).id);
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Unknown job." }, { status: 400 });

  const [wo] = await db
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!wo)
    return NextResponse.json(
      { error: "That work order no longer exists." },
      { status: 404 },
    );
  if (wo.status === "done" || wo.status === "cancelled")
    return NextResponse.json(
      { error: "This job is closed — photos are locked." },
      { status: 409 },
    );

  const [{ c: count }] = await db
    .select({ c: sql<number>`count(*)` })
    .from(photos)
    .where(and(eq(photos.entityType, "work_order"), eq(photos.entityId, id)));
  if (count >= MAX_PER_JOB)
    return NextResponse.json(
      { error: `Up to ${MAX_PER_JOB} photos per job.` },
      { status: 422 },
    );

  const form = await req.formData();
  const file = form.get("photo");
  if (!(file instanceof File))
    return NextResponse.json({ error: "No image was sent." }, { status: 400 });
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "That isn't an image." }, { status: 415 });
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: "Image is too large (max 10 MB)." },
      { status: 413 },
    );

  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf))
    return NextResponse.json(
      { error: "That isn't a valid image." },
      { status: 415 },
    );

  const ref = await storePhoto(`jobs/${randomUUID()}.jpg`, buf);
  await db.insert(photos).values({
    entityType: "work_order",
    entityId: id,
    path: ref,
    uploadedBy: user.id,
  });

  revalidatePath(`/work-orders/${id}`);
  return NextResponse.json({ ok: true });
}
