import type { Json } from "@/lib/supabase/types";

/**
 * Bridge a validated payload into a `jsonb` column.
 *
 * The generated `Json` type is a recursive union, and TypeScript won't accept a
 * `Record<string, unknown>` (or a Zod-inferred object) as assignable to it even
 * when every value is JSON-serialisable — structural recursion can't prove it.
 *
 * Rather than sprinkling `as never` at a dozen call sites, the assertion lives
 * here once, named, so it's greppable and its precondition is written down:
 *
 *   ONLY pass values that are genuinely JSON-serialisable — plain objects,
 *   arrays, strings, numbers, booleans, null. Never a Date, Map, Set, BigInt,
 *   class instance, or anything with a function property. Postgres will either
 *   reject those or silently store something you didn't mean.
 *
 * In practice every caller passes a Zod-parsed object or a literal, both of
 * which satisfy that.
 */
export function asJson(value: unknown): Json {
  return value as Json;
}
