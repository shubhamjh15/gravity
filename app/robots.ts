import type { MetadataRoute } from "next";

/**
 * robots.txt — allow public pages, disallow auth + the hidden admin area.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/profile", "/wallet", "/auth", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
