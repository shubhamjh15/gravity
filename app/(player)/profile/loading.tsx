import { Shimmer } from "@/components/gravity/skeletons";

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      <Shimmer className="h-48 w-full sm:h-64" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-16" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Shimmer className="order-2 h-96 lg:order-1" />
        <Shimmer className="order-1 h-64 lg:order-2" />
      </div>
    </div>
  );
}
