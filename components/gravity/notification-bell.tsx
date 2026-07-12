"use client";

/**
 * Notification bell — realtime unread badge + dropdown feed. Subscribes to the
 * user's notifications (deliberate realtime, #7). Marks read on open.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (active && data) setItems(data as Notification[]);
    })();

    const sub = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setItems((prev) => [payload.new as Notification, ...prev]),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(sub);
    };
  }, [userId]);

  async function markAllRead() {
    if (unread === 0 || !isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
      <DropdownMenuTrigger asChild>
        <button className="relative grid size-9 place-items-center rounded-md border border-line text-text-muted transition-colors hover:border-line-strong hover:text-foreground">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[image:var(--gv-grad-accent)] px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-line bg-surface-2 p-0">
        <div className="border-b border-line px-4 py-3 font-display">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-dim">No notifications yet.</p>
          ) : (
            items.map((n) => {
              const content = (
                <div className={cn("border-b border-line/50 px-4 py-3 last:border-0", !n.read_at && "bg-crimson-500/5")}>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-xs text-text-muted">{n.body}</p> : null}
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link as never}>{content}</Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
