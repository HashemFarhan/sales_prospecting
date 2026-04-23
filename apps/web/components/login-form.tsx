"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to sign in.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f1a] px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)_28%),repeating-linear-gradient(115deg,rgba(255,255,255,0.012)_0,rgba(255,255,255,0.012)_2px,transparent_2px,transparent_180px)] opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(32,110,243,0.08),transparent_24%),radial-gradient(circle_at_right,rgba(255,255,255,0.03),transparent_22%)]" />
      <div className="relative z-10 w-full max-w-[520px] border border-white/5 bg-[#161b24] px-10 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="text-center">
          <h1 className="text-4xl font-semibold uppercase tracking-[0.08em] text-white sm:text-5xl">Tempest</h1>
          <div className="mx-auto mt-6 h-[3px] w-[190px] bg-[#23314b]">
            <div className="mx-auto h-full w-[68px] rounded-full bg-[#206ef3]" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-9 space-y-5">
          <label className="block">
            <span className="text-[13px] font-semibold text-white/85">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="mt-3 w-full border border-white/6 bg-[#202630] px-5 py-3 text-[1rem] text-white outline-none transition placeholder:text-white/30 focus:border-[#206ef3] focus:ring-0"
              placeholder="tmp_admin"
            />
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-white/85">Password</span>
            <div className="relative mt-3">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full border border-white/6 bg-[#202630] px-5 py-3 pr-14 text-[1rem] text-white outline-none transition placeholder:text-white/30 focus:border-[#206ef3] focus:ring-0"
                placeholder="Password"
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5 text-white/45">
                <Eye className="h-5 w-5" />
              </span>
            </div>
          </label>

          {error ? (
            <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center border px-5 py-3 text-[1rem] font-semibold text-white transition disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:bg-slate-500/20 disabled:text-slate-400"
            style={isSubmitting ? undefined : { backgroundColor: "#206ef3", borderColor: "#206ef3", color: "#ffffff" }}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          <p className="pt-2 text-center text-sm text-white/40">Secure access to your system</p>
        </form>
      </div>
    </div>
  );
}
