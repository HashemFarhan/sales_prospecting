import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, AUTH_SESSION_VALUE, isValidLogin } from "@/lib/auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = payload?.username?.trim() ?? "";
  const password = payload?.password ?? "";

  if (!isValidLogin(username, password)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  cookies().set({
    name: AUTH_COOKIE_NAME,
    value: AUTH_SESSION_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return NextResponse.json({ ok: true });
}
