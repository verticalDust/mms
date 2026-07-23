import { headers } from "next/headers";

// Absolute base URL for building scan links encoded into QR labels. Prefers the
// APP_URL env (set behind Caddy in prod so labels use the real domain); falls
// back to the request's forwarded host/proto, so dev and unconfigured deploys
// still produce working QR codes. Trailing slashes stripped.
export async function appBaseUrl(): Promise<string> {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const hostname = host.replace(/:\d+$/, ""); // drop the port
  const isLocal =
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("127.");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

// One URL per machine; auth decides staff-page vs public-report at scan time
// (PLAN §1.5). Kept in one place so the label sheet and the scan route agree.
export function machineScanPath(code: string): string {
  return `/m/${encodeURIComponent(code)}`;
}
