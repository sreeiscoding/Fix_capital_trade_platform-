"use client";

import { ArrowRight, CandlestickChart, LayoutDashboard, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { useAuth } from "@/lib/auth-store";

export function TopNav() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <header className="reveal-fade sticky top-0 z-20 border-b border-white/5 bg-slate-950/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-wide text-white sm:text-xl">
            <span className="rounded-2xl bg-accent/10 p-2 text-accent">
              <CandlestickChart className="h-5 w-5" />
            </span>
            <span className="truncate">FixCapital</span>
          </Link>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300 md:justify-center md:gap-6">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/markets">Markets</Link>
        </nav>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end md:gap-3">
          {user ? (
            <Button className="w-full sm:w-auto" onClick={() => router.push("/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Open Dashboard
            </Button>
          ) : (
            <>
              <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => router.push("/auth/login")}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign in
              </Button>
              <Button className="flex-1 sm:flex-none" onClick={() => router.push("/auth/login")}>
                Start free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}