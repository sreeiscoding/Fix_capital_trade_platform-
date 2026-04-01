"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-store";

type CallbackSession = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: "USER" | "MASTER" | "ADMIN";
    subscriptionTier: "FREE" | "PRO" | "VIP";
    kycStatus: "PENDING" | "REVIEW" | "APPROVED" | "REJECTED";
  };
};

export default function DerivAuthCallbackPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
      const params = new URLSearchParams(hash);
      const encodedSession = params.get("session");

      if (!encodedSession) {
        throw new Error("Missing FixCapital session from Deriv callback.");
      }

      const normalized = encodedSession.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
      const json = atob(padded);
      const session = JSON.parse(json) as CallbackSession;
      setSession(session);
      router.replace("/dashboard?deriv=connected");
    } catch (callbackError) {
      setError(callbackError instanceof Error ? callbackError.message : "Unable to complete Deriv sign-in.");
    }
  }, [router, setSession]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg space-y-5 text-center">
        {error ? (
          <>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Deriv callback</p>
              <h1 className="mt-3 text-3xl font-semibold text-white">We could not finish sign-in</h1>
              <p className="descriptive-copy mt-3 text-sm text-slate-300">{error}</p>
            </div>
            <Link href="/auth/login" className="descriptive-copy inline-flex justify-center rounded-2xl border border-border px-4 py-2 text-sm text-white transition hover:bg-white/5">
              Back to FixCapital sign-in
            </Link>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-accent" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Deriv callback</p>
              <h1 className="mt-3 text-3xl font-semibold text-white">Signing you into FixCapital</h1>
              <p className="descriptive-copy mt-3 text-sm text-slate-300">
                Your Deriv account has been confirmed. FixCapital is preparing your workspace and linked broker access now.
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
