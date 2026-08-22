"use client";

/**
 * Toggle a community's `is_featured` flag.
 *
 * Distinct from featured_placements: that table curates hype/deal SLOTS on the
 * landing page, whereas this flag is what pins a community to the top of the
 * communities list and gives its card a "Featured" badge. The storefront
 * already honoured the flag and sorted by it — but no screen could set it, so
 * it was permanently false.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, StarOff } from "lucide-react";
import { toggleFeatured } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FeaturableCommunity = {
  id: string;
  name: string;
  is_featured: boolean;
};

export function CommunityFeatureToggles({
  communities: initial,
}: {
  communities: FeaturableCommunity[];
}) {
  const router = useRouter();
  const [communities, setCommunities] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(c: FeaturableCommunity) {
    startTransition(async () => {
      const res = await toggleFeatured({
        community_id: c.id,
        featured: !c.is_featured,
      });
      if (res.success) {
        setCommunities((list) =>
          list.map((x) =>
            x.id === c.id ? { ...x, is_featured: !x.is_featured } : x,
          ),
        );
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-[image:var(--gv-grad-surface)] p-5">
      <div className="flex items-center gap-2">
        <Star className="size-4 text-crimson-400" />
        <h2 className="font-display text-lg tracking-tight">
          Featured communities
        </h2>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Pins a community to the top of the communities list and badges its card.
      </p>

      {communities.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">No communities yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {communities.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2",
                c.is_featured
                  ? "border-crimson-700/40 bg-crimson-500/5"
                  : "border-line/70 bg-void/40",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
              <Button
                size="xs"
                variant={c.is_featured ? "outline" : "ghost"}
                disabled={pending}
                onClick={() => toggle(c)}
              >
                {c.is_featured ? (
                  <>
                    <StarOff className="size-3" />
                    Unfeature
                  </>
                ) : (
                  <>
                    <Star className="size-3" />
                    Feature
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
