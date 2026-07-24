import { HeaderSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function SponsorsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <HeaderSkeleton />
      </div>
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer key={i} className="h-36" />
        ))}
      </div>
    </div>
  );
}
