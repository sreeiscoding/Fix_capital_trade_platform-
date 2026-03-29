"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SignalGrid } from "@/components/analytics/signal-grid";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

export default function AnalyticsPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const [signals, setSignals] = useState<any[]>([]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!token) {
      router.push("/auth/login");
      return;
    }

    apiRequest<{ signals: any[] }>("/api/v1/analytics/signals", { token }).then((response) => {
      setSignals(response.signals);
    });
  }, [token, ready, router]);

  if (!ready || !token) {
    return null;
  }

  return (
    <DashboardShell
      title="AI Analytics"
      subtitle="Blend technical rules, volatility heuristics, and live market context into actionable monitoring widgets."
    >
      <Card className="text-sm text-slate-300">
        AI outputs are decision-support signals only. They are not financial advice and should be validated alongside independent risk checks.
      </Card>
      <SignalGrid signals={signals} />
    </DashboardShell>
  );
}
