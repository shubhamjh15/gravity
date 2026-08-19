import { HeaderSkeleton, RowsSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function WalletLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <HeaderSkeleton />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="mt-12">
        <Shimmer className="mb-4 h-3 w-28" />
        <RowsSkeleton count={6} />
      </div>
    </div>
  );
}
