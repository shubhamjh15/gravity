# GRAVITY

> The arena for India's grassroots esports — run tournaments, compete for cash prize pools, and build communities for the Free Fire / BGMI / PUBG scene.

A three-role platform (**Player · Organizer · Super-Admin**) built with Next.js 16, Supabase, and Razorpay. Every rupee — entry fees, prizes, memberships, store, payouts — flows through one transparent, immutable ledger.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Supabase](https://img.shields.io/badge/Supabase-Postgres%20+%20RLS-green) ![Razorpay](https://img.shields.io/badge/Razorpay-payments-blue)

---

## What it does

| Surface | Description |
|---|---|
| **Tournaments** | Discover, filter, register and pay. Room ID + password delivered to paid players via email & WhatsApp. |
| **Prize engine** | Entry fee, rank prizes, per-kill bounties with caps, admin cut, organizer profit — validated to the paise. |
| **Results** | Screenshot-based: upload the final leaderboard, enter kills & ranks, winnings compute and publish. |
| **Communities** | Paid/free join, realtime member chat, small groups, 1-v-1 invites, elite tiers, earning dashboards. |
| **Leaderboards** | Ranked by kill-ratio, win-ratio and net earnings, across scopes and periods. |
| **Store** | Full e-commerce — inventory, partial payments, verified-purchase reviews. |
| **Sponsors** | Directory + request flow routed to the right admin to publish. |
| **Super-Admin** | Hidden console: revenue dashboard, role management, ledger monitor, sponsorship inbox, Tiptap About editor. |

## Why screenshot-based results?

There is **no official Free Fire / BGMI API** for third parties. So GRAVITY works the way every real Indian tournament platform does: the organizer hosts a custom in-game room, shares the credentials with paid players, and uploads the final leaderboard screenshot. The prize engine does the rest.

---

## Tech stack

- **Next.js 16** (App Router, Server Actions, Turbopack) + **TypeScript**
- **Tailwind v4** + **shadcn/ui** (themed) + **Framer Motion** + **GSAP/ScrollTrigger** + **Tiptap**
- **Supabase** — Postgres, Auth (Google OAuth), Storage, Realtime, **RLS on every table**
- **Razorpay** — entry fees, memberships, store; payouts manual in v1
- **Resend** + WhatsApp — room-credential delivery
- **Vitest** — 119 unit tests (money, prize engine, validators)

## Architecture principles (non-negotiable)

1. Money is **integer paise** everywhere; percentages in **basis points**. Rupees only at display.
2. One authorization source: the `user_roles` table. No self-writable role column.
3. One unified `ledger_entries` table — every rupee is one row via a `SECURITY DEFINER` RPC. The revenue dashboard is a `GROUP BY`.
4. **RLS on every table, deny-by-default.** The hidden admin URL is cosmetic; RLS is the gate.
5. Money settles **only** from the signed Razorpay webhook, with idempotency.
6. PII (UPI, phone, gov-ID) lives in `profiles_private` — no public policy can reach it.
7. Realtime is used deliberately (chat, notifications), never on hot public pages.

---

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase + Razorpay keys
npm run dev                         # http://localhost:3000
```

See [`docs/SETUP.md`](docs/SETUP.md) for creating the Supabase project, running migrations, and configuring Google OAuth + Razorpay.

### Scripts

| Script | What |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run test` | Vitest suite (119 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Database

Migrations live in [`supabase/migrations/`](supabase/migrations/) (0001 → 0015). Apply them in order, then run `supabase/seed.sql` (reference data) and optionally `supabase/seed_demo.sql` (a populated demo catalog).

---

## Project layout

```
app/
  (public)/     landing, events, communities, leaderboard, store, sponsors, about, login
  (player)/     profile, my-tournaments
  (organizer)/  dashboard (create / manage tournaments)
  (admin)/      hidden super-admin console
  api/webhooks/ the one money ingestion path
components/gravity/  brand kit + per-domain UI
lib/          money, prize engine, auth, supabase clients, validators, data helpers
supabase/     SQL migrations + seeds
docs/         ROADMAP, SCHEMA, SETUP
```

---

Built with [Claude Code](https://claude.com/claude-code).
