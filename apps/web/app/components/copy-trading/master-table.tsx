import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { formatPercent } from "@/lib/utils";

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

export function MasterTable({ masters }: { masters: Master[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border/60 px-4 py-4 sm:px-6">
        <h3 className="text-lg font-semibold text-white">Verified master traders</h3>
        <p className="mt-1 text-sm text-slate-400">Ranked by monthly return, profit factor, and risk-adjusted consistency.</p>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {masters.map((master) => (
          <div key={master.userId} className="panel-muted space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{master.displayName}</p>
                <p className="text-xs text-slate-400">Monthly return {formatPercent(master.monthlyReturn / 100)}</p>
              </div>
              <Badge className="shrink-0 border-accent/30 bg-accent/10 text-accent">Verified</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Win rate</p>
                <p>{formatPercent(master.winRate)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Profit factor</p>
                <p>{master.profitFactor.toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Max DD</p>
                <p>{master.maxDrawdown.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Primary account</p>
                <p>{master.primaryAccountLoginId ?? "Awaiting link"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[720px] text-left text-sm">
          <thead className="bg-slate-950/40 text-slate-400">
            <tr>
              <th className="px-6 py-3">Master</th>
              <th className="px-6 py-3">Win rate</th>
              <th className="px-6 py-3">Profit factor</th>
              <th className="px-6 py-3">Max DD</th>
              <th className="px-6 py-3">Primary account</th>
            </tr>
          </thead>
          <tbody>
            {masters.map((master) => (
              <tr key={master.userId} className="border-t border-border/40 text-slate-200">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-white">{master.displayName}</p>
                      <p className="text-xs text-slate-400">Monthly return {formatPercent(master.monthlyReturn / 100)}</p>
                    </div>
                    <Badge className="border-accent/30 bg-accent/10 text-accent">Verified</Badge>
                  </div>
                </td>
                <td className="px-6 py-4">{formatPercent(master.winRate)}</td>
                <td className="px-6 py-4">{master.profitFactor.toFixed(2)}x</td>
                <td className="px-6 py-4">{master.maxDrawdown.toFixed(1)}%</td>
                <td className="px-6 py-4">{master.primaryAccountLoginId ?? "Awaiting link"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}