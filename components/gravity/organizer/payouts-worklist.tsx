"use client";

/**
 * Payouts worklist (organizer/admin). Lists winners with their owed amount;
 * marking a payout paid records the UTR + writes the ledger 'out' entry. The DB
 * has a unique-paid guard so the same payout can't be double-recorded.
 *
 * The winner's UPI is not part of this list's payload — it's PII the organizer
 * can't read directly (#6). "Show UPI" fetches it through an audited RPC at the
 * moment of transfer, so the number is available exactly when it's needed and
 * every look is on record.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Wallet, Check, Eye, Copy } from "lucide-react";
import {
  markPayoutPaid,
  revealPayoutUpi,
} from "@/app/(organizer)/dashboard/result-actions";
import { formatPaise, paise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PayoutRow = {
  id: string;
  name: string;
  amount_paise: number;
  status: string;
  utr: string | null;
};

export function PayoutsWorklist({ payouts }: { payouts: PayoutRow[] }) {
  if (payouts.length === 0) {
    return (
      <div className="gv-panel p-5">
        <div className="flex items-center gap-2 font-display text-lg">
          <Wallet className="size-5 text-crimson-400" />
          Payouts
        </div>
        <p className="mt-2 text-sm text-text-muted">
          Payouts appear here after you publish results.
        </p>
      </div>
    );
  }

  return (
    <div className="gv-panel p-5">
      <div className="flex items-center gap-2 font-display text-lg">
        <Wallet className="size-5 text-crimson-400" />
        Payouts
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {payouts.map((p) => (
          <PayoutItem key={p.id} payout={p} />
        ))}
      </div>
    </div>
  );
}

function PayoutItem({ payout }: { payout: PayoutRow }) {
  const [pending, startTransition] = useTransition();
  const [utr, setUtr] = useState("");
  const [paid, setPaid] = useState(payout.status === "paid");
  const [upi, setUpi] = useState<string | null>(null);

  function showUpi() {
    startTransition(async () => {
      const res = await revealPayoutUpi({ payout_id: payout.id });
      if (res.success) {
        setUpi(res.data.upi_id);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  async function copyUpi() {
    if (!upi) return;
    try {
      await navigator.clipboard.writeText(upi);
      toast.success("UPI ID copied.");
    } catch {
      toast.error("Couldn't copy — select it manually.");
    }
  }

  function pay() {
    if (!utr.trim()) {
      toast.error("Enter the UTR / transaction reference.");
      return;
    }
    startTransition(async () => {
      const res = await markPayoutPaid({ payout_id: payout.id, utr: utr.trim() });
      if (res.success) {
        toast.success(res.message);
        setPaid(true);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-4 sm:justify-start">
          <span className="font-medium">{payout.name}</span>
          <span className="font-mono font-semibold text-crimson-300">
            {formatPaise(paise(payout.amount_paise))}
          </span>
        </div>

        {!paid ? (
          upi ? (
            <button
              type="button"
              onClick={copyUpi}
              className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-text-muted transition-colors hover:text-foreground"
              title="Copy UPI ID"
            >
              <Copy className="size-3" />
              {upi}
            </button>
          ) : (
            <button
              type="button"
              onClick={showUpi}
              disabled={pending}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-crimson-300 disabled:opacity-50"
              title="Reveal the winner's UPI ID — this lookup is logged"
            >
              <Eye className="size-3" />
              Show UPI
            </button>
          )
        ) : null}
      </div>

      {paid ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">
          <Check className="size-3.5" /> Paid
          {payout.utr ? <span className="font-mono">· {payout.utr}</span> : null}
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            placeholder="UTR / ref"
            className="h-9 w-36"
          />
          <Button onClick={pay} disabled={pending} variant="gradient" size="sm">
            {pending ? "…" : "Mark paid"}
          </Button>
        </div>
      )}
    </div>
  );
}
