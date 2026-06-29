"use client";

/**
 * Events filter bar — search + game + status + free toggle. Syncs to the URL so
 * the page (server component) re-renders with the new query. Debounced search.
 */
import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Game = { id: string; name: string };

const STATUSES = [
  { value: "live", label: "Upcoming & Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archives" },
] as const;

export function EventsFilter({ games }: { games: Game[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const game = params.get("game") ?? "all";
  const status = params.get("status") ?? "live";
  const free = params.get("free") === "1";

  const apply = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "" || v === "all" || v === "live") sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete("page");
      startTransition(() => router.replace(`${pathname}?${sp.toString()}` as never));
    },
    [params, pathname, router],
  );

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) apply({ q: q || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tournaments…"
          className="pl-9"
        />
      </div>

      <Select value={game} onValueChange={(v) => apply({ game: v === "all" ? null : v })}>
        <SelectTrigger className="sm:w-44">
          <SelectValue placeholder="All games" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All games</SelectItem>
          {games.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => apply({ status: v })}>
        <SelectTrigger className="sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant={free ? "gradient" : "outline"}
        onClick={() => apply({ free: free ? null : "1" })}
      >
        Free only
      </Button>
    </div>
  );
}
