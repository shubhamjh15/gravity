# GRAVITY — Build Roadmap

> **eSports Tournament & Community Management Platform**
> Indian Free Fire / BGMI / PUBG scene · Next.js 15 + Supabase + Razorpay
> Build model: **you (Comfortable) + Claude Code** · Running cost: **near-zero** until launch
> Scope: **EVERYTHING** — all 9 surfaces, Phases 0 → 6

This is the single source of truth for *what we build and in what order*. It merges the formal SRS (`GravityGameSRS.pdf`) with the concrete engineering plan (`GRAVITY-Project-Plan.pdf`). The Project Plan wins on every technical disagreement — it is the real build bible.

Companion docs:
- [`SCHEMA.md`](SCHEMA.md) — every table, column, and RLS rule
- [`SETUP.md`](SETUP.md) — how to create Supabase / Razorpay / Google accounts + env vars
- [`CLAUDE.md`](CLAUDE.md) — conventions + non-negotiables for every coding session

---

## 0. The 7 non-negotiable principles (read every session)

These are not style preferences. Violating any one of them is a bug, even if the app "works".

1. **Money is integer paise (`BIGINT`) everywhere.** Percentages in **basis points** (1% = 100 bps). Convert to ₹ only at the moment of display. Never use `float`/`number` for money in the DB or in business logic.
2. **One authorization source: the `user_roles` table** (a user can hold multiple roles). There is **no self-writable `role` column** anywhere. Spelling is `superadmin` (one word) everywhere, forever.
3. **One unified `ledger_entries` table.** Every rupee that moves — event entry, membership, sponsorship, store, payout, refund, fee — is exactly one row, written via a single `SECURITY DEFINER` RPC. The entire revenue dashboard is a `GROUP BY` on this one table.
4. **RLS on every table, deny-by-default.** The hidden admin URL is cosmetic; the real gate is Row-Level Security + server-side checks. The Supabase **service-role key must never reach the browser**.
5. **Settle money only from the signed Razorpay webhook**, never from the client. One ingestion path, one idempotency key (`razorpay_payment_id` UNIQUE).
6. **Sensitive PII (UPI, phone, gov-ID) lives in `profiles_private`** — no public view, no public RLS policy can ever reach it.
7. **Realtime is used deliberately** (chat, notifications, live slot counts) — never a per-visitor subscription on a hot public page (events list, leaderboard).

---

## 1. Tech stack (final)

| Layer | Choice | Notes |
|---|---|---|
| Frontend + API | **Next.js 15 (App Router) + TypeScript** | Server Actions / Route Handlers *are* the backend. No separate API server. |
| UI | **Tailwind CSS + shadcn/ui (themed) + Aceternity/Magic UI + Framer Motion** | Dark cinematic esports look — **Molten Crimson/Ember**. shadcn = functional base; Aceternity + Magic UI = the "wow" surfaces (hero, cards). Copy-paste registries → live in `components/gravity/`. Design-token driven, no AI-slop defaults. |
| Rich text | **Tiptap** | About page + long-form content. |
| DB / Auth / Storage / Realtime | **Supabase (Postgres)** | Google login, RLS, file storage, realtime. |
| Payments | **Razorpay** | Entry fees, memberships, store. Payouts **manual in v1** → RazorpayX in Phase 6. |
| Email / WhatsApp | **Resend** + WhatsApp (wa.me free, or Gupshup/Interakt paid) | Room ID + password delivery. |
| Hosting | **Vercel + Supabase Cloud** | Free tiers cover dev. Supabase Pro (~$25/mo) before launch. |
| Validation | **Zod** | Every server action validates input with a Zod schema before touching the DB. |
| Forms | **React Hook Form + Zod resolver** | |
| State (server) | **TanStack Query** (where client-side fetching is needed) | Most data fetching is server-component first. |
| Money helpers | Custom `lib/money.ts` | `paise ↔ rupees`, bps math, formatting. Single source. |

**Decision (flagged):** I will use the **Supabase JS client + raw SQL migrations**, *not* an ORM like Prisma. Reason: RLS, `SECURITY DEFINER` RPCs, and Postgres-native features (triggers, `pg_cron`, materialized views) are first-class in this design and fight ORMs. Migrations live in `supabase/migrations/*.sql`. If you'd prefer Drizzle (type-safe, SQL-first, RLS-friendly) say so before Phase 0 — that's the only ORM I'd consider here.

---

## 2. Repository / folder structure

```
gravity/
├── app/                          # Next.js App Router
│   ├── (public)/                 # unauthenticated + public pages
│   │   ├── page.tsx              # landing
│   │   ├── events/               # events list + [slug] detail
│   │   ├── communities/          # list + [slug]
│   │   ├── leaderboard/
│   │   ├── store/
│   │   ├── sponsors/
│   │   └── about/
│   ├── (player)/                 # authenticated player area
│   │   ├── profile/
│   │   ├── wallet/
│   │   └── my-tournaments/
│   ├── (organizer)/              # organizer dashboard (role-gated)
│   │   └── dashboard/
│   ├── (admin)/                  # hidden super-admin (env-obscured route + RLS)
│   │   └── [obscure-segment]/
│   ├── api/
│   │   └── webhooks/razorpay/    # the ONE money ingestion path
│   ├── auth/                     # callback, sign-in
│   └── layout.tsx                # root: theme, fonts, providers
├── components/
│   ├── ui/                       # shadcn primitives (themed)
│   └── gravity/                  # custom cards, shells, motion components
├── lib/
│   ├── supabase/                 # server client, browser client, middleware client
│   ├── money.ts                  # paise/bps/format — single source
│   ├── auth.ts                   # role helpers (server-side)
│   ├── razorpay.ts               # SDK wrapper
│   ├── email.ts                  # Resend wrapper
│   ├── whatsapp.ts               # wa.me / provider wrapper
│   └── validators/               # Zod schemas per domain
├── supabase/
│   ├── migrations/               # *.sql — the real schema
│   ├── seed.sql                  # games, settings, seeded superadmins
│   └── tests/                    # pgTAP / PostgREST negative tests per role
├── ROADMAP.md  SCHEMA.md  SETUP.md  CLAUDE.md
└── .env.local.example
```

**Module boundaries** (from SRS §8.2): auth · user · organizer · community · tournament · registration · wallet · payment · notification · reports · admin · store · sponsor · shared. Each domain owns its validators, server actions, and components.

---

## 3. The core money mechanic (understand before Phase 2)

There is **no official Free Fire / BGMI API** for third parties. So results are **screenshot-based and payouts are manual** (v1). The canonical flow:

1. Players register + pay entry fee (Razorpay → settle on webhook → slot reserved with TTL).
2. Organizer creates a custom in-game room → enters **Room ID + password** → system reveals it to *paid* players only (RLS) and emails/WhatsApps it.
3. Players play the match.
4. Organizer uploads the **final leaderboard screenshot** + types in rank / kills / amounts.
5. Prize engine computes payouts, validates the split equals the collected pool, posts results **provisional → published**.
6. Winnings transferred to winners' UPI (manual in v1, recorded in `payouts` + `ledger_entries`).
7. `player_stats` + `leaderboard_snapshots` refresh.

### The canonical prize test (must pass)
> **50 players × ₹40 = ₹2000 pool**
> → 1st **₹700** · 2nd **₹300** · 3rd **₹100** · per-kill **₹10** (cap **₹490**) · admin cut **₹110** · organizer profit **₹300**
> Check: `1100 + 490 + 110 + 300 = 2000` ✓

The prize engine validates that `Σ(rank prizes) + kill-budget-cap + admin cut + organizer profit == collected pool`. Under-fill (fewer than max players) is governed by `fill_policy` (scale-down vs guaranteed). Leftover kill budget governed by `kill_surplus_policy`. **These two policy defaults are an open question for the client — see §11.**

---

## 4. Phase-by-phase build plan

Each phase ships something usable. Ordered lowest-risk-first; money & social come after the foundation is proven. Every screen passes through `impeccable craft → polish → audit → detect` (the design-QA workflow — keeps it from looking vibecoded).

Status legend: ⬜ not started · 🟦 in progress · ✅ done

---

### PHASE 0 — Foundation & guardrails
**Goal: a secure skeleton everything hangs on.**

| # | Task | Detail | Status |
|---|---|---|---|
| 0.1 | Scaffold app | Next.js **16** + React 19 + TS + Tailwind v4 + Turbopack. shadcn/ui (17 primitives), Framer Motion, **GSAP+ScrollTrigger**. | ✅ |
| 0.2 | GRAVITY shell | Root layout: **Crimson/Ember** theme, Anton+Space Grotesk+JetBrains Mono fonts, custom nav + footer + cinematic landing (hero, surfaces, pinned how-it-works, CTA). | ✅ |
| 0.3 | Design tokens | Tailwind v4 `@theme` in `globals.css`: crimson/ember colors, 8px grid, glows, motion, custom utilities. **No orange/violet.** | ✅ |
| 0.4 | Supabase clients | Server (async cookies), service-role, browser factories. `proxy.ts` (Next-16 renamed middleware) session refresh. | ✅ |
| 0.5 | Google OAuth | `/login` + `/auth/callback` + `GoogleSignIn`. `handle_new_user` trigger creates profile + default role + stats. *(needs Supabase keys to run live)* | ✅ |
| 0.6 | Identity schema | Migration 0002: `profiles`, `profiles_private`, `user_roles`, `games`, `player_game_profiles`, `player_documents`, `player_stats`. | ✅ |
| 0.7 | Role helpers | SQL `has_role`/`is_superadmin`/`is_organizer` (SECURITY DEFINER). `lib/auth.ts` mirrors. | ✅ |
| 0.8 | Hidden admin gate | Migration 0005: `platform_admins` + `admin_sessions` (TOTP/IP/timeouts) + `ADMIN_URL_SEGMENT`. Seed runbook. | ✅ |
| 0.9 | Unified ledger | Migration 0004: `ledger_entries` + single `write_ledger_entry` SECURITY DEFINER RPC (idempotent) + indexes. | ✅ |
| 0.10 | Razorpay webhook | `app/api/webhooks/razorpay/route.ts`: raw-body HMAC verify + `webhook_events` idempotency + ledger settle. `lib/razorpay.ts`. | ✅ |
| 0.11 | RLS deny-by-default | Migrations 0003/0005/0006: RLS on every table, scoped policies, PII locked, storage buckets. *(CI coverage + negative tests: Phase 6)* | ✅ |
| 0.12 | Money lib | `lib/money.ts` — branded `Paise`/`Bps`, paise/bps math, INR formatting. **25 tests pass** incl. canonical split. | ✅ |

**Phase 0 deliverable:** ✅ Builds clean, typechecks, 25 tests pass. Landing + login render; schema + RLS + ledger RPC + webhook written. **To go fully live:** create Supabase + Google OAuth + Razorpay test keys (SETUP.md), push migrations, then auth + test-charge run end to end.

---

### PHASE 1 — Player profile + identity
**Goal: the player's home.**

| # | Task | Detail | Status |
|---|---|---|---|
| 1.1 | Profile edit | Banner, avatar, name, age, gender, email, phone, UPI, per-game Player IDs + IGN. PII fields write to `profiles_private`. | ⬜ |
| 1.2 | Completion meter | `profile_completion_pct` **derived/computed**, not hand-maintained. Drives a progress UI. | ⬜ |
| 1.3 | Per-game profiles | `player_game_profiles`: in-game ID, IGN, ranking, kill-ratio, win-ratio per title. | ⬜ |
| 1.4 | Earnings + stats | Previous earnings read from `ledger_entries`; kill/win ratio + matches from `player_stats`. | ⬜ |
| 1.5 | Document upload | Gov-ID + proof-of-skill → **private bucket**, short-TTL signed URLs. Review state in `player_documents`. | ⬜ |
| 1.6 | Public profile | Public view of a player; **all sensitive fields hidden** (enforced by RLS, not just UI). | ⬜ |

Build each via `impeccable craft → polish → audit`.

---

### PHASE 2 — Events + registration + prize/results (THE CORE LOOP)
**Goal: run a real paid tournament end to end.** This is the heart of the product — give it the most care.

| # | Task | Detail | Status |
|---|---|---|---|
| 2.1 | Events schema | `events` (+ `registration_schema` jsonb, status enum, room fields, community FK), `registrations` (payment lifecycle + slot TTL + `form_data` jsonb), `prize_structures`, `event_results`, `payouts`. (SCHEMA.md §2–3.) | ⬜ |
| 2.2 | Events listing | Filter & search, upcoming + ongoing cards, **Archives**. Server-rendered; no per-visitor realtime. | ⬜ |
| 2.3 | Event create (organizer) | Custom banner, info, Do's & Don'ts, Rules, **dynamic registration fields** (jsonb schema), paid/free + entry fee, public/private identity, slots, referral codes, gov-ID/elite-pass toggles. | ⬜ |
| 2.4 | Event detail page | Dedicated page with multiple join CTAs (card + page). Live slot count via deliberate realtime. | ⬜ |
| 2.5 | Register + pay | Razorpay order → checkout → **settle on webhook** → slot reservation vs oversell guard (atomic). Free events skip payment. | ⬜ |
| 2.6 | Prize-pool engine | Compute rank prizes + per-kill (with cap) + admin cut + organizer profit. **Validate split == collected pool.** Handle `fill_policy` under-fill. Make the canonical 50×₹40 test pass. | ⬜ |
| 2.7 | Room credentials | Organizer enters Room ID + password → revealed to **paid players only** (RLS) → emailed (Resend) + WhatsApped. `room_released_at` stamped. | ⬜ |
| 2.8 | Results upload | Upload leaderboard **screenshot** (private bucket) + enter rank/kills → engine computes amounts → provisional → publish on event + community page. | ⬜ |
| 2.9 | Payouts worklist | Organizer/admin sees winners + UPI + amount. Manual mark-as-paid with **duplicate-payout guard**. Writes `payouts` + `ledger_entries`. | ⬜ |
| 2.10 | Organizer ledger view | That organizer's transaction history (own data only, RLS-enforced). | ⬜ |

**Phase 2 deliverable:** An organizer creates an event, players pay to join, the organizer releases the room, uploads results, and winners get paid — all recorded in the one ledger.

---

### PHASE 3 — Communities + memberships + social
**Goal: the community half of the platform.**

| # | Task | Detail | Status |
|---|---|---|---|
| 3.1 | Communities schema | `communities`, `community_members`, `memberships`, `community_posts`, `community_gallery`, `elite_policies`. (SCHEMA.md §4.) | ⬜ |
| 3.2 | Communities listing → page | About, location, rules, gallery, that community's games & events. | ⬜ |
| 3.3 | Join flow | Paid/unpaid, with/without approval; shareable **invite link** (`invite_slug`). Lifecycle: pending/active/banned/left. | ⬜ |
| 3.4 | Memberships | Admin sets cost → Razorpay → ledger. **Community monthly earning dashboard** (events + memberships). | ⬜ |
| 3.5 | Chat schema + UI | `chat_channels`, `chat_members`, `chat_messages` (Supabase **Realtime**). Per-community channels + ad-hoc small groups. | ⬜ |
| 3.6 | 1-v-1 match invites | `match_invites`: invite / accept / decline. (Open Q: coordination only, or stakes?) | ⬜ |
| 3.7 | Elite policies | Gov-ID + kill-ratio proof → elite approval workflow. Role `member`/`elite`. | ⬜ |
| 3.8 | Community admin tools | Per-community announcements; organizer edits all community + event content; community-scoped referral codes. | ⬜ |

---

### PHASE 4 — Leaderboard + Sponsors + About
**Goal: the discovery / marketing surfaces.**

| # | Task | Detail | Status |
|---|---|---|---|
| 4.1 | Leaderboard schema | `leaderboard_snapshots`: materialized rankings by kill-ratio / win-ratio / net-earnings × scope (event/community/global) × period (daily/monthly/yearly). | ⬜ |
| 4.2 | Leaderboard UI | Filterable by event / overall / community / daily / monthly / yearly. Reads snapshots (not live aggregation on hot path). | ⬜ |
| 4.3 | Snapshot refresh | Cron (`pg_cron` / Vercel Cron) + refresh on result-lock. | ⬜ |
| 4.4 | Sponsors | `sponsors` directory + `sponsorship_requests` form → routed to super-admin + targeted community admin → published. Sponsorship money → ledger. | ⬜ |
| 4.5 | About page | `about_pages` (Tiptap JSON) + gallery + company details. Super-admin edits; public read. | ⬜ |

---

### PHASE 5 — Store (e-commerce, super-admin managed)
**Goal: the shop.**

| # | Task | Detail | Status |
|---|---|---|---|
| 5.1 | Store schema | `store_products`, `store_categories`, `store_variants`, `store_product_images`, `store_inventory`, `store_carts`, `store_cart_items`, `store_orders`, `store_order_items`, `store_payment_schedule`, `store_payments`, `store_reviews`. (SCHEMA.md §7.) | ⬜ |
| 5.2 | Catalog | SKUs, inventory management (stock per variant, low-stock flags), MRP vs sale price, multi-photo, description, categories. | ⬜ |
| 5.3 | Cart + checkout | Server-side cart; discount + referral codes; checkout via Razorpay (hardened webhook → ledger). | ⬜ |
| 5.4 | Partial payment | Installment schedule; `amount_paid` derived from captured payments. | ⬜ |
| 5.5 | Orders + delivery | Manual delivery status. Verified-purchase reviews. | ⬜ |

---

### PHASE 6 — Super-Admin console + hardening + scale
**Goal: the control room + production readiness.**

| # | Task | Detail | Status |
|---|---|---|---|
| 6.1 | Super-admin console | Organizer control, players directory (**audited PII reveal**), featured placements, announcements, ledger monitoring, fallback-fee config, sponsorship inbox. | ⬜ |
| 6.2 | Revenue dashboard | Totals + by category (`source_type` fractions) + community-wise (`GROUP BY community_id`) + time-series. All from `ledger_entries`. | ⬜ |
| 6.3 | RazorpayX payouts | Automated payouts + reconciliation (replaces manual v1 worklist). | ⬜ |
| 6.4 | Materialized views | Heavy dashboard/leaderboard aggregations → matviews. Index ledger on `(created_at)`, `(source_type,status)`, `(community_id)`, `(event_id)`, `(user_id)`. | ⬜ |
| 6.5 | Cron jobs | Leaderboard refresh, slot-reservation TTL sweep, installment-overdue flags, archive old events. **Never rely on a sweep for correctness.** | ⬜ |
| 6.6 | Final hardening | `/impeccable harden` across all surfaces; final audit + detect pass; Supabase Pro upgrade before launch; WebP transcode for uploads. | ⬜ |

---

## 5. Cross-cutting systems (built incrementally across phases)

- **Notifications (+ Realtime bell):** registration confirmed, room released, results published, payout sent, order/membership updates, admin announcements. (`notifications` table, started Phase 2.)
- **Room-credential delivery:** in-app (RLS-gated) + email (Resend) + WhatsApp (wa.me link or provider).
- **Cron:** leaderboard snapshots, slot-TTL sweep, installment-overdue flags, archive old events.
- **Storage buckets:** `avatars`/`banners` (public); `gov-id`/`skill-proof`/`leaderboard-screenshots` (private, signed URLs); `store-images`; `community-gallery`.
- **Search/filter:** events + communities + store + leaderboard all get filter/search bars.
- **Audit log:** `audit_log` append-only for every privileged action (login, role change, wallet credit/debit, prize, refund, withdrawal, admin override).

---

## 6. Acceptance criteria (the product is "done" when…)

**Player:** register + log in · complete profile · discover communities & tournaments · register for tournaments · complete payments · receive notifications · view participation history · receive prize credits.

**Organizer:** register + become verified · create communities · publish tournaments · manage registrations · schedule/run matches · publish results · distribute prizes · track financial transactions · download reports.

**Super Admin:** verify organizers · manage users · monitor tournaments · review financial activity · configure platform settings · access reports + audit logs · manage inventory & e-commerce.

---

## 7. Non-functional bar (from SRS §7)

- Page response < 3s normal; login/registration/payment-verify < 2s (excl. gateway).
- Initial scale target: 500+ concurrent users, 100+ concurrent registrations, 50+ simultaneous tournament updates.
- Pagination on **all** list APIs. Large reports async/materialized.
- Atomic financial transactions; idempotent payment confirmation; no duplicate registrations from repeated requests.
- JWT auth (Supabase) + RBAC + server-side validation on every protected action. Rate limiting + account lockout. HTTPS in prod. Secrets in env only.
- Standardized API response shape: `{ success, message, data }` / `{ success, message, errors }`.

---

## 8. Free-tier reality & cost

- Supabase free tier **pauses after ~7 days idle**, ~500MB DB / 1GB storage / capped Realtime → upgrade to **Pro (~$25/mo) before launch**. Transcode uploads to **WebP**.
- No always-on cron on free tier → use **`pg_cron` / Vercel Cron from day one**; never rely on a sweep for correctness.
- Vercel function limits → heavy aggregations go to **materialized views**.
- **Net running cost:** domain (~₹800/yr) + Supabase Pro (~$25/mo) + optional WhatsApp provider. Razorpay is per-transaction. **The ₹10k is yours.**

---

## 9. Honest scope warning

The full scope (all 9 surfaces) is a **large** build — realistically months of focused work even with Claude Code generating code. The plan is ordered so **Phases 0→2 alone = a working, demoable, paid tournament platform** — that's the valuable spine. We build in that order so there is always something real to show. Don't let "EVERYTHING" stop us from shipping the core first.

---

## 10. Suggested working rhythm

1. One phase at a time. Within a phase, one task at a time, top to bottom.
2. Schema migration first, then server actions + validators, then UI, then `impeccable` polish/audit.
3. Commit per task (small, reviewable). Branch per phase (`feature/phase-2-events`).
4. After each money-touching task: re-run the ledger + RLS negative tests.
5. Keep this file's status column updated as we go.

---

## 11. Open questions for the client (answer before the relevant phase)

| Area | Question | Needed by |
|---|---|---|
| Prize / economics | Under-fill default: **scale-down vs guaranteed**? Where does leftover kill-budget go? Exact fee values (own-gateway vs fallback; admin cut absolute or %)? Razorpay **single account vs Route per organizer**? | Phase 2 |
| Communities / social | Chat free-form or moderated? Group-size cap? Are 1-v-1 invites just coordination, or mini-events **with stakes**? | Phase 3 |
| Store | Physical only or digital too? Shipping zones at launch or stubbed? Partial payment = fixed installments or pay-anything? | Phase 5 |
| Memberships / sponsors | Membership recurring or one-time? Sponsorship pricing fixed or per-deal? | Phase 3 / 4 |
| Results | Player **dispute window** (recommended), or organizer's published result is final? | Phase 2 |
| Ops | Number of launch superadmins; admin URL static vs rotatable; WhatsApp via provider (paid) vs wa.me links (free)? | Phase 0 / 2 |

---

*GRAVITY — Build Roadmap · derived from SRS v1.0 + Project Plan v2.0 · built with Claude Code.*
