"use client";

/**
 * Verified-purchase review form.
 *
 * addReview has existed since the store phase and nothing ever called it — the
 * whole review feature was unreachable.
 *
 * Eligibility is enforced by RLS: the insert policy requires a DELIVERED order
 * containing this product, for this user. So this form is only rendered when
 * the server has already established the buyer qualifies — and if RLS refuses
 * anyway, the action reports it rather than pretending the review saved.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { addReview } from "@/app/(public)/store/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ReviewForm({
  productId,
  existingRating,
  existingBody,
}: {
  productId: string;
  existingRating?: number;
  existingBody?: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existingRating ?? 0);
  const [hover, setHover] = useState(0);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    if (rating < 1) {
      toast.error("Pick a rating first.");
      return;
    }
    startTransition(async () => {
      const res = await addReview({
        product_id: productId,
        rating,
        body: String(formData.get("body") ?? "") || undefined,
      });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const shown = hover || rating;

  return (
    <form action={onSubmit} className="rounded-xl border border-line bg-surface/40 p-5">
      <h3 className="font-display text-lg">
        {existingRating ? "Update your review" : "Write a review"}
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Only buyers with a delivered order can review — that&apos;s enforced by
        the database, not just hidden in the UI.
      </p>

      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="review-body">Your rating</Label>
        <div
          className="flex gap-1"
          role="radiogroup"
          aria-label="Rating out of five"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Star
                className={cn(
                  "size-6 transition-colors",
                  n <= shown
                    ? "fill-crimson-500 text-crimson-500"
                    : "text-text-dim",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="review-body">Your review</Label>
        <Textarea
          id="review-body"
          name="body"
          rows={4}
          maxLength={2000}
          defaultValue={existingBody ?? ""}
          placeholder="How is the quality? Did it fit? Would you buy again?"
        />
      </div>

      <Button type="submit" variant="gradient" className="mt-4" disabled={pending}>
        {pending ? "Saving…" : existingRating ? "Update review" : "Post review"}
      </Button>
    </form>
  );
}
