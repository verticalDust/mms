import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap gate: unauthenticated requests to internal routes bounce to /login.
// Full session validation happens server-side in requireUser(); the DB is never
// touched here (edge runtime + native driver don't mix). Anonymous internal
// pages: the public report surfaces under /r, and /m/{code} — the QR-label
// target, which resolves to staff-page or public-report by auth at scan time.
// /api/cron/* is hit by Vercel Cron with no session cookie; it guards itself
// with CRON_SECRET, so it must skip the login gate here (E4-S2).
const PUBLIC_PREFIXES = [
  "/login",
  "/setup",
  "/forgot",
  "/reset",
  "/r/",
  "/m/",
  "/api/cron/",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Match on a path-segment boundary: a prefix is public for its exact path or
  // anything nested under it, but NOT for a route that merely shares the string
  // (e.g. "/login" must not make a hypothetical "/loginX" public).
  const isPublic = PUBLIC_PREFIXES.some((p) => {
    const base = p.replace(/\/$/, "");
    return pathname === base || pathname.startsWith(base + "/");
  });
  if (isPublic) return NextResponse.next();

  if (!req.cookies.has("mms_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
