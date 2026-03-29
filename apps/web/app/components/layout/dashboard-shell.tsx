"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowRightLeft,
  Bot,
  BrainCircuit,
  CandlestickChart,
  LayoutDashboard,
  LogOut
} from "lucide-react";
import { SOCKET_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { SiteFooter } from "./site-footer";
import { Button } from "../ui/button";

const navItems: Array<{
  href: Route;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/copy-trading", label: "Copy Trading", icon: ArrowRightLeft },
  { href: "/bot-builder", label: "Bot Builder", icon: Bot },
  { href: "/analytics", label: "AI Analytics", icon: BrainCircuit },
  { href: "/markets", label: "Markets", icon: CandlestickChart }
];

export function DashboardShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, token, logout } = useAuth();
  const [liveNotice, setLiveNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token }
    });

    socket.on("system:notice", (notice: { title?: string; body?: string }) => {
      setLiveNotice(notice.body ?? notice.title ?? null);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="reveal-up panel-muted h-fit overflow-hidden p-4 lg:sticky lg:top-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-lg font-semibold tracking-wide text-white">
              FixCapital
            </Link>
            <span className="risk-chip">High Risk</span>
          </div>
          <div className="mb-6 rounded-2xl border border-border/70 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Signed in as</p>
            <p className="mt-2 truncate text-sm font-semibold text-white">{user?.name ?? "Guest"}</p>
            <p className="text-xs text-slate-400">{user?.subscriptionTier ?? "FREE"} tier</p>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const delayClass = ["reveal-delay-1", "reveal-delay-2", "reveal-delay-3", "reveal-delay-4", "reveal-delay-5"][index] ?? "";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "reveal-up flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    delayClass,
                    pathname === item.href
                      ? "bg-accent/15 text-accent"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Button variant="outline" className="reveal-up reveal-delay-4 mt-6 w-full justify-center gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </aside>

        <main className="min-w-0 space-y-6">
          <header className="reveal-up reveal-delay-1 panel flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">FixCapital control center</p>
              <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{subtitle}</p>
            </div>
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning lg:max-w-sm">
              Past performance is not indicative of future results. Copy trading and automation can amplify losses.
            </div>
          </header>
          {liveNotice ? (
            <div className="pulse-soft reveal-up rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent">
              Live notice: {liveNotice}
            </div>
          ) : null}
          {children}
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}