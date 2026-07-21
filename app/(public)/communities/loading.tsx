import { HeaderSkeleton, CardGridSkeleton } from "@/components/gravity/skeletons";

export default function CommunitiesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <HeaderSkeleton />
      <div className="mt-8">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  );
}
