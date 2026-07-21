import { Shimmer } from "@/components/gravity/skeletons";

export default function CommunityDetailLoading() {
  return (
    <div className="pb-24">
      <Shimmer className="h-52 w-full rounded-none sm:h-72" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-16 flex flex-col gap-4 sm:flex-row sm:items-end">
          <Shimmer className="size-28 rounded-2xl sm:size-32" />
          <div className="flex-1 space-y-2 pb-2">
            <Shimmer className="h-8 w-1/2" />
            <Shimmer className="h-4 w-2/3" />
          </div>
          <Shimmer className="h-12 w-full sm:w-56" />
        </div>
        <div className="mt-8 space-y-4">
          <Shimmer className="h-10 w-80" />
          <Shimmer className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
