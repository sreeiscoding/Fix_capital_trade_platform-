"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function EquityChart({ data }: { data: Array<{ label: string; equity: number }> }) {
  return (
    <div className="panel h-[280px] p-4 sm:h-[320px] sm:p-6">
      <div className="mb-4 sm:mb-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Equity curve</p>
        <h3 className="mt-2 text-lg font-semibold text-white sm:text-xl">Live balance and copied P&L trajectory</h3>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#57d4a8" stopOpacity={0.55} />
              <stop offset="95%" stopColor="#57d4a8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" stroke="#6c768d" tickMargin={8} />
          <YAxis stroke="#6c768d" width={44} />
          <Tooltip contentStyle={{ background: "#0f1724", border: "1px solid rgba(255,255,255,0.08)" }} />
          <Area type="monotone" dataKey="equity" stroke="#57d4a8" strokeWidth={2} fill="url(#equityFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}