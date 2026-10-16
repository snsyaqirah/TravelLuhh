import { cn } from "@/lib/utils";

// Static sunken block with ruled lines every 24px (override with style --ledger-row). No shimmer, no pulse (§10).
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("ledger-skeleton rounded-sm", className)} {...props} />;
}

export { Skeleton };
