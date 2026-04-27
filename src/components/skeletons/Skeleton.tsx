export function SkeletonBar({
  w = "w-full",
  h = "h-4",
  className = "",
}: {
  w?: string;
  h?: string;
  className?: string;
}) {
  return (
    <div
      className={`${w} ${h} rounded bg-sunken animate-pulse ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonCard({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface border border-line rounded-md p-4 space-y-3 ${className}`}
      aria-hidden
    >
      <SkeletonBar w="w-1/3" h="h-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBar key={i} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3 px-4 h-11 border-b border-line last:border-b-0"
      aria-hidden
    >
      <div className="w-2 h-2 rounded-full bg-sunken animate-pulse shrink-0" />
      <SkeletonBar w="w-10" h="h-3" />
      <SkeletonBar w="w-32" h="h-3" />
      <SkeletonBar w="w-48" h="h-3" />
      <div className="ml-auto flex gap-2">
        <SkeletonBar w="w-10" h="h-4" />
      </div>
    </div>
  );
}
