import { cn } from "@/lib/utils";

/**
 * Reusable loading skeletons in the GRAVITY style (shimmer over surface). Used
 * by per-route loading.tsx files so navigation feels instant.
 */
export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-2",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-linear-to-r before:from-transparent before:via-white/5 before:to-transparent",
        className,
      )}
    />
  );
}

/** A card-shaped skeleton matching EventCard / CommunityCard / ProductCard. */
export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <Shimmer className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Shimmer className="h-4 w-3/4" />
        <Shimmer className="h-3 w-1/2" />
        <div className="flex gap-2 pt-2">
          <Shimmer className="h-8 flex-1" />
          <Shimmer className="h-8 flex-1" />
        </div>
      </div>
    </div>
  );
}

/** A grid of card skeletons. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A page header skeleton (eyebrow + big title + lead). */
export function HeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Shimmer className="h-3 w-32" />
      <Shimmer className="h-12 w-2/3" />
      <Shimmer className="h-4 w-1/2" />
    </div>
  );
}

/** A list-row skeleton (leaderboard / tables). */
export function RowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line/50 px-4 py-3.5 last:border-0">
          <Shimmer className="size-9 rounded-full" />
          <Shimmer className="h-4 flex-1" />
          <Shimmer className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
