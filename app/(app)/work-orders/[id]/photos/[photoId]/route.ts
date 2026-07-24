import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { photos, workOrders } from "@/lib/db/schema";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { readPhoto, deletePhoto } from "@/lib/uploads";

// Resolve a photo only when it truly belongs to this work order (guards against
// probing another job's photo id).
async function findPhoto(workOrderId: number, photoId: number) {
  const [ph] = await db
    .select({ path: photos.path, uploadedBy: photos.uploadedBy })
    .from(photos)
    .where(
      and(
        eq(photos.id, photoId),
        eq(photos.entityType, "work_order"),
        eq(photos.entityId, workOrderId),
      ),
    )
    .limit(1);
  return ph;
}

// GET streams the photo (auth-gated — the /work-orders prefix is behind login).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  await requireUser();
  const { id, photoId } = await params;
  const woId = Number(id);
  const pid = Number(photoId);
  if (!Number.isInteger(woId) || !Number.isInteger(pid))
    return new NextResponse("Not found", { status: 404 });

  const ph = await findPhoto(woId, pid);
  if (!ph) return new NextResponse("Not found", { status: 404 });

  const buf = await readPhoto(ph.path);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id, photoId } = await params;
  const woId = Number(id);
  const pid = Number(photoId);
  if (!Number.isInteger(woId) || !Number.isInteger(pid))
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ph = await findPhoto(woId, pid);
  if (!ph) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [wo] = await db
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, woId))
    .limit(1);
  if (!wo || wo.status === "done" || wo.status === "cancelled")
    return NextResponse.json(
      { error: "This job is closed — photos are locked." },
      { status: 409 },
    );
  // Only the uploader or an admin can remove a photo.
  if (user.role !== "admin" && ph.uploadedBy !== user.id)
    return NextResponse.json(
      { error: "Only the person who added it (or an admin) can remove it." },
      { status: 403 },
    );

  await db.delete(photos).where(eq(photos.id, pid));
  await deletePhoto(ph.path);
  revalidatePath(`/work-orders/${woId}`);
  return NextResponse.json({ ok: true });
}
