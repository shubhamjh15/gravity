import { HeaderSkeleton, RowsSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function LeaderboardLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <HeaderSkeleton />
      </div>
      <div className="mt-8 flex justify-center gap-2">
        <Shimmer className="h-10 w-28" />
        <Shimmer className="h-10 w-24" />
        <Shimmer className="h-10 w-24" />
      </div>
      <div className="mt-10">
        <RowsSkeleton count={10} />
      </div>
    </div>
  );
}
