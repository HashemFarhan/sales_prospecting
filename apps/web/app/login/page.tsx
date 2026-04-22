import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { AUTH_COOKIE_NAME, isAuthenticatedSession } from "@/lib/auth";

export default function LoginPage() {
  const session = cookies().get(AUTH_COOKIE_NAME)?.value;

  if (isAuthenticatedSession(session)) {
    redirect("/");
  }

  return <LoginForm />;
}
