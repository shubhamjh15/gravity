import { Shimmer } from "@/components/gravity/skeletons";

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-2">
        <Shimmer className="h-8 w-40" />
        <Shimmer className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-24" />
        ))}
      </div>
      <Shimmer className="h-40 w-full" />
    </div>
  );
}
