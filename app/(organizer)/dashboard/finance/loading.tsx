import { HeaderSkeleton, RowsSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function FinanceLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <HeaderSkeleton />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="mt-12">
        <Shimmer className="mb-4 h-3 w-24" />
        <RowsSkeleton count={6} />
      </div>
    </div>
  );
}
