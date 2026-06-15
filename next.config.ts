import type { NextConfig } from "next";

/**
 * GRAVITY — Next.js 16 config.
 *
 * Notes for future edits:
 * - Turbopack is the default bundler in Next 16; no flag needed.
 * - `images.domains` is removed in Next 16 — use `images.remotePatterns`.
 *   Supabase Storage public URLs come from `<project-ref>.supabase.co`.
 */

const supabaseHost = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root: a stray lockfile in the home dir made Next guess
  // the wrong root. Anchor it to this project.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Supabase Storage (avatars, banners, store images, gallery)
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // Generic Supabase wildcard so dev works before the env is set.
      {
        protocol: "https" as const,
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Typed routes: catch broken <Link> hrefs at build time.
  typedRoutes: true,
};

export default nextConfig;
