"use client";

/**
 * Community chat — Supabase Realtime. Subscribes to new rows on chat_messages
 * for this channel (deliberate realtime, #7). Sends via the server action so
 * RLS validates membership. Auto-scrolls; optimistic-free (realtime echoes the
 * insert back). Responsive height.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, MessageSquare } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import {
  sendMessage,
  ensureCommunityChannel,
} from "@/app/(public)/communities/chat-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_name?: string;
};

export function CommunityChat({
  communityId,
  currentUserId,
  isMember,
  nameMap,
}: {
  communityId: string;
  currentUserId: string;
  isMember: boolean;
  nameMap: Record<string, string>;
}) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open / join the channel, load history.
  useEffect(() => {
    if (!isMember || !isSupabaseConfigured()) return;
    let active = true;
    (async () => {
      const res = await ensureCommunityChannel(communityId);
      if (!res.success || !active) return;
      const cid = res.data.channelId;
      setChannelId(cid);

      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_id, body, created_at")
        .eq("channel_id", cid)
        .order("created_at", { ascending: true })
        .limit(100);
      if (active && data) setMessages(data as Message[]);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [communityId, isMember]);

  // Realtime subscription.
  useEffect(() => {
    if (!channelId || !isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();
    const sub = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId]);

  // Auto-scroll on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function send() {
    if (!draft.trim() || !channelId) return;
    const body = draft.trim();
    setDraft("");
    startTransition(async () => {
      const res = await sendMessage({ channel_id: channelId, body });
      if (!res.success) toast.error(res.message);
    });
  }

  if (!isMember) {
    return (
      <div className="gv-panel flex flex-col items-center gap-2 p-8 text-center">
        <MessageSquare className="size-6 text-text-dim" />
        <p className="text-sm text-text-muted">
          Join this community to access the member chat.
        </p>
      </div>
    );
  }

  return (
    <div className="gv-panel flex h-[28rem] flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 font-display">
        <MessageSquare className="size-4 text-crimson-400" />
        Community chat
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {!ready ? (
          <p className="text-center text-sm text-text-dim">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-text-dim">
            No messages yet. Say hi 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}
              >
                {!mine ? (
                  <span className="px-1 font-mono text-[10px] text-text-dim">
                    {nameMap[m.sender_id] ?? "Player"}
                  </span>
                ) : null}
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-sm bg-[image:var(--gv-grad-accent)] text-white"
                      : "rounded-bl-sm border border-line bg-surface-2",
                  )}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message the community…"
          disabled={pending}
        />
        <Button onClick={send} disabled={pending || !draft.trim()} variant="gradient" size="icon">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
