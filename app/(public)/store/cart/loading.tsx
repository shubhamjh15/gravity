import { HeaderSkeleton, Shimmer } from "@/components/gravity/skeletons";

export default function CartLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <HeaderSkeleton />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Shimmer key={i} className="h-28 w-full" />
          ))}
        </div>
        <Shimmer className="h-64 w-full" />
      </div>
    </div>
  );
}
