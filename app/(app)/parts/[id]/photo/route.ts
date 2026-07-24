import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schema";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";
import {
  storePhoto,
  readPhoto,
  deletePhoto,
  looksLikeImage,
  photosEnabled,
} from "@/lib/uploads";

// A hard server cap; the client already downscales + compresses to well under it.
const MAX_BYTES = 3 * 1024 * 1024;

async function photoRef(id: number): Promise<string | null | undefined> {
  const [p] = await db
    .select({ photoPath: parts.photoPath })
    .from(parts)
    .where(eq(parts.id, id))
    .limit(1);
  return p?.photoPath; // undefined = no such part; null = part with no photo
}

// GET streams the part photo (auth-gated — the /parts prefix is behind the login
// gate, and requireUser enforces it for the <img> request's cookie).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id))
    return new NextResponse("Not found", { status: 404 });

  const ref = await photoRef(id);
  if (!ref) return new NextResponse("Not found", { status: 404 });
  const buf = await readPhoto(ref);
  if (!buf) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      // Never let the browser sniff a stored upload into something executable.
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    authorize(user, "part:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an admin can change part photos." },
      { status: 403 },
    );
  }
  if (!photosEnabled())
    return NextResponse.json(
      { error: "Photo uploads aren't enabled in this deployment." },
      { status: 503 },
    );
  const id = Number((await params).id);
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Unknown part." }, { status: 400 });

  const form = await req.formData();
  const file = form.get("photo");
  if (!(file instanceof File))
    return NextResponse.json({ error: "No image was sent." }, { status: 400 });
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "That isn't an image." }, { status: 415 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Image is too large." }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf))
    return NextResponse.json({ error: "That isn't a valid image." }, { status: 415 });
  if ((await photoRef(id)) === undefined)
    return NextResponse.json({ error: "Unknown part." }, { status: 404 });

  const ref = await storePhoto(`parts/part-${id}.jpg`, buf);
  await db
    .update(parts)
    .set({ photoPath: ref, updatedAt: new Date() })
    .where(eq(parts.id, id));

  revalidatePath(`/parts/${id}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    authorize(user, "part:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an admin can change part photos." },
      { status: 403 },
    );
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Unknown part." }, { status: 400 });

  const ref = await photoRef(id);
  if (ref === undefined)
    return NextResponse.json({ error: "Unknown part." }, { status: 404 });

  if (ref) await deletePhoto(ref);
  await db
    .update(parts)
    .set({ photoPath: null, updatedAt: new Date() })
    .where(eq(parts.id, id));

  revalidatePath(`/parts/${id}`);
  return NextResponse.json({ ok: true });
}
