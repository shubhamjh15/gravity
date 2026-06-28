"use client";

/**
 * Document upload — gov-ID & proof-of-skill to PRIVATE buckets (#6). Files go
 * straight to the owner folder via the browser client (RLS storage policy),
 * then a server action records the metadata + review state. We never render the
 * file publicly; access later is via short-TTL signed URLs only.
 */
import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { FileCheck2, Upload, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { saveDocument } from "@/app/(player)/profile/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const DOC_TYPES = [
  { value: "gov_id", label: "Government ID", bucket: "gov-id" },
  { value: "skill_proof", label: "Proof of gaming skill", bucket: "skill-proof" },
  { value: "kill_ratio_proof", label: "Kill-ratio proof", bucket: "skill-proof" },
  { value: "elite_pass_proof", label: "Elite pass proof", bucket: "skill-proof" },
] as const;

export function DocumentUpload({ userId }: { userId: string }) {
  const [docType, setDocType] = useState<string>("gov_id");
  const [govIdType, setGovIdType] = useState<string>("aadhaar");
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = DOC_TYPES.find((d) => d.value === docType)!;

  async function onFile(file: File) {
    if (!isSupabaseConfigured()) {
      toast.error("Uploads need Supabase keys configured.");
      return;
    }
    const okType =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) {
      toast.error("Upload an image or PDF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File must be under 8 MB.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${userId}/${docType}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(selected.bucket)
      .upload(path, file, { upsert: false });

    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return;
    }

    startTransition(async () => {
      const res = await saveDocument({
        doc_type: docType,
        file_path: path,
        gov_id_type: docType === "gov_id" ? govIdType : undefined,
      });
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
        <FileCheck2 className="size-4 text-crimson-400" />
        Verification documents
      </div>

      <p className="flex items-start gap-2 rounded-md border border-line bg-surface-2/60 px-3 py-2 text-xs text-text-dim">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-crimson-400" />
        Stored privately and only visible to reviewers. Required for elite tiers
        and some tournaments.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="doc_type">Document type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger id="doc_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {docType === "gov_id" ? (
          <div className="grid gap-2">
            <Label htmlFor="gov_id_kind">ID type</Label>
            <Select value={govIdType} onValueChange={setGovIdType}>
              <SelectTrigger id="gov_id_kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aadhaar">Aadhaar</SelectItem>
                <SelectItem value="pan">PAN</SelectItem>
                <SelectItem value="dl">Driving License</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="voter">Voter ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button
          type="button"
          variant="gradient"
          disabled={pending}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" />
          {pending ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </div>
  );
}
