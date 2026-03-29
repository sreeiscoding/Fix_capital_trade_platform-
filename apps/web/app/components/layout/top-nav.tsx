"use client";

import type { Route } from "next";
import { ArrowRight, CandlestickChart, LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { useAuth } from "@/lib/auth-store";

export function TopNav() {
  const router = useRouter();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleNavigate = (href: Route) => {
    closeMobileMenu();
    router.push(href);
  };

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (mobileMenuRef.current?.contains(target)) {
        return;
      }

      closeMobileMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="reveal-fade sticky top-0 z-30 border-b border-white/5 bg-slate-950/70 backdrop-blur md:overflow-visible">
      <div className="mx-auto max-w-7xl px-5 py-4 sm:px-6 lg:px-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3 text-lg font-semibold tracking-wide text-white sm:text-xl" onClick={closeMobileMenu}>
            <span className="rounded-2xl bg-accent/10 p-2 text-accent">
              <CandlestickChart className="h-5 w-5" />
            </span>
            <span className="truncate">FixCapital</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link href="/markets">Markets</Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <Button onClick={() => router.push("/dashboard")}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Open Dashboard
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => router.push("/auth/login")}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </Button>
                <Button onClick={() => router.push("/auth/login")}>
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-card/70 text-white transition hover:border-accent/30 hover:text-accent md:hidden"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="absolute inset-x-0 top-full z-40 md:hidden">
          <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-[1px]" aria-hidden="true" />
          <div ref={mobileMenuRef} className="reveal-fade is-visible mx-auto mt-3 max-w-7xl px-4 sm:px-6">
            <div className="rounded-3xl border border-border/70 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
              <nav className="flex flex-col gap-2 text-sm text-slate-200">
                <a className="rounded-2xl px-4 py-3 transition hover:bg-white/5" href="#features" onClick={closeMobileMenu}>
                  Features
                </a>
                <a className="rounded-2xl px-4 py-3 transition hover:bg-white/5" href="#pricing" onClick={closeMobileMenu}>
                  Pricing
                </a>
                <Link className="rounded-2xl px-4 py-3 transition hover:bg-white/5" href="/markets" onClick={closeMobileMenu}>
                  Markets
                </Link>
              </nav>

              <div className="mt-4 flex flex-col gap-2">
                {user ? (
                  <Button className="w-full" onClick={() => handleNavigate("/dashboard")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Open Dashboard
                  </Button>
                ) : (
                  <>
                    <Button className="w-full" variant="outline" onClick={() => handleNavigate("/auth/login")}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in
                    </Button>
                    <Button className="w-full" onClick={() => handleNavigate("/auth/login")}>
                      Start free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
