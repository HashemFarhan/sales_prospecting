import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, isAuthenticatedSession } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = isAuthenticatedSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const isLoginRoute = pathname === "/login";
  const isApiAuthRoute = pathname.startsWith("/api/auth/");

  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  if (!isAuthenticated && !isLoginRoute) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isLoginRoute) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
