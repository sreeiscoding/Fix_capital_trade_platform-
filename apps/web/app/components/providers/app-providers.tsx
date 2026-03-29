"use client";

import { AuthProvider } from "@/lib/auth-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
