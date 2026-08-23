"use client";

/**
 * Product image manager (ROADMAP 5.2).
 *
 * Files upload straight from the browser to the public `store-images` bucket,
 * then a server action records the row. The bytes deliberately do NOT pass
 * through the server action: those have a request-body limit, and a multi-MB
 * photo would be a slow, failure-prone round trip.
 *
 * Storage RLS requires the object path to start with the uploader's own id
 * ("<uid>/<file>"). Get that wrong and the upload is rejected outright.
 *
 * The lowest sort_order is the primary image — it is what the storefront card
 * renders.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { ImagePlus, Trash2, Star, Loader2 } from "lucide-react";
import {
  addProductImage,
  removeProductImage,
  setProductImageOrder,
} from "@/app/(admin)/admin/store/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProductImage = {
  id: string;
  image_path: string;
  sort_order: number;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function publicUrl(path: string): string {
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/store-images/${path}`;
}

export function ProductImages({
  productId,
  images: initial,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const [images, setImages] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onFiles(files: FileList) {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Your session expired — sign in again.");
      return;
    }

    setUploading(true);
    let added = 0;

    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: use JPEG, PNG, WebP or AVIF.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is over 5MB.`);
        continue;
      }

      // Storage RLS matches on the first path segment being the uploader's id.
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${Date.now()}_${safe}`;

      const { error: upErr } = await supabase.storage
        .from("store-images")
        .upload(path, file, { upsert: false, cacheControl: "3600" });

      if (upErr) {
        toast.error(`Upload failed for ${file.name}: ${upErr.message}`);
        continue;
      }

      const res = await addProductImage({
        product_id: productId,
        image_path: path,
      });

      if (res.success) {
        added += 1;
      } else {
        // The object landed but the row didn't — clean up rather than leave a
        // file nothing references.
        await supabase.storage.from("store-images").remove([path]);
        toast.error(res.message);
      }
    }

    setUploading(false);
    if (added > 0) {
      toast.success(added === 1 ? "Image added." : `${added} images added.`);
      router.refresh();
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeProductImage({ image_id: id });
      if (res.success) {
        setImages((list) => list.filter((i) => i.id !== id));
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function makePrimary(id: string) {
    startTransition(async () => {
      const res = await setProductImageOrder({ image_id: id, sort_order: 0 });
      if (res.success) {
        setImages((list) =>
          list
            .map((i) => (i.id === id ? { ...i, sort_order: -1 } : i))
            .sort((a, b) => a.sort_order - b.sort_order),
        );
        toast.success("Primary image set.");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="mt-4 border-t border-line/60 pt-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
          Images ({images.length})
        </p>
        <label className="cursor-pointer">
          <input
            type="file"
            accept={ACCEPTED.join(",")}
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files?.length) void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-foreground">
            {uploading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ImagePlus className="size-3" />
            )}
            {uploading ? "Uploading…" : "Upload images"}
          </span>
        </label>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">
          No images yet — the storefront card shows an empty tile until you add
          one.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {sorted.map((img, idx) => (
            <li key={img.id} className="group/img relative">
              <div
                className={cn(
                  "relative size-20 overflow-hidden rounded-lg border bg-surface-2",
                  idx === 0 ? "border-crimson-600" : "border-line",
                )}
              >
                <Image
                  src={publicUrl(img.image_path)}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </div>

              {idx === 0 ? (
                <span className="absolute -top-1.5 -left-1.5 rounded-full bg-crimson-600 px-1.5 py-0.5 text-[9px] font-medium text-white">
                  Main
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 opacity-0 transition-opacity group-hover/img:opacity-100">
                {idx !== 0 ? (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    disabled={pending}
                    aria-label="Make primary image"
                    title="Make primary"
                    onClick={() => makePrimary(img.id)}
                    className="bg-void/80"
                  >
                    <Star />
                  </Button>
                ) : null}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={pending}
                  aria-label="Remove image"
                  onClick={() => remove(img.id)}
                  className="bg-void/80 hover:text-danger"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
