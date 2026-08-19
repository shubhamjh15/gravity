"use client";

/**
 * "Announcement from the Admin" banner (SCHEMA.md §7).
 *
 * Server-rendered data, dismissed client-side. A dismissal is remembered per
 * announcement id in sessionStorage so a critical notice returns on the next
 * visit but doesn't nag on every navigation within a session.
 *
 * Colour comes from the single accent family plus the semantic warning/danger
 * tokens — no new hue, no hardcoded hex (anti-vibecoded rule).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, TriangleAlert, OctagonAlert, X } from "lucide-react";
import type { Announcement } from "@/lib/data/announcements";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "gv:dismissed-announcements";

const LEVEL_STYLES = {
  info: {
    Icon: Info,
    wrap: "border-line bg-surface/80 text-foreground",
    icon: "text-crimson-400",
  },
  warning: {
    Icon: TriangleAlert,
    wrap: "border-warning/40 bg-warning/10 text-foreground",
    icon: "text-warning",
  },
  critical: {
    Icon: OctagonAlert,
    wrap: "border-danger/50 bg-danger/12 text-foreground",
    icon: "text-danger",
  },
} as const;

function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function AnnouncementBanner({
  announcements,
}: {
  announcements: Announcement[];
}) {
  // Start empty and fill after mount: sessionStorage isn't available during
  // SSR, and rendering then hiding would cause a hydration mismatch.
  const [visible, setVisible] = useState<Announcement[]>([]);

  useEffect(() => {
    const dismissed = readDismissed();
    setVisible(announcements.filter((a) => !dismissed.includes(a.id)));
  }, [announcements]);

  function dismiss(id: string) {
    setVisible((list) => list.filter((a) => a.id !== id));
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...readDismissed(), id]),
      );
    } catch {
      // Private-mode or storage-full: dismissing for this render is enough.
    }
  }

  if (visible.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
      <AnimatePresence initial={false}>
        {visible.map((a) => {
          const style = LEVEL_STYLES[a.level] ?? LEVEL_STYLES.info;
          const Icon = style.Icon;
          return (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              role={a.level === "critical" ? "alert" : "status"}
              className={cn(
                "mb-3 flex items-start gap-3 rounded-lg border px-4 py-3 backdrop-blur",
                style.wrap,
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", style.icon)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.title}</p>
                {a.body ? (
                  <p className="mt-0.5 text-sm text-text-muted">{a.body}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                aria-label={`Dismiss announcement: ${a.title}`}
                className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
