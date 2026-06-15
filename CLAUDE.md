@AGENTS.md

# GRAVITY — project rules (read every session)

Full plan lives one level up: `../ROADMAP.md`, `../SCHEMA.md`, `../SETUP.md`, `../CLAUDE.md`.
Product source of truth = the two PDFs (`../GRAVITY-Project-Plan.pdf` wins over `../GravityGameSRS.pdf` on technical conflicts).

## Stack actually installed
Next.js **16.2.9** (App Router) · React **19.2** · Tailwind **v4** · TypeScript 5 · Turbopack (default).
Adding: shadcn/ui (themed), Aceternity UI + Magic UI (3D/animated, copy-paste → `components/gravity/`), Framer Motion, **GSAP + ScrollTrigger** (via `@gsap/react` `useGSAP`), Supabase, Razorpay, Zod, React Hook Form, Resend, Vitest.

## Animation split (use the right tool)
- **GSAP + ScrollTrigger** = scroll-driven cinema: pinned sections, scrub, reveal-on-scroll, parallax, hero sequences. ALWAYS via the `useGSAP()` hook from `@gsap/react` (auto-cleanup, React-19 safe) and scope selectors to a `ref` container. Register plugins client-side only. Keep it CLEAN — purposeful, not gratuitous; respect `prefers-reduced-motion`.
- **Framer Motion** = component interactions: hovers, taps, layout animations, page/exit transitions.
- Both coexist. Use `components/gravity/scroll/` for reusable GSAP wrappers (Reveal, Parallax, Pin).

## ⚠️ Next.js 16 breaking changes — DO NOT get these wrong
1. **`cookies()`, `headers()`, `draftMode()` are async** — always `await`. Same for **`params`/`searchParams`** in pages/layouts/routes/metadata. This is critical for the Supabase server + middleware clients.
2. **`middleware.ts` is now `proxy.ts`** — export a function named `proxy` (runtime is `nodejs`, no edge). The Supabase session-refresh lives here.
3. **Turbopack is default** — no `--turbopack` flag in scripts.
4. **`next lint` removed** — run ESLint CLI directly; `next build` does not lint.
5. **`images.domains` deprecated → `images.remotePatterns`** (needed for Supabase storage image URLs).
6. **`next typegen`** generates `PageProps<'/route'>`, `LayoutProps<>`, `RouteContext<>` — use them for typed async params.
7. `serverRuntimeConfig`/`publicRuntimeConfig` removed → env vars only. `revalidateTag` needs a 2nd arg (cacheLife profile).

## Design — Molten Crimson / Ember (LOCKED)
- Base blood-black `#0B0A0C`, panel `#16121A`, accent **crimson→ember** `#FF2D55 → #FF6A3D`, text `#F5F5F7`, muted `#7A7480`. **Single accent family.** Admin side = cooler/desaturated shade of the same family (not a second hue).
- **NO orange/violet. NO generic AI-slop UI.** Tokens for everything — no hardcoded hex/px. Themed shadcn (not defaults). One reused component set.
- **Animated 3D + cinematic motion** on hero/cards/leaderboard (Aceternity/Magic UI + Framer Motion). Tasteful, purposeful — never gratuitous. Real empty/loading/error states on every screen. Responsive + accessible. 8px grid. Accent-only glows, hairline borders.
- Run `npx impeccable detect <path>` before shipping each screen; fix what it flags.

## Functionality first
Every feature must actually work end-to-end — not a pretty shell. Pretty + broken = broken. Money paths must be correct, atomic, idempotent, and tested before they're "done."

## The 7 non-negotiables
1. Money = `BIGINT` paise; percentages = basis points; rupees only at display. No floats for money.
2. `user_roles` is the only authz source. No self-writable `role` column. Spelling `superadmin`.
3. One `ledger_entries` table; every rupee = one row via `write_ledger_entry` SECURITY DEFINER RPC.
4. RLS on every table, deny-by-default. Service-role key never reaches the browser.
5. Money settles only from the signed Razorpay webhook. One ingestion path, one idempotency key.
6. PII (UPI/phone/gov-ID) in `profiles_private`; no public policy reaches it; superadmin reads audited.
7. Realtime only where deliberate (chat, notifications, live slots) — never per-visitor on hot pages.

## Per-task order (anti-bug)
migration → Zod validators → server action/route → UI → impeccable polish/audit. Validate every input with Zod. Commit per task. Update `../ROADMAP.md` status. Re-run ledger+RLS tests after any money change. `/code-review` before a phase is done; `/security-review` before any money/auth phase.

## Money helper
`lib/money.ts` is the only place paise↔rupees + bps math happens. Never inline `/100` or `*100`.
