"use client";

/**
 * Community feed — post composer (members/owner) + the post list. Posts can be
 * pinned and reference an event. Uses the createPost server action.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pin, Send, Calendar } from "lucide-react";
import { createPost } from "@/app/(public)/communities/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Post = {
  id: string;
  author_id: string;
  body: string;
  event_id: string | null;
  pinned: boolean;
  created_at: string;
};

export function CommunityFeed({
  communityId,
  posts,
  nameMap,
  canPost,
}: {
  communityId: string;
  posts: Post[];
  nameMap: Record<string, string>;
  canPost: boolean;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function post() {
    if (!body.trim()) return;
    const text = body.trim();
    startTransition(async () => {
      const res = await createPost({ community_id: communityId, body: text });
      if (res.success) {
        toast.success(res.message);
        setBody("");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {canPost ? (
        <div className="gv-panel p-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share an update with your community…"
            rows={3}
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={post} disabled={pending || !body.trim()} variant="gradient" size="sm">
              <Send className="size-4" /> {pending ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      ) : null}

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-text-muted">
          No posts yet. {canPost ? "Be the first!" : ""}
        </div>
      ) : (
        posts.map((p) => (
          <article key={p.id} className="gv-panel p-4">
            <div className="flex items-center justify-between">
              <Link
                href={`/u/${p.author_id}` as never}
                className="font-medium hover:text-crimson-300"
              >
                {nameMap[p.author_id] ?? "Player"}
              </Link>
              <div className="flex items-center gap-2 text-xs text-text-dim">
                {p.pinned ? <Pin className="size-3.5 text-crimson-400" /> : null}
                <time dateTime={p.created_at}>
                  {new Date(p.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-muted">
              {p.body}
            </p>
            {p.event_id ? (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-crimson-700/40 bg-crimson-500/10 px-3 py-1.5 text-xs text-crimson-300">
                <Calendar className="size-3.5" /> Linked tournament
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
