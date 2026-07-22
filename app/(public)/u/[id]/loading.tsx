import { Shimmer } from "@/components/gravity/skeletons";

export default function PublicProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-20 pb-24 sm:px-6 lg:px-8">
      <Shimmer className="h-56 w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
