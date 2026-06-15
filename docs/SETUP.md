# GRAVITY — Setup & Accounts Guide

> You don't have any service accounts yet, and that's fine. We build **local-first / against mocks** and wire each real service in at the moment its phase needs it. This doc lists exactly what to create, when, and which env vars each produces.

---

## Local prerequisites (already verified ✅)

| tool | version on this machine |
|---|---|
| Node.js | v22.14.0 |
| npm | 11.2.0 |
| git | 2.46.1 |

Recommended (optional but nice):
- **Supabase CLI** — `npm i -g supabase` — for local DB + running migrations.
- **Docker Desktop** — only if you want to run Supabase *fully* locally (`supabase start`). Not required if we develop against a cloud Supabase free project.

---

## The env file

We keep `.env.local` (gitignored, real secrets) and commit `.env.local.example` (placeholder keys, safe). Full list, annotated by phase:

```bash
# ─── Phase 0: Supabase (DB / Auth / Storage / Realtime) ───
NEXT_PUBLIC_SUPABASE_URL=            # public — project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # public — anon key (RLS-limited, safe in browser)
SUPABASE_SERVICE_ROLE_KEY=           # SECRET — server only, NEVER ships to browser

# ─── Phase 0: Hidden super-admin gate ───
ADMIN_URL_SEGMENT=                   # obscure random string, e.g. "ctrl-9f3a8b2c1d"
# (TOTP secrets + IP allowlist live in DB tables platform_admins/admin_sessions)

# ─── Phase 0: Razorpay (payments) ───
RAZORPAY_KEY_ID=                     # test mode first (rzp_test_...)
RAZORPAY_KEY_SECRET=                 # SECRET — server only
RAZORPAY_WEBHOOK_SECRET=             # SECRET — for HMAC verification of webhooks

# ─── Phase 1/2: Email (Resend) ───
RESEND_API_KEY=                      # SECRET — room creds + notifications

# ─── Phase 2: WhatsApp (room credential delivery) ───
# v1: free wa.me links → no key needed.
# Later: provider (Gupshup/Interakt):
WHATSAPP_PROVIDER_API_KEY=           # optional, SECRET

# ─── App ───
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Golden rule:** anything starting `NEXT_PUBLIC_` is exposed to the browser. The `SERVICE_ROLE_KEY` and every `*_SECRET` must **never** be prefixed `NEXT_PUBLIC_` and must only be read in server code (server actions, route handlers).

---

## Service-by-service setup (do each when its phase arrives)

### 1. Supabase — needed at Phase 0
1. Go to **supabase.com** → sign in with GitHub → **New project**.
2. Pick a region close to India (**Mumbai / `ap-south-1`** if offered) for latency.
3. Set a strong DB password (save it).
4. **Project Settings → API**: copy `URL`, `anon` key, `service_role` key → into `.env.local`.
5. Free tier is enough for all dev. **Upgrade to Pro (~$25/mo) before public launch** (free tier pauses after ~7 days idle and caps storage/realtime).
6. We'll push schema via `supabase/migrations/*.sql` (CLI: `supabase db push`, or paste into the SQL editor early on).

### 2. Google OAuth — needed at Phase 0 (for "Login with Google")
1. **console.cloud.google.com** → new project (e.g. "GRAVITY").
2. **APIs & Services → OAuth consent screen** → External → fill app name, support email.
3. **Credentials → Create OAuth client ID → Web application**.
4. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows the exact URI in **Auth → Providers → Google**).
5. Copy **Client ID + Client Secret** → paste into **Supabase → Auth → Providers → Google** → enable.
   (These live in Supabase, not in `.env.local`.)

### 3. Razorpay — needed at Phase 0 (plumbing) / Phase 2 (real use)
1. **razorpay.com** → sign up. You can use **Test Mode immediately** without full KYC.
2. **Settings → API Keys → Generate Test Key** → `RAZORPAY_KEY_ID` (`rzp_test_…`) + secret.
3. **Settings → Webhooks → Add** → URL = `https://<your-app>/api/webhooks/razorpay` (for local dev use a tunnel — see below). Select events: `payment.captured`, `payment.failed`, `order.paid`. Set a secret → `RAZORPAY_WEBHOOK_SECRET`.
4. **Going live** (later) requires business KYC (PAN, bank, GST optional). Test mode is fine for the entire build; only real payouts need a live account + RazorpayX (Phase 6).

**Local webhook testing:** Razorpay can't reach `localhost`. Use a tunnel:
```bash
npx localtunnel --port 3000        # or ngrok http 3000
```
Point the Razorpay webhook at the tunnel URL during dev.

### 4. Resend (email) — needed at Phase 1/2
1. **resend.com** → sign up → **API Keys → Create** → `RESEND_API_KEY`.
2. Add + verify a sending domain (or use their test/onboarding domain for dev).
3. Free tier: generous for dev (thousands/month).

### 5. WhatsApp — Phase 2
- **v1 (free):** generate `https://wa.me/<number>?text=<url-encoded room creds>` links. No account needed.
- **Later (automated):** Gupshup or Interakt → API key → `WHATSAPP_PROVIDER_API_KEY`. Paid. Decide at Phase 2 (it's an open client question).

### 6. Vercel (hosting) — when we first deploy (end of Phase 0/1)
1. **vercel.com** → import the GitHub repo.
2. Add all `.env.local` vars to **Project → Settings → Environment Variables**.
3. Auto-deploys on push to `main`. Preview deploys per branch.

---

## First-run commands (after Phase 0 scaffold)

```bash
cd gravity
npm install
cp .env.local.example .env.local     # then fill in real keys
npm run dev                           # http://localhost:3000
```

Running migrations (once Supabase CLI is linked):
```bash
supabase link --project-ref <ref>
supabase db push                      # applies supabase/migrations/*.sql
supabase db reset                     # local: wipe + re-apply + seed (DESTRUCTIVE)
```

---

## What you need to do vs what I do

| You (human, in a browser) | Me (Claude Code) |
|---|---|
| Create the Supabase project, copy 3 keys | Write all migrations, RLS, RPCs |
| Set up Google OAuth client, paste into Supabase | Wire the auth flow + role helpers |
| Generate Razorpay test keys + webhook secret | Build order creation + webhook handler |
| Create Resend key | Build email templates + sending |
| Paste keys into `.env.local` (and Vercel later) | Everything else — UI, logic, tests |

I'll tell you **exactly** which keys I need and when. Until you have them, I build against mocks so we never block.

---

## Security checklist (revisit before launch)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` never appears in client bundle (grep the build).
- [ ] Every table has RLS enabled (CI check).
- [ ] Money settles only from the verified Razorpay webhook.
- [ ] `profiles_private` unreachable by any public policy.
- [ ] ≥2 superadmins seeded + break-glass runbook written.
- [ ] `.env.local` is gitignored; only `.env.local.example` is committed.
- [ ] HTTPS enforced in production (Vercel does this).
- [ ] Rate limiting on auth + payment endpoints.

---

*GRAVITY — Setup Guide. Keep `.env.local.example` in sync as new vars are added.*
