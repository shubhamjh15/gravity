/**
 * ============================================================================
 * GRAVITY — prize.ts  (the tournament money engine)
 * ----------------------------------------------------------------------------
 * Computes payouts from a prize structure + actual results, and validates that
 * a structure sums to the collected pool. All money is integer paise (lib/money).
 *
 * The canonical structure (from the plan):
 *   50 players x ₹40 = ₹2000 pool
 *   1st ₹700, 2nd ₹300, 3rd ₹100, per-kill ₹10 (cap ₹490),
 *   admin ₹110, organizer ₹300  ->  1100 + 490 + 110 + 300 = 2000 ✓
 *
 * Rules:
 *  - The engine refuses to "publish" a structure unless its committed buckets
 *    (rank prizes + kill-budget cap + admin cut + organizer profit) equal the
 *    pool collected at full fill (max_slots x entry_fee).
 *  - At under-fill, fill_policy decides:
 *      'guaranteed' -> prizes stay as configured (organizer eats the shortfall)
 *      'scale_down' -> rank prizes + kill cap scale by (collected / fullPool)
 *  - Per-kill payout is capped by kill_budget_cap_paise. Leftover kill budget
 *    (cap minus actually-paid kills) is routed by kill_surplus_policy.
 * ============================================================================
 */
import {
  paise,
  signedPaise,
  addPaise,
  subPaise,
  mulPaise,
  minPaise,
  applyBps,
  percentToBps,
  type Paise,
} from "@/lib/money";

export type FillPolicy = "scale_down" | "guaranteed";
export type KillSurplusPolicy = "to_organizer" | "to_admin" | "to_prize" | "destroy";

export type PrizeStructure = {
  entryFee: Paise;
  /** rank -> prize, e.g. { 1: ₹700, 2: ₹300, 3: ₹100 } in paise. */
  rankPrizes: Record<number, Paise>;
  perKill: Paise;
  killBudgetCap: Paise;
  adminCut: Paise;
  organizerProfit: Paise;
  fillPolicy: FillPolicy;
  killSurplusPolicy: KillSurplusPolicy;
  maxSlots: number;
};

export type ResultRow = {
  userId: string;
  rank: number | null;
  kills: number;
};

export type Payout = {
  userId: string;
  rank: number | null;
  kills: number;
  rankPrize: Paise;
  killPrize: Paise;
  total: Paise;
};

export type PrizeComputation = {
  payouts: Payout[];
  totalRankPaid: Paise;
  totalKillPaid: Paise;
  totalPaidToPlayers: Paise;
  adminCut: Paise;
  organizerProfit: Paise;
  killSurplus: Paise;
  collectedPool: Paise;
  scaleFactorBps: number; // 10000 = 1.0 (no scaling)
};

export class PrizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrizeError";
  }
}

// ---------------------------------------------------------------------------
// Sums / helpers
// ---------------------------------------------------------------------------

export function sumRankPrizes(rankPrizes: Record<number, Paise>): Paise {
  return signedPaise(
    Object.values(rankPrizes).reduce((s, v) => s + (v as number), 0),
  );
}

/** The pool collected at a given participant count. */
export function poolForCount(entryFee: Paise, count: number): Paise {
  if (!Number.isInteger(count) || count < 0) {
    throw new PrizeError(`count must be a non-negative integer (got ${count})`);
  }
  return mulPaise(entryFee, count);
}

/** Committed total a structure promises at FULL fill. */
export function committedTotal(s: PrizeStructure): Paise {
  return addPaise(
    sumRankPrizes(s.rankPrizes),
    s.killBudgetCap,
    s.adminCut,
    s.organizerProfit,
  );
}

/**
 * Validate that the structure's committed buckets equal the full pool
 * (maxSlots x entryFee). Throws PrizeError with the delta if not.
 */
export function validateStructure(s: PrizeStructure): {
  ok: boolean;
  fullPool: Paise;
  committed: Paise;
  deltaPaise: number;
} {
  const fullPool = poolForCount(s.entryFee, s.maxSlots);
  const committed = committedTotal(s);
  const delta = (committed as number) - (fullPool as number);
  return {
    ok: delta === 0,
    fullPool,
    committed,
    deltaPaise: delta,
  };
}

/** Same as validateStructure but throws on mismatch (used before publish). */
export function assertValidStructure(s: PrizeStructure): void {
  const r = validateStructure(s);
  if (!r.ok) {
    throw new PrizeError(
      `Prize split (${r.committed} p) does not equal the full pool (${r.fullPool} p). ` +
        `Off by ${r.deltaPaise} paise. Adjust prizes, kill cap, admin cut or organizer profit.`,
    );
  }
}

// ---------------------------------------------------------------------------
// The computation
// ---------------------------------------------------------------------------

/**
 * Compute payouts for a finished event.
 *
 * @param s        the prize structure
 * @param results  final standings (rank + kills per participant)
 * @param actualCount  how many paid participants there were (for the pool)
 */
export function computePayouts(
  s: PrizeStructure,
  results: ResultRow[],
  actualCount: number,
): PrizeComputation {
  const fullPool = poolForCount(s.entryFee, s.maxSlots);
  const collectedPool = poolForCount(s.entryFee, actualCount);

  // Scaling: only when under-filled AND policy says scale_down.
  let scaleFactorBps = 10000; // 1.0
  if (
    s.fillPolicy === "scale_down" &&
    (collectedPool as number) < (fullPool as number) &&
    (fullPool as number) > 0
  ) {
    // factor = collected / full, in bps. Floor to avoid over-paying.
    scaleFactorBps = Math.floor(
      ((collectedPool as number) / (fullPool as number)) * 10000,
    );
  }

  const scale = (amount: Paise): Paise =>
    scaleFactorBps === 10000
      ? amount
      : applyBps(amount, percentToBps(scaleFactorBps / 100));

  // Rank prize lookup (scaled).
  const rankPrize = (rank: number | null): Paise => {
    if (rank == null) return paise(0);
    const base = s.rankPrizes[rank];
    return base ? scale(base) : paise(0);
  };

  // Kill budget available this event (scaled cap).
  const killCap = scale(s.killBudgetCap);

  // First pass: per-player kill prize (uncapped), then cap the TOTAL.
  const rawKill = results.map((r) => ({
    r,
    raw: mulPaise(s.perKill, Math.max(0, r.kills)),
  }));
  const rawKillTotal = signedPaise(
    rawKill.reduce((sum, x) => sum + (x.raw as number), 0),
  );

  // If raw kill payout exceeds the cap, scale kills proportionally to fit.
  let killScaleBps = 10000;
  if ((rawKillTotal as number) > (killCap as number) && (rawKillTotal as number) > 0) {
    killScaleBps = Math.floor(
      ((killCap as number) / (rawKillTotal as number)) * 10000,
    );
  }
  const killScale = (amount: Paise): Paise =>
    killScaleBps === 10000 ? amount : applyBps(amount, percentToBps(killScaleBps / 100));

  const payouts: Payout[] = rawKill.map(({ r, raw }) => {
    const rp = rankPrize(r.rank);
    const kp = killScale(raw);
    return {
      userId: r.userId,
      rank: r.rank,
      kills: r.kills,
      rankPrize: rp,
      killPrize: kp,
      total: addPaise(rp, kp),
    };
  });

  const totalRankPaid = signedPaise(
    payouts.reduce((s2, p) => s2 + (p.rankPrize as number), 0),
  );
  const totalKillPaid = signedPaise(
    payouts.reduce((s2, p) => s2 + (p.killPrize as number), 0),
  );
  const totalPaidToPlayers = addPaise(totalRankPaid, totalKillPaid);

  // Leftover kill budget = cap - actually-paid kills.
  const killSurplus = subPaise(killCap, totalKillPaid);

  // Admin cut + organizer profit (scaled under under-fill).
  let adminCut = scale(s.adminCut);
  let organizerProfit = scale(s.organizerProfit);

  // Route the kill surplus.
  switch (s.killSurplusPolicy) {
    case "to_admin":
      adminCut = addPaise(adminCut, killSurplus);
      break;
    case "to_organizer":
      organizerProfit = addPaise(organizerProfit, killSurplus);
      break;
    case "to_prize":
      // fold into the top rank prize if present (simple, deterministic)
      if (payouts.length > 0) {
        const top = payouts.reduce((a, b) =>
          (a.rank ?? 9999) <= (b.rank ?? 9999) ? a : b,
        );
        top.rankPrize = addPaise(top.rankPrize, killSurplus);
        top.total = addPaise(top.total, killSurplus);
      } else {
        organizerProfit = addPaise(organizerProfit, killSurplus);
      }
      break;
    case "destroy":
    default:
      // surplus is not redistributed
      break;
  }

  return {
    payouts,
    totalRankPaid,
    totalKillPaid: minPaise(totalKillPaid, killCap),
    totalPaidToPlayers,
    adminCut,
    organizerProfit,
    killSurplus: s.killSurplusPolicy === "destroy" ? killSurplus : paise(0),
    collectedPool,
    scaleFactorBps,
  };
}
