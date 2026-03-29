import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

type Signal = {
  symbol: string;
  timeframe: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  probability: number;
  confidence: number;
  rationale: string;
  indicators: {
    rsi: number;
    movingAverage: number;
    last: number;
  };
};

export function SignalGrid({ signals }: { signals: Signal[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {signals.map((signal) => (
        <Card key={`${signal.symbol}-${signal.timeframe}`} className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{signal.timeframe}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{signal.symbol}</h3>
            </div>
            <Badge
              className={
                signal.direction === "LONG"
                  ? "border-success/30 bg-success/10 text-success"
                  : signal.direction === "SHORT"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border bg-muted text-slate-300"
              }
            >
              {signal.direction}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="panel-muted p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Probability</p>
              <p className="mt-2 text-2xl font-semibold text-white">{(signal.probability * 100).toFixed(0)}%</p>
            </div>
            <div className="panel-muted p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Confidence</p>
              <p className="mt-2 text-2xl font-semibold text-white">{signal.confidence.toFixed(2)}</p>
            </div>
          </div>
          <p className="text-sm text-slate-300">{signal.rationale}</p>
          <div className="grid gap-2 text-sm text-slate-400">
            <p>RSI: {signal.indicators.rsi.toFixed(1)}</p>
            <p>MA: {signal.indicators.movingAverage.toFixed(4)}</p>
            <p>Last: {signal.indicators.last.toFixed(4)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
