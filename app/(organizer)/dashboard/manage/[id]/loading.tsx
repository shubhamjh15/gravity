import { Shimmer } from "@/components/gravity/skeletons";

export default function ManageLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <Shimmer className="h-4 w-32" />
      <Shimmer className="mt-4 h-9 w-1/2" />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Shimmer className="h-56" />
        <Shimmer className="h-56" />
      </div>
      <Shimmer className="mt-6 h-72 w-full" />
    </div>
  );
}
