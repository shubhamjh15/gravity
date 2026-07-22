import { HeaderSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function MyTournamentsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <HeaderSkeleton />
      <div className="mt-8 flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
