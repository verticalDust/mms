import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import { put, del } from "@vercel/blob";

// Photo storage. Locally, files live in a data dir OUTSIDE /public (Next doesn't
// serve runtime-written public files) and are streamed back through auth-gated
// route handlers. On a serverless deploy (e.g. Vercel) the filesystem is
// read-only, so bytes go to Vercel Blob instead — selected at runtime by the
// presence of BLOB_READ_WRITE_TOKEN. Either way the DB stores a *reference*
// (a Blob URL, or a relative key under uploads/) that the helpers below resolve.
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const isUrl = (ref: string) => /^https?:\/\//i.test(ref);

// Store JPEG bytes under a stable key (e.g. "parts/part-3.jpg", "jobs/<uuid>.jpg").
// Returns the reference to persist in the DB: a public Blob URL on Blob, or the
// key itself for the local store.
export async function storePhoto(key: string, body: Buffer): Promise<string> {
  if (useBlob()) {
    const { url } = await put(key, body, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false, // the key is already unique (part id / uuid)
      allowOverwrite: true, // a part photo re-uploads to the same key
    });
    return url;
  }
  const file = path.join(UPLOADS_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return key;
}

// Bytes for a stored reference (Blob URL or local key), or null if missing.
export async function readPhoto(ref: string): Promise<Buffer | null> {
  try {
    if (isUrl(ref)) {
      const res = await fetch(ref);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    return await readFile(path.join(UPLOADS_DIR, ref));
  } catch {
    return null;
  }
}

export async function deletePhoto(ref: string): Promise<void> {
  try {
    if (isUrl(ref)) await del(ref);
    else await unlink(path.join(UPLOADS_DIR, ref));
  } catch {
    // already gone — fine
  }
}

// Trust the bytes, not the client-declared MIME: check real image magic numbers.
// Shared by every upload route so one definition governs what counts as an image.
export function looksLikeImage(b: Buffer): boolean {
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
