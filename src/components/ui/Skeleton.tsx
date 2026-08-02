import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("lv-skeleton rounded-md", className)} />;
}

export function KpiSkeleton() {
  return (
    <div className="rounded-[10px] border border-[var(--lv-border)] bg-card p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}
