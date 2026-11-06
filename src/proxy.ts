import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";

const protectedPaths = [
  "/dashboard",
  "/trends",
  "/daily-records",
  "/experiments",
  "/alerts",
  "/system",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const protectedRoute =
    pathname === "/" ||
    protectedPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

  if (protectedRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && session)
    return NextResponse.redirect(new URL("/dashboard", request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
