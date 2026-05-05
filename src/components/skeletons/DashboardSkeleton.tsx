import { SkeletonBar, SkeletonRow } from "./Skeleton";

export function DashboardSkeleton() {
  return (
    <div
      className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading dashboard…</span>
      <div className="bg-surface border border-line rounded-md p-4">
        <SkeletonBar w="w-2/3" />
      </div>
      <div className="space-y-2">
        <SkeletonBar w="w-56" h="h-5" />
        <SkeletonBar w="w-72" h="h-3" />
      </div>
      <section className="bg-surface border border-line rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <SkeletonBar w="w-32" h="h-3" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </section>
    </div>
  );
}

export function PageSkeleton({ title = "Loading…" }: { title?: string }) {
  return (
    <div
      className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{title}</span>
      <SkeletonBar w="w-40" h="h-5" />
      <div className="bg-surface border border-line rounded-md overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
