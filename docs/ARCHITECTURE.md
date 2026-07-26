# GRAVITY — Architecture

A tour of how the system fits together, for anyone reading the code.

## Layers

```
Next.js App Router (Server Components first)
        │
Server Actions / Route Handlers   ← the "backend"; validate with Zod, enforce auth
        │
lib/ services  (money, prize, auth, data helpers, razorpay, email)
        │
Supabase JS client  (RLS-scoped server client | service-role | browser)
        │
Postgres  — RLS on every table, SECURITY DEFINER RPCs for privileged writes
```

There is no separate API server. Server Actions and Route Handlers *are* the backend.

## The three Supabase clients

- **`createSupabaseServerClient()`** — RLS-scoped, acts as the logged-in user. Used in Server Components, Server Actions, Route Handlers. `cookies()` is awaited (Next 16).
- **`createSupabaseServiceRoleClient()`** — bypasses RLS. ONLY for trusted server code (the Razorpay webhook). Never imported client-side.
- **`createSupabaseBrowserClient()`** — anon key, RLS-limited. For Realtime (chat, notifications) and client reads.

Session refresh runs in `proxy.ts` (Next 16's renamed middleware).

## Money

`lib/money.ts` is the single source of truth. Branded `Paise` and `Bps` types make it a compile error to mix money with raw numbers. All arithmetic stays in integers; rupees appear only at display via `formatPaise`.

The **prize engine** (`lib/prize.ts`) computes payouts from a `PrizeStructure` + results, validates the split equals the collected pool, and handles under-fill (`fill_policy`) and the kill-budget cap + surplus routing. The canonical test: `50 × ₹40 = ₹2000` split into `1st 700 / 2nd 300 / 3rd 100 / kills 490 / admin 110 / organizer 300`.

## The unified ledger

Every rupee that moves is one row in `ledger_entries`, written only via the `write_ledger_entry` `SECURITY DEFINER` RPC (idempotent on `razorpay_payment_id`). The revenue dashboard is a `GROUP BY source_type` on this table — gross is `SUM WHERE direction='in' AND status IN (captured,settled)`.

## Money settlement flow

```
Client                Server Action            Razorpay            Webhook
  │  register            │                        │                   │
  ├─────────────────────▶│  reserve_slot (atomic) │                   │
  │                      ├─ create order ────────▶│                   │
  │◀── order ────────────┤                        │                   │
  ├─ checkout ──────────────────────────────────▶│                   │
  │                                               ├─ payment.captured ▶│
  │                                               │   verify HMAC,     │
  │                                               │   dedupe event,    │
  │                                               │   write_ledger,    │
  │                                               │   confirm reg      │
```

Money settles **only** from the verified webhook — never the client.

## Security model

- **RLS deny-by-default** on every table. Policies grant the minimum each role needs.
- **PII isolation**: `profiles_private` (UPI/phone/gov-ID) is reachable only by the owner or a superadmin; no public view joins it.
- **Room credentials** are never selectable publicly — exposed via the `get_room_credentials` RPC, gated on paid participation.
- **Hidden admin**: an obscure env-driven URL + a superadmin check + `platform_admins` allowlist. The URL is cosmetic; RLS is the real gate.
- **Audit log** is append-only (no update/delete policy); privileged actions write to it.

## Realtime (deliberate)

Used for community chat (`chat_messages`) and the notification bell (`notifications`) — both subscribe per-channel/per-user. Never subscribed on hot public pages (events list, leaderboard), which read precomputed snapshots instead.

## Cron

`pg_cron` schedules: leaderboard refresh (15 min), slot-hold sweep (5 min), installment-overdue flag (daily). Sweeps are best-effort — correctness never depends on them (atomic RPCs handle that).
