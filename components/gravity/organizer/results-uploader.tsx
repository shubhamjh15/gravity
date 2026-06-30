"use client";

/**
 * Results uploader (organizer). Upload the leaderboard screenshot to the private
 * bucket, then enter rank + kills per participant. On submit the server runs the
 * prize engine to compute payouts (provisional). A separate Publish action makes
 * results public + queues payouts.
 */
import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Upload, Trophy, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { uploadResults, publishResults } from "@/app/(organizer)/dashboard/result-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Participant = { user_id: string; name: string };

export function ResultsUploader({
  eventId,
  organizerId,
  participants,
  hasResults,
}: {
  eventId: string;
  organizerId: string;
  participants: Participant[];
  hasResults: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, { rank: string; kills: string }>>(
    Object.fromEntries(participants.map((p) => [p.user_id, { rank: "", kills: "" }])),
  );

  async function uploadScreenshot(file: File) {
    if (!isSupabaseConfigured()) {
      toast.error("Backend not configured.");
      return;
    }
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const path = `${organizerId}/${eventId}_${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
    const { error } = await supabase.storage
      .from("leaderboard-screenshots")
      .upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return;
    }
    setScreenshotPath(path);
    toast.success("Screenshot uploaded.");
  }

  function setRow(uid: string, field: "rank" | "kills", value: string) {
    setRows((r) => ({ ...r, [uid]: { ...r[uid], [field]: value } }));
  }

  function compute() {
    if (!screenshotPath) {
      toast.error("Upload the leaderboard screenshot first.");
      return;
    }
    const resultRows = participants
      .map((p) => {
        const row = rows[p.user_id];
        const rank = row.rank.trim() === "" ? null : Number(row.rank);
        const kills = row.kills.trim() === "" ? 0 : Number(row.kills);
        return { user_id: p.user_id, rank, kills };
      })
      .filter((r) => r.rank !== null || r.kills > 0);

    if (resultRows.length === 0) {
      toast.error("Enter at least one rank or kill count.");
      return;
    }

    startTransition(async () => {
      const res = await uploadResults({
        event_id: eventId,
        screenshot_path: screenshotPath,
        rows: resultRows,
      });
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  function publish() {
    startPublish(async () => {
      const res = await publishResults(eventId);
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <div className="gv-panel p-5">
      <div className="flex items-center gap-2 font-display text-lg">
        <Trophy className="size-5 text-crimson-400" />
        Results
      </div>

      {/* screenshot */}
      <div className="mt-4">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && uploadScreenshot(e.target.files[0])}
        />
        <Button
          type="button"
          variant={screenshotPath ? "glow" : "outline"}
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {screenshotPath ? "Screenshot uploaded ✓" : "Upload leaderboard screenshot"}
        </Button>
      </div>

      {/* per-player rows */}
      <div className="mt-5 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left font-mono text-[10px] tracking-widest text-text-dim uppercase">
              <th className="px-3 py-2.5">Player</th>
              <th className="w-24 px-3 py-2.5">Rank</th>
              <th className="w-24 px-3 py-2.5">Kills</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-text-muted">
                  No paid participants yet.
                </td>
              </tr>
            ) : (
              participants.map((p) => (
                <tr key={p.user_id} className="border-b border-line/50 last:border-0">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      value={rows[p.user_id]?.rank ?? ""}
                      onChange={(e) => setRow(p.user_id, "rank", e.target.value)}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={rows[p.user_id]?.kills ?? ""}
                      onChange={(e) => setRow(p.user_id, "kills", e.target.value)}
                      className="h-8"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button onClick={compute} disabled={pending} variant="outline">
          {pending ? "Computing…" : "Compute payouts"}
        </Button>
        <Button onClick={publish} disabled={publishing || !hasResults} variant="gradient">
          {publishing ? "Publishing…" : "Publish results"}
        </Button>
      </div>
    </div>
  );
}
