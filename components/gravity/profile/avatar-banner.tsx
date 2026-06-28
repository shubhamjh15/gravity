"use client";

/**
 * Avatar + banner header with inline upload to the public `avatars`/`banners`
 * buckets. Uploads client-side (RLS storage policy: owner folder), then calls a
 * server action to persist the path. Live preview, responsive, on-brand.
 */
import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, ImagePlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { saveAvatarBanner } from "@/app/(player)/profile/media-actions";
import { cn } from "@/lib/utils";

function publicUrlFor(bucket: string, path: string | null): string | null {
  if (!path) return null;
  if (!publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function AvatarBanner({
  userId,
  displayName,
  email,
  avatarPath,
  bannerPath,
}: {
  userId: string;
  displayName: string;
  email: string;
  avatarPath: string | null;
  bannerPath: string | null;
}) {
  const [avatar, setAvatar] = useState<string | null>(
    publicUrlFor("avatars", avatarPath),
  );
  const [banner, setBanner] = useState<string | null>(
    publicUrlFor("banners", bannerPath),
  );
  const [pending, startTransition] = useTransition();
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  async function upload(
    bucket: "avatars" | "banners",
    file: File,
  ) {
    if (!isSupabaseConfigured()) {
      toast.error("Uploads need Supabase keys configured.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${bucket}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return;
    }

    const url = publicUrlFor(bucket, path);
    if (bucket === "avatars") setAvatar(url);
    else setBanner(url);

    startTransition(async () => {
      const res = await saveAvatarBanner({
        [bucket === "avatars" ? "avatar_path" : "banner_path"]: path,
      });
      if (res.success) toast.success("Image updated.");
      else toast.error(res.message);
    });
  }

  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="gv-panel overflow-hidden">
      {/* banner */}
      <div className="group relative h-36 w-full overflow-hidden bg-[image:var(--gv-grad-surface)] sm:h-48">
        {banner ? (
          <Image
            src={banner}
            alt="Profile banner"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1024px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 gv-grid-bg opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface/90 to-transparent" />
        <button
          type="button"
          onClick={() => bannerInput.current?.click()}
          disabled={pending}
          className={cn(
            "absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-background/70 px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors hover:border-crimson-500 hover:text-crimson-300",
          )}
        >
          <ImagePlus className="size-3.5" />
          Banner
        </button>
        <input
          ref={bannerInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && upload("banners", e.target.files[0])}
        />
      </div>

      {/* avatar + name */}
      <div className="flex flex-col items-start gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6">
        <div className="group relative -mt-12 sm:-mt-14">
          <div className="size-24 overflow-hidden rounded-2xl border-2 border-background bg-surface-2 shadow-glow sm:size-28">
            {avatar ? (
              <Image
                src={avatar}
                alt={displayName}
                width={112}
                height={112}
                className="size-full object-cover"
                unoptimized
              />
            ) : (
              <div className="grid size-full place-items-center font-display text-3xl text-crimson-300">
                {initials || "GG"}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            disabled={pending}
            className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border border-line bg-background text-crimson-300 transition-colors hover:border-crimson-500"
            aria-label="Change avatar"
          >
            <Camera className="size-4" />
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && upload("avatars", e.target.files[0])}
          />
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <h1 className="truncate font-display text-2xl tracking-tight sm:text-3xl">
            {displayName}
          </h1>
          <p className="truncate text-sm text-text-muted">{email}</p>
        </div>
      </div>
    </div>
  );
}
