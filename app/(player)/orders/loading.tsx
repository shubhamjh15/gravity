import { HeaderSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <HeaderSkeleton />
      <div className="mt-8 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
