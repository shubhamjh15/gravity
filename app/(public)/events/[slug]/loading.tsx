import { Shimmer } from "@/components/gravity/skeletons";

export default function EventDetailLoading() {
  return (
    <div className="pb-24">
      <Shimmer className="h-64 w-full rounded-none sm:h-80 lg:h-96" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="order-2 space-y-6 lg:order-1">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Shimmer key={i} className="h-20" />
              ))}
            </div>
            <Shimmer className="h-40 w-full" />
            <Shimmer className="h-32 w-full" />
          </div>
          <aside className="order-1 lg:order-2">
            <Shimmer className="h-48 w-full lg:-mt-24" />
          </aside>
        </div>
      </div>
    </div>
  );
}
