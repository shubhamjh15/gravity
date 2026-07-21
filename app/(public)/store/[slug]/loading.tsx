import { Shimmer } from "@/components/gravity/skeletons";

export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <Shimmer className="aspect-square w-full" />
        <div className="space-y-4">
          <Shimmer className="h-10 w-3/4" />
          <Shimmer className="h-8 w-32" />
          <Shimmer className="h-24 w-full" />
          <Shimmer className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
