import { HeaderSkeleton, CardGridSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function EventsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <HeaderSkeleton />
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Shimmer className="h-10 flex-1" />
        <Shimmer className="h-10 w-44" />
        <Shimmer className="h-10 w-48" />
      </div>
      <div className="mt-8">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  );
}
