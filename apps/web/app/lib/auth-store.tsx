"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api";

type User = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "MASTER" | "ADMIN";
  subscriptionTier: "FREE" | "PRO" | "VIP";
  kycStatus: "PENDING" | "REVIEW" | "APPROVED" | "REJECTED";
};

type AuthContextValue = {
  token: string | null;
  user: User | null;
  ready: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    wantsToBeMaster?: boolean;
  }) => Promise<void>;
  setSession: (session: { token: string; user: User }) => void;
  logout: () => void;
};

const STORAGE_KEY = "astrotrade.session";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { token: string; user: User };
        setToken(parsed.token);
        setUser(parsed.user);
      } catch (error) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
  }, []);

  const persist = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: nextToken, user: nextUser })
    );
  };

  const login = async (input: { email: string; password: string }) => {
    const response = await apiRequest<{ token: string; user: User }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });

    persist(response.token, response.user);
  };

  const register = async (input: {
    email: string;
    password: string;
    name: string;
    wantsToBeMaster?: boolean;
  }) => {
    const response = await apiRequest<{ token: string; user: User }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });

    persist(response.token, response.user);
  };

  const setSession = (session: { token: string; user: User }) => {
    persist(session.token, session.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ token, user, ready, login, register, setSession, logout }),
    [token, user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AppProviders");
  }

  return context;
}
