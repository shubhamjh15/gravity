import { HeaderSkeleton, RowsSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <HeaderSkeleton />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-16" />
        ))}
      </div>
      <div className="mt-12">
        <RowsSkeleton count={5} />
      </div>
    </div>
  );
}
