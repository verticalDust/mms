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

// Whether photo uploads can be stored: Blob configured, or a writable local disk
// in dev. On a serverless deploy with no Blob store the filesystem is read-only,
// so uploads are disabled — the UI hides its upload controls and the routes
// refuse cleanly instead of 500-ing.
export function photosEnabled(): boolean {
  return useBlob() || process.env.NODE_ENV !== "production";
}

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

// Strip EXIF/XMP metadata from a JPEG by dropping every APP1 (0xFFE1) segment —
// that's where a phone camera writes GPS coordinates and other identifying data.
// The public report photo is the one upload that comes from a stranger's phone,
// so we scrub it (PLAN §1.5). The client canvas re-encode already drops metadata;
// this is the server-side backstop for a direct/no-JS POST. Non-JPEG bytes and
// anything malformed pass through unchanged — worst case is an un-scrubbed byte,
// never a corrupted image.
export function stripJpegExif(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf; // not JPEG
  const out: Buffer[] = [buf.subarray(0, 2)]; // SOI
  let i = 2;
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) break; // expected a marker — bail and keep the rest
    if (buf[i + 1] === 0xff) {
      i++; // fill byte before a marker
      continue;
    }
    const marker = buf[i + 1];
    // Start of scan: entropy-coded data follows with no length to hop — copy the
    // remainder verbatim and stop.
    if (marker === 0xda) {
      out.push(buf.subarray(i));
      i = buf.length;
      break;
    }
    // Standalone markers (EOI, RSTn, TEM) have no length payload.
    if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > buf.length) break;
    const len = buf.readUInt16BE(i + 2); // includes the 2 length bytes
    const segEnd = i + 2 + len;
    if (len < 2 || segEnd > buf.length) break; // malformed — stop, keep the rest
    if (marker !== 0xe1) out.push(buf.subarray(i, segEnd)); // omit APP1 only
    i = segEnd;
  }
  if (i < buf.length) out.push(buf.subarray(i));
  return Buffer.concat(out);
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
