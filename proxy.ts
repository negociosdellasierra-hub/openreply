import { NextResponse, type NextRequest } from "next/server";
import { isFromBlockedSite } from "@/lib/security/blocked-sites";

const PROTECTED_PREFIXES = ["/dashboard", "/automations", "/logs", "/settings", "/atom"];

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token")
  );
}

export function proxy(request: NextRequest) {
  // Banned copycat sites get nothing: no files, no APIs, no pages.
  if (isFromBlockedSite(request.headers)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isLogin = pathname === "/login";
  const isAuthenticated = hasSessionCookie(request);

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/automations/:path*",
    "/logs/:path*",
    "/settings/:path*",
    "/atom/:path*",
    "/login",
    // Any path, but only when the request comes from a banned site (cheap: no proxy run otherwise).
    { source: "/:path*", has: [{ type: "header", key: "referer", value: ".*metodoatomico.*" }] },
    { source: "/:path*", has: [{ type: "header", key: "origin", value: ".*metodoatomico.*" }] },
  ],
};
