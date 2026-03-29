"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BotFlowCanvas } from "@/components/bot-builder/bot-flow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

type BotTemplate = {
  key: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
};

type BotRecord = {
  id: string;
  name: string;
  templateKey: string | null;
  status: string;
  symbol: string;
};

export default function BotBuilderPage() {
  const router = useRouter();
  const { token, ready } = useAuth();
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!token) {
      router.push("/auth/login");
      return;
    }

    Promise.all([
      apiRequest<{ templates: BotTemplate[] }>("/api/v1/bots/templates"),
      apiRequest<{ bots: BotRecord[] }>("/api/v1/bots", { token })
    ]).then(([templatesResponse, botsResponse]) => {
      setTemplates(templatesResponse.templates);
      setBots(botsResponse.bots);
    });
  }, [token, ready, router]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const templateKey = String(form.get("templateKey") ?? "rsi-crossover");
    const template = templates.find((item) => item.key === templateKey);

    await apiRequest<{ bot: BotRecord }>("/api/v1/bots", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: String(form.get("name") ?? "Momentum Bot"),
        templateKey,
        symbol: String(form.get("symbol") ?? "R_100"),
        riskPerTradePct: Number(form.get("riskPerTradePct") ?? 1.5),
        config: template?.config ?? {}
      })
    });

    setMessage("Bot config saved. Start it after validating your logic on demo capital.");
    const refreshed = await apiRequest<{ bots: BotRecord[] }>("/api/v1/bots", { token });
    setBots(refreshed.bots);
  }

  async function startBot(botId: string) {
    if (!token) {
      return;
    }

    await apiRequest(`/api/v1/bots/${botId}/status`, {
      method: "POST",
      token,
      body: JSON.stringify({ status: "RUNNING" })
    });

    const refreshed = await apiRequest<{ bots: BotRecord[] }>("/api/v1/bots", { token });
    setBots(refreshed.bots);
  }

  if (!ready || !token) {
    return null;
  }

  return (
    <DashboardShell
      title="No-Code Bot Builder"
      subtitle="Compose logic visually, persist templates, and hand execution to backend workers with Deriv-safe rate controls."
    >
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <BotFlowCanvas />
        <Card>
          <h2 className="text-xl font-semibold text-white">Create a bot config</h2>
          <p className="mt-2 text-sm text-slate-300">Templates are preloaded for demo-first workflows. Treat them as educational examples, not guaranteed strategies.</p>
          <form className="mt-6 grid gap-4" onSubmit={onSave}>
            <Input name="name" placeholder="Bot name" required />
            <Input name="symbol" placeholder="Symbol" defaultValue="R_100" required />
            <Input name="riskPerTradePct" type="number" step="0.1" defaultValue={1.5} required />
            <select name="templateKey" className="w-full rounded-2xl border border-border bg-slate-950/50 px-4 py-3 text-sm text-white">
              {templates.map((template) => (
                <option key={template.key} value={template.key}>{template.name}</option>
              ))}
            </select>
            {message ? <p className="text-sm text-accent">{message}</p> : null}
            <Button className="w-full sm:w-auto" type="submit">Save bot</Button>
          </form>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.key} className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Template</p>
            <h3 className="text-xl font-semibold text-white">{template.name}</h3>
            <p className="text-sm text-slate-300">{template.description}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold text-white">Saved bot configs</h2>
          <div className="mt-4 space-y-3">
            {bots.map((bot) => (
              <div key={bot.id} className="panel-muted flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">{bot.name}</p>
                  <p className="text-slate-400">{bot.symbol} • {bot.status}</p>
                </div>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => startBot(bot.id)}>
                  Start worker
                </Button>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Runtime notes</h2>
          <div className="panel-muted p-4 text-sm text-slate-300">Bots run through BullMQ so execution can be scaled horizontally without blocking the API server.</div>
          <div className="panel-muted p-4 text-sm text-slate-300">Use demo accounts first. Martingale-style templates can escalate losses quickly if left unchecked.</div>
          <div className="panel-muted p-4 text-sm text-slate-300">Circuit breakers should pause strategy execution if Deriv requests fail repeatedly or exceed the allowed rate window.</div>
        </Card>
      </section>
    </DashboardShell>
  );
}