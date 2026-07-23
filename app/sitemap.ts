import type { MetadataRoute } from "next";

/**
 * Static sitemap of the public surfaces. Dynamic entries (events, communities,
 * products) can be appended by querying Supabase here once data exists; we keep
 * the core routes for now so the sitemap is always valid.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const routes = ["", "/events", "/communities", "/leaderboard", "/store", "/sponsors", "/about", "/login"];
  return routes.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.7,
  }));
}
