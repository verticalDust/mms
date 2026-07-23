import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readFile, writeFile, unlink } from "fs/promises";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schema";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";
import { ensurePartsPhotoDir, partPhotoFile } from "@/lib/uploads";

// A hard server cap; the client already downscales + compresses to well under it.
const MAX_BYTES = 3 * 1024 * 1024;

// Trust the bytes, not the client-declared MIME: check real image magic numbers.
function looksLikeImage(b: Buffer): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return true; // PNG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true; // GIF
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return true; // WEBP (RIFF....WEBP)
  return false;
}

async function partExists(id: number): Promise<boolean> {
  const [p] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(eq(parts.id, id))
    .limit(1);
  return Boolean(p);
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
  try {
    const buf = await readFile(partPhotoFile(id));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/jpeg",
        // Never let the browser sniff a stored upload into something executable.
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
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
  if (!(await partExists(id)))
    return NextResponse.json({ error: "Unknown part." }, { status: 404 });

  await ensurePartsPhotoDir();
  await writeFile(partPhotoFile(id), buf);
  await db
    .update(parts)
    .set({ photoPath: `part-${id}.jpg`, updatedAt: new Date() })
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
  if (!(await partExists(id)))
    return NextResponse.json({ error: "Unknown part." }, { status: 404 });

  try {
    await unlink(partPhotoFile(id));
  } catch {
    // already gone — fine
  }
  await db
    .update(parts)
    .set({ photoPath: null, updatedAt: new Date() })
    .where(eq(parts.id, id));

  revalidatePath(`/parts/${id}`);
  return NextResponse.json({ ok: true });
}
