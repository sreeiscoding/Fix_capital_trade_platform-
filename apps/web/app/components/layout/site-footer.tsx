"use client";

import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, BrainCircuit, CandlestickChart, Home, TriangleAlert } from "lucide-react";
import Link from "next/link";

const footerLinks: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: Home },
  { href: "/markets", label: "Markets", icon: CandlestickChart },
  { href: "/copy-trading", label: "Copy Trading", icon: ArrowRightLeft },
  { href: "/analytics", label: "AI Analytics", icon: BrainCircuit }
];

export function SiteFooter() {
  return (
    <footer className="reveal-fade mt-10 border-t border-border/60 bg-slate-950/45">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3 text-center lg:text-left">
          <p className="flex items-center justify-center gap-3 text-lg font-semibold tracking-wide text-white lg:justify-start">
            <span className="rounded-2xl bg-accent/10 p-2 text-accent">
              <CandlestickChart className="h-5 w-5" />
            </span>
            FixCapital
          </p>
          <p className="descriptive-copy max-w-2xl text-sm text-slate-400">
            A Deriv-connected trading workspace for copy trading, automation, and market analytics. Your capital remains in your own broker account.
          </p>
          <p className="descriptive-copy flex max-w-2xl items-start justify-center gap-2 text-left text-xs text-warning lg:justify-start">
            <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
            <span>Risk disclosure: past performance is not indicative of future results. Leveraged, synthetic, and automated trading strategies can result in substantial losses.</span>
          </p>
        </div>
        <div className="space-y-4 text-center lg:text-left">
          <nav className="descriptive-copy flex flex-wrap justify-center gap-4 text-sm text-slate-300 lg:justify-start">
            {footerLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Link key={link.href} href={link.href} className="flex items-center gap-2 transition hover:text-white">
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <p className="descriptive-copy text-center text-xs text-slate-500 lg:text-left">
            Copyright 2026 FixCapital. Built for demo-first trading workflows and operator-grade risk controls.
          </p>
        </div>
      </div>
    </footer>
  );
}