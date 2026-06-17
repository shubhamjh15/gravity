import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — merge conditional class names and de-duplicate conflicting Tailwind
 * utilities (later class wins). Used by every component + shadcn primitive.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Build a URL-safe slug from a free-text title. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-") // non-alphanumeric -> dash
    .replace(/^-+|-+$/g, "") // trim dashes
    .replace(/-{2,}/g, "-") // collapse repeats
    .slice(0, 80);
}

/** Sleep helper for retries / backoff (server-side). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
