"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, CheckCircle2, Link2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

type Environment = "demo" | "real";

function normalizeAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to continue with Deriv right now.";
  }

  if (
    error.message.includes("Authentication failed against database server") ||
    error.message.includes("DATABASE_UNAVAILABLE") ||
    error.message.includes("provided database credentials")
  ) {
    return "FixCapital could not start the Deriv flow because the local database is not connected yet. Update DATABASE_URL in .env with the correct Postgres credentials, restart the API, and try again.";
  }

  return error.message;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [environment, setEnvironment] = useState<Environment>("demo");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"signin" | "signup" | null>(null);
  const [showDemoGuide, setShowDemoGuide] = useState(false);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (user) {
      router.replace("/dashboard");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("deriv") === "error") {
      setError("Deriv sign-in could not be completed. Please try again.");
    }
  }, [ready, router, user]);

  const helperText = useMemo(() => {
    return environment === "demo"
      ? "Recommended for getting started safely. Sign in with Deriv, then use your Deriv demo account inside FixCapital once the broker access is linked."
      : "Use this when you already want to connect your live Deriv account through FixCapital.";
  }, [environment]);

  const startDerivSignIn = async () => {
    setPendingAction("signin");
    setError(null);

    try {
      const response = await apiRequest<{ url: string }>("/api/v1/auth/deriv/start", {
        method: "POST",
        body: JSON.stringify({ environment })
      });
      window.location.href = response.url;
    } catch (submissionError) {
      setError(normalizeAuthError(submissionError));
      setPendingAction(null);
    }
  };

  const startDerivSignup = async () => {
    setPendingAction("signup");
    setError(null);

    try {
      const response = await apiRequest<{ url: string }>("/api/v1/auth/deriv/signup-url");
      window.location.href = response.url;
    } catch (submissionError) {
      setError(normalizeAuthError(submissionError));
      setPendingAction(null);
    }
  };

  const handlePrimaryAction = async () => {
    if (environment === "demo") {
      setShowDemoGuide(true);
      return;
    }

    await startDerivSignIn();
  };

  const demoSteps = [
    "Create a Deriv base account if you do not already have one.",
    "Inside Deriv Trader's Hub, create or switch to your Deriv demo account.",
    "Return to FixCapital and continue with Deriv for Demo so FixCapital can link the broker access."
  ] as const;

  return (
    <>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-2xl space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">FixCapital access</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Continue with Deriv through FixCapital</h1>
            <p className="descriptive-copy mt-3 max-w-2xl text-sm text-slate-300">
              Sign in with your Deriv account, or create one through FixCapital. Once Deriv confirms the account,
              FixCapital creates or updates your local workspace automatically and keeps your trading activity inside
              your own broker account.
            </p>
          </div>

          <div className="grid gap-3 rounded-3xl border border-border/70 bg-slate-950/40 p-2 sm:grid-cols-2">
            {([
              {
                key: "demo",
                label: "Demo mode",
                description: "Best for testing copy trading, bots, and risk rules without live capital."
              },
              {
                key: "real",
                label: "Live mode",
                description: "Use your real Deriv account when you are ready for live execution."
              }
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setEnvironment(option.key)}
                className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                  environment === option.key
                    ? "border-accent/40 bg-accent/10 text-white"
                    : "border-transparent text-slate-300 hover:border-accent/20 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold">{option.label}</p>
                  {environment === option.key ? <BadgeCheck className="h-4 w-4 text-accent" /> : null}
                </div>
                <p className="descriptive-copy mt-2 text-sm text-slate-400">{option.description}</p>
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-border/70 bg-card/50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-accent" />
              <div>
                <p className="text-sm font-medium text-white">{environment === "demo" ? "Demo-first setup" : "Live account setup"}</p>
                <p className="descriptive-copy mt-2 text-sm text-slate-300">{helperText}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" className="w-full" onClick={() => void handlePrimaryAction()} disabled={pendingAction !== null}>
              {pendingAction === "signin" ? "Opening Deriv..." : environment === "demo" ? "Continue with Deriv for Demo" : "Continue with Deriv Live"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => void startDerivSignup()} disabled={pendingAction !== null}>
              Create Deriv base account
              <Link2 className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="rounded-2xl border border-border/70 bg-card/50 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">How Deriv signup works</p>
            <p className="descriptive-copy mt-2 text-sm text-slate-300">
              Deriv opens its main signup page first. After the base account is created, you can enable or switch to a demo account in Deriv and then return here to continue through FixCapital.
            </p>
          </div>

          <div className="descriptive-copy rounded-2xl border border-warning/25 bg-warning/10 p-4 text-xs text-warning">
            Risk warning: copy trading and automated strategies can result in rapid losses. Past performance is not indicative of future results.
          </div>
        </Card>
      </div>

      {showDemoGuide ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-border/70 bg-[#0f1724] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Demo guide</p>
                <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Before FixCapital opens Deriv Demo</h2>
                <p className="descriptive-copy mt-3 max-w-2xl text-sm text-slate-300">
                  Follow these steps first so your Deriv demo path is clear and the FixCapital connection makes sense when you continue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoGuide(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card/70 text-slate-300 transition hover:border-accent/30 hover:text-white"
                aria-label="Close demo guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {demoSteps.map((step, index) => (
                <div key={step} className="rounded-3xl border border-border/70 bg-card/50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent/10 font-secondary text-sm text-accent">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-white">{step}</p>
                      {index === 1 ? (
                        <p className="descriptive-copy mt-2 text-sm text-slate-400">
                          Deriv usually creates the base account first. Demo accounts are then managed from Deriv Trader&apos;s Hub.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-3xl border border-accent/20 bg-accent/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-accent" />
                <p className="descriptive-copy text-sm text-slate-200">
                  If you already have a Deriv account and a demo profile ready, you can continue from here and FixCapital will start the broker-link flow for demo mode.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowDemoGuide(false)} disabled={pendingAction !== null}>
                Close
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => void startDerivSignup()} disabled={pendingAction !== null}>
                {pendingAction === "signup" ? "Opening Deriv..." : "Create Deriv account"}
                <Link2 className="ml-2 h-4 w-4" />
              </Button>
              <Button type="button" className="w-full" onClick={() => void startDerivSignIn()} disabled={pendingAction !== null}>
                {pendingAction === "signin" ? "Opening Deriv..." : "I already have Deriv"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
