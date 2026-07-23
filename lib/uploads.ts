import { mkdir } from "fs/promises";
import path from "path";

// Uploaded media lives in a data dir OUTSIDE /public (Next doesn't serve
// runtime-written public files in production) and is streamed back through an
// auth-gated route handler. The dir is a mounted volume in Docker (see DEPLOY.md)
// and is backed up alongside the DB.
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export function partsPhotoDir(): string {
  return path.join(UPLOADS_DIR, "parts");
}

export function partPhotoFile(partId: number): string {
  return path.join(partsPhotoDir(), `part-${partId}.jpg`);
}

export async function ensurePartsPhotoDir(): Promise<void> {
  await mkdir(partsPhotoDir(), { recursive: true });
}
