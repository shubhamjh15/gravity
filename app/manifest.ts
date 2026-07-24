import type { MetadataRoute } from "next";

/**
 * PWA web manifest — installable on mobile, dark theme matching GRAVITY.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GRAVITY — eSports Tournaments",
    short_name: "GRAVITY",
    description:
      "Run tournaments, compete for cash prize pools, and build communities for the Indian Free Fire, BGMI and PUBG scene.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0a0c",
    theme_color: "#0b0a0c",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
