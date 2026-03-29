import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl border border-border bg-slate-950/50 px-4 py-3 text-sm text-foreground outline-none ring-0 transition placeholder:text-slate-500 focus:border-accent",
        className
      )}
      {...props}
    />
  );
}
