import { Card } from "../ui/card";
import { formatCurrency } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <Card className="panel-hover reveal-up space-y-3">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="text-3xl font-semibold text-white">
        {typeof value === "number" ? formatCurrency(value) : value}
      </p>
      <p className="text-sm text-slate-400">{hint}</p>
    </Card>
  );
}