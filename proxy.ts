import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap gate: unauthenticated requests to internal routes bounce to /login.
// Full session validation happens server-side in requireUser(); the DB is never
// touched here (edge runtime + native driver don't mix). Anonymous internal
// pages: the public report surfaces under /r, and /m/{code} — the QR-label
// target, which resolves to staff-page or public-report by auth at scan time.
const PUBLIC_PREFIXES = ["/login", "/setup", "/forgot", "/reset", "/r/", "/m/"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p),
  );
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
