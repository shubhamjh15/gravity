# Project notes

This file used to be a verbatim copy of the root `CLAUDE.md`, and it drifted —
it still described Phase 0 as "next" long after Phases 0–5 shipped. Duplicated
docs rot, so it now points at the originals instead of restating them.

| Looking for | Read |
|---|---|
| Conventions + the 7 non-negotiables | [`../CLAUDE.md`](../CLAUDE.md) |
| What we build and in what order, with live status | [`ROADMAP.md`](ROADMAP.md) |
| Every table, column, RPC and RLS rule | [`SCHEMA.md`](SCHEMA.md) |
| Accounts, keys and first-run commands | [`SETUP.md`](SETUP.md) |
| How the layers fit together | [`ARCHITECTURE.md`](ARCHITECTURE.md) |

## Working agreements worth remembering

- **Derive, never accumulate.** `player_stats`, `store_orders.amount_paid_paise`
  and the event revenue split are all *recomputed from source rows*, never
  incremented. Every one of them runs from a retry-prone caller (a webhook
  redelivery, a re-publish), so idempotence is a correctness requirement rather
  than a nicety.
- **Money enters through exactly one door.** The signed Razorpay webhook writes
  the ledger; nothing else does. A server action may *create* an order, never
  settle one.
- **PII stays behind an audited RPC.** When a flow genuinely needs a phone or a
  UPI id, add a narrow `SECURITY DEFINER` function that checks authority and
  writes `audit_log` — never widen the RLS on `profiles_private`.
- **A test that forgets `set local role authenticated` proves nothing**, because
  RLS is bypassed by the table owner. Use the `tests.*` helpers.
