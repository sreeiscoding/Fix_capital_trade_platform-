"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MasterTable } from "@/components/copy-trading/master-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

type Master = {
  userId: string;
  displayName: string;
  score: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  monthlyReturn: number;
  followers: number;
  primaryAccountId: string | null;
  primaryAccountLoginId: string | null;
};

type DerivAccount = {
  id: string;
  loginId: string;
  environment: string;
  currency: string | null;
};

type PendingAction = "link-demo" | "link-real" | "subscribe" | "signal" | null;

type SubscriptionPayload = {
  masterId: string;
  masterAccountId: string;
  copierAccountId: string;
  allocationPct: number;
  lotMultiplier: number;
  maxDrawdownPct: number;
  maxOpenPositions: number;
  stopLossPct?: number;
};

type NumberFieldOptions = {
  min: number;
  max: number;
  integer?: boolean;
};

function validateNumberField(
  rawValue: string,
  fieldName: string,
  options: NumberFieldOptions
) {
  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  if (options.integer && !Number.isInteger(parsedValue)) {
    throw new Error(`${fieldName} must be a whole number.`);
  }

  if (parsedValue < options.min || parsedValue > options.max) {
    throw new Error(`${fieldName} must be between ${options.min} and ${options.max}.`);
  }

  return parsedValue;
}

function parseRequiredNumberField(
  form: FormData,
  fieldName: string,
  options: NumberFieldOptions & { fallback?: number }
) {
  const rawValue = String(form.get(fieldName) ?? "").trim();

  if (!rawValue) {
    if (options.fallback !== undefined) {
      return options.fallback;
    }

    throw new Error(`${fieldName} is required.`);
  }

  return validateNumberField(rawValue, fieldName, options);
}

function parseOptionalNumberField(
  form: FormData,
  fieldName: string,
  options: NumberFieldOptions
) {
  const rawValue = String(form.get(fieldName) ?? "").trim();

  if (!rawValue) {
    return undefined;
  }

  return validateNumberField(rawValue, fieldName, options);
}

function buildSubscriptionPayload(input: {
  form: FormData;
  selectedMaster: Master | null;
  selectedCopierAccountId: string;
}) {
  const { form, selectedMaster, selectedCopierAccountId } = input;

  if (!selectedMaster) {
    throw new Error("Select a master trader before creating a copy relationship.");
  }

  const { userId: masterId, primaryAccountId } = selectedMaster;

  if (!primaryAccountId) {
    throw new Error("Selected master does not have a linked primary Deriv account yet.");
  }

  if (!selectedCopierAccountId) {
    throw new Error("Link a Deriv account before creating a copy relationship.");
  }

  const allocationPct = parseRequiredNumberField(form, "allocationPct", {
    min: 1,
    max: 100,
    fallback: 10
  });
  const lotMultiplier = parseRequiredNumberField(form, "lotMultiplier", {
    min: 0.1,
    max: 10,
    fallback: 1
  });
  const maxDrawdownPct = parseRequiredNumberField(form, "maxDrawdownPct", {
    min: 1,
    max: 100,
    fallback: 15
  });
  const maxOpenPositions = parseRequiredNumberField(form, "maxOpenPositions", {
    min: 1,
    max: 20,
    fallback: 3,
    integer: true
  });
  const stopLossPct = parseOptionalNumberField(form, "stopLossPct", {
    min: 1,
    max: 100
  });

  const payload: SubscriptionPayload = {
    masterId,
    masterAccountId: primaryAccountId,
    copierAccountId: selectedCopierAccountId,
    allocationPct,
    lotMultiplier,
    maxDrawdownPct,
    maxOpenPositions
  };

  if (stopLossPct !== undefined) {
    payload.stopLossPct = stopLossPct;
  }

  return payload;
}

export default function CopyTradingPage() {
  const router = useRouter();
  const { token, ready, user } = useAuth();
  const [masters, setMasters] = useState<Master[]>([]);
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [selectedCopierAccountId, setSelectedCopierAccountId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    let isActive = true;

    async function loadCopyTradingData() {
      setInitialLoading(true);
      setMessage(null);
      setError(null);

      try {
        const [mastersResponse, accountsResponse] = await Promise.all([
          apiRequest<{ masters: Master[] }>("/api/v1/copy-trading/masters"),
          apiRequest<{ accounts: DerivAccount[] }>("/api/v1/deriv/accounts", { token })
        ]);

        if (!isActive) {
          return;
        }

        const nextMasters = mastersResponse.masters;
        const nextAccounts = accountsResponse.accounts;

        setMasters(nextMasters);
        setAccounts(nextAccounts);
        setSelectedMasterId((current) => {
          if (current && nextMasters.some((master) => master.userId === current)) {
            return current;
          }
          return nextMasters[0]?.userId ?? "";
        });
        setSelectedCopierAccountId((current) => {
          if (current && nextAccounts.some((account) => account.id === current)) {
            return current;
          }
          return nextAccounts[0]?.id ?? "";
        });
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load copy trading data"
        );
      } finally {
        if (isActive) {
          setInitialLoading(false);
        }
      }
    }

    void loadCopyTradingData();

    return () => {
      isActive = false;
    };
  }, [ready, token, router]);

  const selectedMaster = useMemo(
    () => masters.find((master) => master.userId === selectedMasterId) ?? null,
    [masters, selectedMasterId]
  );

  const canSubscribe = Boolean(
    selectedMaster?.primaryAccountId && selectedCopierAccountId && accounts.length > 0
  );
  const canPublishMasterSignal = Boolean(
    user && user.role === "MASTER" && selectedMaster && selectedMaster.userId === user.id
  );

  async function linkDerivAccount(environment: "demo" | "real") {
    if (!token) {
      return;
    }

    setPendingAction(environment === "demo" ? "link-demo" : "link-real");
    setMessage(null);
    setError(null);

    try {
      const response = await apiRequest<{ url: string }>("/api/v1/deriv/oauth/start", {
        method: "POST",
        token,
        body: JSON.stringify({ environment })
      });

      window.location.assign(response.url);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Unable to start Deriv OAuth");
      setPendingAction(null);
    }
  }

  async function onSubscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setPendingAction("subscribe");
    setError(null);
    setMessage(null);

    try {
      const form = new FormData(event.currentTarget);
      const payload = buildSubscriptionPayload({
        form,
        selectedMaster,
        selectedCopierAccountId
      });

      await apiRequest("/api/v1/copy-trading/subscribe", {
        method: "POST",
        token,
        body: JSON.stringify(payload)
      });

      setMessage("Copy relationship saved. Review risk settings before live deployment.");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to subscribe");
    } finally {
      setPendingAction(null);
    }
  }

  async function publishManualSignal() {
    if (!token) {
      return;
    }

    setPendingAction("signal");
    setMessage(null);
    setError(null);

    try {
      await apiRequest("/api/v1/copy-trading/signals/manual", {
        method: "POST",
        token,
        body: JSON.stringify({
          symbol: "R_100",
          contractType: "CALL",
          duration: 5,
          durationUnit: "m",
          amount: 10,
          basis: "stake"
        })
      });

      setMessage("Manual master signal published to the copy queue.");
    } catch (signalError) {
      setError(signalError instanceof Error ? signalError.message : "Unable to publish test signal");
    } finally {
      setPendingAction(null);
    }
  }

  if (!ready || !token) {
    return null;
  }

  return (
    <DashboardShell
      title="Copy Trading Desk"
      subtitle="Subscribe to verified masters with allocation controls, drawdown caps, and audit-ready replication logs."
    >
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <MasterTable masters={masters} />
        <Card className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Deriv connectivity</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Link your broker account</h2>
            <p className="mt-2 text-sm text-slate-300">
              FixCapital never holds your funds. OAuth only grants the scoped permissions needed to automate on your own Deriv account.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => linkDerivAccount("demo")}
              disabled={pendingAction !== null}
            >
              {pendingAction === "link-demo" ? "Opening demo OAuth..." : "Link Deriv demo"}
            </Button>
            <Button
              variant="outline"
              onClick={() => linkDerivAccount("real")}
              disabled={pendingAction !== null}
            >
              {pendingAction === "link-real" ? "Opening real OAuth..." : "Link Deriv real"}
            </Button>
          </div>
          <div className="space-y-3">
            {accounts.length > 0 ? (
              accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  aria-pressed={selectedCopierAccountId === account.id}
                  onClick={() => {
                    setSelectedCopierAccountId(account.id);
                    setMessage(null);
                    setError(null);
                  }}
                  className={`panel-muted flex w-full items-center justify-between p-4 text-left text-sm text-slate-200 transition ${
                    selectedCopierAccountId === account.id ? "border-accent/30 bg-accent/10" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">{account.loginId}</p>
                    <p className="text-xs text-slate-400">
                      {account.environment} • {account.currency ?? "USD"}
                    </p>
                  </div>
                  <span className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs text-accent">
                    {selectedCopierAccountId === account.id ? "Selected" : "Linked"}
                  </span>
                </button>
              ))
            ) : (
              <div className="panel-muted p-4 text-sm text-slate-300">
                No Deriv account linked yet. Connect a demo account first so FixCapital has a destination for copied trades.
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <h2 className="text-xl font-semibold text-white">Set follower risk controls</h2>
          <p className="mt-2 text-sm text-slate-300">
            Define maximum allocation, lot scaling, and portfolio-level brakes before mirroring live trades.
          </p>
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubscribe}>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-300">Master trader</label>
              <select
                name="masterId"
                value={selectedMasterId}
                onChange={(event) => {
                  setSelectedMasterId(event.target.value);
                  setMessage(null);
                  setError(null);
                }}
                disabled={masters.length === 0 || initialLoading || pendingAction !== null}
                className="w-full rounded-2xl border border-border bg-slate-950/50 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {masters.length === 0 ? (
                  <option value="">No masters available</option>
                ) : (
                  masters.map((master) => (
                    <option key={master.userId} value={master.userId}>
                      {master.displayName}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="md:col-span-2 rounded-2xl border border-border bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
              Primary master account: {selectedMaster?.primaryAccountLoginId ?? "Not linked yet"}
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-300">Your copier account</label>
              <select
                name="copierAccountId"
                value={selectedCopierAccountId}
                onChange={(event) => {
                  setSelectedCopierAccountId(event.target.value);
                  setMessage(null);
                  setError(null);
                }}
                disabled={accounts.length === 0 || initialLoading || pendingAction !== null}
                className="w-full rounded-2xl border border-border bg-slate-950/50 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accounts.length === 0 ? (
                  <option value="">No linked account available</option>
                ) : (
                  accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.loginId}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <Input name="allocationPct" placeholder="Allocation %" type="number" defaultValue={10} min={1} max={100} />
            </div>
            <div>
              <Input name="lotMultiplier" placeholder="Lot multiplier" type="number" defaultValue={1} step="0.1" min={0.1} max={10} />
            </div>
            <div>
              <Input name="maxDrawdownPct" placeholder="Max drawdown %" type="number" defaultValue={15} min={1} max={100} />
            </div>
            <div>
              <Input name="maxOpenPositions" placeholder="Max open positions" type="number" defaultValue={3} min={1} max={20} />
            </div>
            <div className="md:col-span-2">
              <Input name="stopLossPct" placeholder="Portfolio stop-loss %" type="number" defaultValue={5} min={1} max={100} />
            </div>
            {initialLoading ? (
              <p className="md:col-span-2 text-sm text-slate-400">Loading copy trading data...</p>
            ) : null}
            {message ? <p className="md:col-span-2 text-sm text-accent">{message}</p> : null}
            {error ? <p className="md:col-span-2 text-sm text-red-400">{error}</p> : null}
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <Button disabled={pendingAction !== null || initialLoading || !canSubscribe} type="submit">
                {pendingAction === "subscribe" ? "Saving..." : "Save copy settings"}
              </Button>
              {canPublishMasterSignal ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={publishManualSignal}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "signal"
                    ? "Publishing test signal..."
                    : "Publish test signal for your master account"}
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Operator notes</h2>
          <div className="grid gap-3 text-sm text-slate-300">
            <div className="panel-muted p-4">
              Queue-backed replication helps smooth rate limits when many copiers mirror the same trade.
            </div>
            <div className="panel-muted p-4">
              If account equity or margin is insufficient, FixCapital skips replication and logs the reason.
            </div>
            <div className="panel-muted p-4">
              Performance fees should only be charged on realized net copier profits and after user consent.
            </div>
          </div>
        </Card>
      </section>
    </DashboardShell>
  );
}
