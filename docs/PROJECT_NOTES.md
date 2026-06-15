# CLAUDE.md — GRAVITY project conventions

> Read this at the start of every session. It encodes the non-negotiables and the discipline that keeps this a **production-ready, bug-free** money platform. Source of truth for *what to build* = [`ROADMAP.md`](ROADMAP.md) + [`SCHEMA.md`](SCHEMA.md). Source of truth for *the product* = the two PDFs (`GRAVITY-Project-Plan.pdf` wins over `GravityGameSRS.pdf` on technical conflicts).

## What we're building
GRAVITY — a 3-role (Player / Organizer / Superadmin) eSports tournament + community + store platform for the Indian Free Fire / BGMI / PUBG scene. Real money via Razorpay. Next.js 15 + Supabase + Razorpay. Full scope, all 7 phases, built **phase by phase, one task at a time, production-ready.**

## The 7 non-negotiables (never violate)
1. **Money = `BIGINT` paise.** Percentages = basis points. Rupees only at display. No floats for money, anywhere.
2. **`user_roles` is the only authz source.** No self-writable `role` column. Spelling: `superadmin`.
3. **One `ledger_entries` table.** Every rupee = one row via the `write_ledger_entry` `SECURITY DEFINER` RPC. Never `INSERT` into it directly from app code.
4. **RLS on every table, deny-by-default.** Service-role key never reaches the browser. Hidden admin URL is cosmetic — RLS is the real gate.
5. **Money settles only from the signed Razorpay webhook.** One ingestion path, one idempotency key (`razorpay_payment_id` UNIQUE).
6. **PII (UPI/phone/gov-ID) in `profiles_private`.** No public policy may reach it. Superadmin PII reads are audited.
7. **Realtime only where deliberate** (chat, notifications, live slots). Never per-visitor on hot public pages.

## How we work (the anti-bug discipline)
- **One phase at a time, one task at a time**, top-to-bottom per `ROADMAP.md`. Don't jump ahead.
- **Per task, in this order:** (1) SQL migration, (2) Zod validators, (3) server action / route handler, (4) UI, (5) `impeccable` polish + audit.
- **Every server action validates input with Zod** before touching the DB. Reject malformed input.
- **Every money path is idempotent and atomic.** Slot reservation, payment capture, payout — all guard against double-execution and races.
- **Write the test with the code**, especially for: prize-split math, RLS per role, webhook idempotency, slot oversell. The canonical prize test (50×₹40=₹2000) must pass.
- **Commit per task** — small, reviewable. **Branch per phase** (`feature/phase-N-...`).
- **Update the status column** in `ROADMAP.md` as tasks complete.
- After any money-touching change, **re-run ledger + RLS negative tests.**
- Run `/code-review` before considering a phase done. Run `/security-review` before any phase that touches money or auth.

## Conventions
- **TypeScript strict.** No `any` in business logic. Money values are branded (`Paise` type) to prevent unit mistakes.
- **Server Components first.** Client components only where interactivity demands. `'use client'` is a deliberate choice, not a default.
- **Design tokens for everything** — no hardcoded hex or px (anti-vibecoded rule). Themed shadcn, one reused component set, tasteful Framer Motion, responsive + accessible. Real empty/loading/error states on every screen.
- **Colors (LOCKED — Molten Crimson/Ember):** blood-black base (`#0B0A0C`), raised panels (`#16121A`), **crimson→ember accent** (`#FF2D55 → #FF6A3D`), text `#F5F5F7` / muted `#7A7480`. Single disciplined accent family — high-stakes combat / cinematic. **NO orange-violet, NO generic AI palette.** Accent-only glows; hairline borders; 8px grid. Admin side uses a cooler/desaturated shade of the same family, not a second hue.
- **API response shape:** `{ success, message, data }` or `{ success, message, errors }`.
- **No business logic in the data-access layer or in UI.** It lives in server actions / service functions.
- **Soft delete** (`deleted_at`) for business entities. **Audit-log** every privileged action.

## Money helper (always use it)
`lib/money.ts` is the only place that converts paise↔rupees and does bps math. Never inline `/100` or `* 100`. Display with the formatter; store/compute in paise.

## Don't
- Don't put secrets in `NEXT_PUBLIC_*`.
- Don't trust the client for any money amount or role check.
- Don't add a `role` column to `profiles`.
- Don't use Postgres `enum` types (use `text` + `CHECK`).
- Don't hard-delete business data.
- Don't subscribe to Realtime on a public list/leaderboard page.
- Don't mark a task done without its migration + validation + test.

## Current status
- ✅ Planning docs written: `ROADMAP.md`, `SCHEMA.md`, `SETUP.md`, `CLAUDE.md`.
- 🔜 **Next: Phase 0 scaffold** (Next.js 15 + TS + Tailwind + shadcn + GRAVITY dark shell), then Phase 0 tasks 0.1 → 0.12.
