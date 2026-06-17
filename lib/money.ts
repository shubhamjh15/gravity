/**
 * ============================================================================
 * GRAVITY — money.ts  (NON-NEGOTIABLE #1)
 * ----------------------------------------------------------------------------
 * Money is ALWAYS integer paise. Percentages are ALWAYS basis points (bps).
 * Rupees exist only at the moment of display. There are NO floats in money
 * logic anywhere in this codebase.
 *
 * This is the single source of truth for money math. Never inline `/100` or
 * `*100`. Never store or compute money as a plain `number`/`float`. The DB
 * columns are BIGINT paise; in TS we carry them as the branded `Paise` type so
 * the compiler refuses to let raw numbers, rupees, or bps be mixed up.
 *
 *   1 rupee        = 100 paise
 *   1 percent      = 100 bps
 *   100 percent    = 10_000 bps
 *
 * JS `number` is a float64 with a safe integer ceiling of 2^53-1
 * (Number.MAX_SAFE_INTEGER ≈ 9.007e15). That is ~₹90 trillion in paise — far
 * beyond anything this platform will ever sum in one figure — so integer
 * `number` math is safe here. We still guard against non-integers and overflow.
 * ============================================================================
 */

/** Integer paise. The ONLY representation of money in business logic. */
export type Paise = number & { readonly __brand: "Paise" };

/** Basis points. The ONLY representation of a rate/percentage. 1% = 100 bps. */
export type Bps = number & { readonly __brand: "Bps" };

export const PAISE_PER_RUPEE = 100 as const;
export const BPS_PER_PERCENT = 100 as const;
export const BPS_FULL = 10_000 as const; // 100%

// ---------------------------------------------------------------------------
// Construction / assertion
// ---------------------------------------------------------------------------

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`${label} must be a finite number, got ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} exceeds safe-integer range: ${value}`);
  }
}

/** Brand a raw integer as Paise (must be a non-negative safe integer). */
export function paise(value: number): Paise {
  assertSafeInteger(value, "paise");
  if (value < 0) {
    throw new MoneyError(`paise must be >= 0, got ${value}`);
  }
  return value as Paise;
}

/**
 * Brand a raw integer as Paise allowing negatives (for ledger deltas/refunds
 * where direction is tracked separately but a signed amount is convenient).
 * Use sparingly — prefer non-negative `paise` + an explicit direction.
 */
export function signedPaise(value: number): Paise {
  assertSafeInteger(value, "signedPaise");
  return value as Paise;
}

/** Brand a raw integer as Bps (0..10000 by default; pass allowOverflow for >100%). */
export function bps(value: number, opts?: { allowOverflow?: boolean }): Bps {
  assertSafeInteger(value, "bps");
  if (value < 0) throw new MoneyError(`bps must be >= 0, got ${value}`);
  if (!opts?.allowOverflow && value > BPS_FULL) {
    throw new MoneyError(`bps must be <= ${BPS_FULL} (100%), got ${value}`);
  }
  return value as Bps;
}

export const ZERO = paise(0);

// ---------------------------------------------------------------------------
// Conversions (the ONLY place rupees/percent touch paise/bps)
// ---------------------------------------------------------------------------

/**
 * Convert rupees (may be a decimal like 40 or 39.5) to integer Paise.
 * Rounds half-up at the paise level to avoid float drift. Use ONLY at the
 * boundary where a human enters/sees rupees.
 */
export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) {
    throw new MoneyError(`rupees must be finite, got ${rupees}`);
  }
  if (rupees < 0) throw new MoneyError(`rupees must be >= 0, got ${rupees}`);
  // Multiply in a way that tolerates classic float error (e.g. 39.95 * 100).
  const p = Math.round((rupees + Number.EPSILON) * PAISE_PER_RUPEE);
  return paise(p);
}

/** Convert Paise to a rupee number (for display/serialization only). */
export function paiseToRupees(p: Paise): number {
  return (p as number) / PAISE_PER_RUPEE;
}

/** Convert a percent (e.g. 2.5) to Bps (250). */
export function percentToBps(percent: number): Bps {
  if (!Number.isFinite(percent)) {
    throw new MoneyError(`percent must be finite, got ${percent}`);
  }
  return bps(Math.round(percent * BPS_PER_PERCENT), { allowOverflow: true });
}

/** Convert Bps to a percent number (for display only). */
export function bpsToPercent(b: Bps): number {
  return (b as number) / BPS_PER_PERCENT;
}

// ---------------------------------------------------------------------------
// Arithmetic (stays in integer paise)
// ---------------------------------------------------------------------------

export function addPaise(...values: Paise[]): Paise {
  return signedPaise(values.reduce((sum, v) => sum + (v as number), 0));
}

export function subPaise(a: Paise, b: Paise): Paise {
  return signedPaise((a as number) - (b as number));
}

export function mulPaise(amount: Paise, factor: number): Paise {
  assertSafeInteger(factor, "factor");
  return signedPaise((amount as number) * factor);
}

/**
 * Apply a bps rate to a paise amount, rounding half-up to whole paise.
 * e.g. applyBps(₹2000, 550bps=5.5%) -> ₹110.00
 */
export function applyBps(amount: Paise, rate: Bps): Paise {
  const product = (amount as number) * (rate as number);
  // divide by 10_000 (bps denominator) with half-up rounding
  const result = Math.round(product / BPS_FULL);
  return signedPaise(result);
}

export function maxPaise(a: Paise, b: Paise): Paise {
  return (a as number) >= (b as number) ? a : b;
}

export function minPaise(a: Paise, b: Paise): Paise {
  return (a as number) <= (b as number) ? a : b;
}

export function eqPaise(a: Paise, b: Paise): boolean {
  return (a as number) === (b as number);
}

export function gtPaise(a: Paise, b: Paise): boolean {
  return (a as number) > (b as number);
}

export function gtePaise(a: Paise, b: Paise): boolean {
  return (a as number) >= (b as number);
}

export function isZero(a: Paise): boolean {
  return (a as number) === 0;
}

export function isPositive(a: Paise): boolean {
  return (a as number) > 0;
}

/**
 * Split a paise amount into `parts` as evenly as possible WITHOUT losing or
 * inventing a single paise (largest-remainder method). Returns an array whose
 * sum exactly equals `amount`. Useful for even prize splits / installments.
 */
export function splitEvenly(amount: Paise, parts: number): Paise[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new MoneyError(`parts must be a positive integer, got ${parts}`);
  }
  const total = amount as number;
  const base = Math.floor(total / parts);
  let remainder = total - base * parts;
  const out: Paise[] = [];
  for (let i = 0; i < parts; i++) {
    const extra = remainder > 0 ? 1 : 0;
    out.push(signedPaise(base + extra));
    if (remainder > 0) remainder--;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting (display only)
// ---------------------------------------------------------------------------

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrFormatterNoDecimals = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format Paise as an Indian-Rupee string, e.g. paise(700000) -> "₹7,000.00".
 * Pass { compactWhole: true } to drop ".00" for whole-rupee amounts: "₹7,000".
 */
export function formatPaise(
  p: Paise,
  opts?: { compactWhole?: boolean },
): string {
  const rupees = paiseToRupees(p);
  if (opts?.compactWhole && Number.isInteger(rupees)) {
    return inrFormatterNoDecimals.format(rupees);
  }
  return inrFormatter.format(rupees);
}

/** Short Indian-style compact figure for dashboards: 250000 paise -> "₹2.5K". */
export function formatPaiseCompact(p: Paise): string {
  const rupees = paiseToRupees(p);
  const compact = new Intl.NumberFormat("en-IN", {
    notation: "compact",
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 1,
  });
  return compact.format(rupees);
}

/** Format Bps as a percent string, e.g. bps(550) -> "5.5%". */
export function formatBps(b: Bps): string {
  return `${bpsToPercent(b)}%`;
}

/** Parse a user-typed rupee string ("₹1,200.50" / "1200.5") into Paise. */
export function parseRupeeInput(input: string): Paise {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (cleaned === "" || cleaned === ".") {
    throw new MoneyError(`could not parse rupee input: "${input}"`);
  }
  const value = Number(cleaned);
  return rupeesToPaise(value);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}
