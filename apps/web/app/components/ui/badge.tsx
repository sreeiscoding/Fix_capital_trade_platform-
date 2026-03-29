import { cn } from "@/lib/utils";

export function Badge({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-border px-3 py-1 font-secondary text-xs tracking-[0.04em]",
        className
      )}
    >
      {children}
    </span>
  );
}
