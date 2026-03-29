"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightLeft, Bot, Link as LinkIcon, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { EquityChart } from "@/components/dashboard/equity-chart";
import { TradingViewWidget } from "@/components/dashboard/tradingview-widget";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { formatCurrency } from "@/lib/utils";

type DashboardResponse = {
  stats: {
    balance: number;
    equity: number;
    linkedAccounts: number;
    activeBots: number;
    openCopyTrades: number;
  };
  accounts: Array<{
    id: string;
    loginId: string;
    environment: string;
    currency: string | null;
    balance: number;
    equity: number;
  }>;
  recentTrades: Array<{
    id: string;
    symbol: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  performance: {
    totalTrades: number;
    winRate: number;
    cumulativeProfit: number;
    averageProfit: number;
  };
  bots: Array<{ id: string; name: string; status: string; symbol: string }>;
  leaderboard: Array<{ userId: string; displayName: string; monthlyReturn: number }>;
  signals: Array<{ symbol: string; direction: string; probability: number }>;
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready, user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!token) {
      router.push("/auth/login");
      return;
    }

    apiRequest<DashboardResponse>("/api/v1/dashboard", { token })
      .then(setData)
      .catch((dashboardError) => {
        setError(dashboardError instanceof Error ? dashboardError.message : "Failed to load dashboard");
      });
  }, [token, ready, router]);

  const equitySeries = useMemo(() => {
    if (!data) {
      return [];
    }

    const base = data.stats.balance || 1000;
    return Array.from({ length: 7 }).map((_, index) => ({
      label: `D${index + 1}`,
      equity: base + index * 40 + (index % 2 === 0 ? 12 : -18)
    }));
  }, [data]);

  if (!ready || !token) {
    return null;
  }

  return (
    <DashboardShell
      title="Portfolio Command Center"
      subtitle="Monitor linked Deriv accounts, copied positions, AI setups, and automation uptime from one operator dashboard."
    >
      {searchParams.get("deriv") === "connected" ? (
        <Card className="border-success/30 bg-success/10 text-success">
          Deriv account linked successfully. Your funds remain in your own broker account at all times.
        </Card>
      ) : null}
      {error ? <Card className="text-red-300">{error}</Card> : null}
      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Balance" value={data.stats.balance} hint="Across linked Deriv accounts" />
            <StatCard label="Equity" value={data.stats.equity} hint="Includes open exposure and bot activity" />
            <StatCard label="Active bots" value={String(data.stats.activeBots)} hint="Workers currently running" />
            <StatCard label="Open copy trades" value={String(data.stats.openCopyTrades)} hint="Follower trades awaiting settlement" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <EquityChart data={equitySeries} />
            <Card className="space-y-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-warning" />
                <h3 className="text-xl font-semibold text-white">Compliance and risk posture</h3>
              </div>
              <div className="grid gap-3 text-sm text-slate-300">
                <div className="panel-muted p-4">KYC placeholder: {user?.kycStatus ?? "PENDING"}. Sumsub integration can be attached here later.</div>
                <div className="panel-muted p-4">Subscription tier: {user?.subscriptionTier}. Performance fees can be applied only on net realized copier profits.</div>
                <div className="panel-muted p-4">Connected accounts: {data.stats.linkedAccounts}. Use demo mode before turning on live capital.</div>
              </div>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <TradingViewWidget symbol="FX:EURUSD" />
            <div className="space-y-4">
              <Card>
                <div className="mb-4 flex items-center gap-3">
                  <LinkIcon className="h-4 w-4 text-accent" />
                  <h3 className="text-lg font-semibold text-white">Linked accounts</h3>
                </div>
                <div className="space-y-3">
                  {data.accounts.map((account) => (
                    <div key={account.id} className="panel-muted flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-white">{account.loginId}</p>
                        <p className="text-xs text-slate-400">{account.environment} • {account.currency ?? "USD"}</p>
                      </div>
                      <p className="text-sm text-slate-200">{formatCurrency(account.balance, account.currency ?? "USD")}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-accent" />
                    <p className="font-medium text-white">Copy relationships</p>
                  </div>
                  <p className="text-sm text-slate-300">{data.performance.totalTrades} total tracked trades</p>
                  <p className="text-xs text-slate-400">Win rate {(data.performance.winRate * 100).toFixed(1)}%</p>
                </Card>
                <Card className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-accent" />
                    <p className="font-medium text-white">Automation</p>
                  </div>
                  <p className="text-sm text-slate-300">{data.bots.length} bot configs saved</p>
                  <p className="text-xs text-slate-400">{data.signals.length} AI signal snapshots cached</p>
                </Card>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <h3 className="text-lg font-semibold text-white">Recent activity</h3>
              <div className="mt-4 space-y-3">
                {data.recentTrades.map((trade) => (
                  <div key={trade.id} className="panel-muted flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{trade.symbol}</p>
                      <p className="text-slate-400">{new Date(trade.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-white">{formatCurrency(trade.amount)}</p>
                      <p className="text-xs text-slate-400">{trade.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold text-white">Recommended actions</h3>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <div className="panel-muted p-4">Link a Deriv demo account before enabling live execution.</div>
                <div className="panel-muted p-4">Cap per-master allocation and max drawdown before subscribing to copy trading.</div>
                <div className="panel-muted p-4">Review AI signals as decision support only, not financial advice.</div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button className="w-full sm:w-auto" onClick={() => router.push("/copy-trading")}>Manage copy trading</Button>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => router.push("/bot-builder")}>Open bot builder</Button>
              </div>
            </Card>
          </section>
        </>
      ) : (
        <Card>Loading dashboard...</Card>
      )}
    </DashboardShell>
  );
}