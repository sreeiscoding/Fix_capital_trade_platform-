"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError(null);

    try {
      const payload = {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        name: String(form.get("name") ?? ""),
        wantsToBeMaster: form.get("wantsToBeMaster") === "on"
      };

      if (mode === "login") {
        await login({ email: payload.email, password: payload.password });
      } else {
        await register(payload);
      }

      router.push("/dashboard");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">FixCapital access</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{mode === "login" ? "Sign in" : "Create your workspace"}</h1>
          <p className="mt-2 text-sm text-slate-300">
            Use demo credentials first. Capital remains in your own Deriv account after OAuth linking.
          </p>
        </div>

        <div className="flex gap-2 rounded-2xl bg-slate-950/50 p-1">
          <button className={`flex-1 rounded-2xl px-4 py-2 text-sm ${mode === "login" ? "bg-accent text-slate-950" : "text-slate-300"}`} onClick={() => setMode("login")} type="button">
            Sign in
          </button>
          <button className={`flex-1 rounded-2xl px-4 py-2 text-sm ${mode === "register" ? "bg-accent text-slate-950" : "text-slate-300"}`} onClick={() => setMode("register")} type="button">
            Register
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === "register" ? <Input name="name" placeholder="Display name" required /> : null}
          <Input name="email" placeholder="Email address" type="email" required />
          <Input name="password" placeholder="Password" type="password" required />
          {mode === "register" ? (
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input className="h-4 w-4" name="wantsToBeMaster" type="checkbox" />
              Register me as a master trader profile
            </label>
          ) : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="rounded-2xl border border-warning/25 bg-warning/10 p-4 text-xs text-warning">
          Risk warning: copy trading and automated strategies can result in rapid losses. Past performance is not indicative of future results.
        </div>
      </Card>
    </div>
  );
}
