# GRAVITY — Database Schema Reference

> Postgres (Supabase). Every table has **RLS enabled, deny-by-default**. Money is **`BIGINT` paise**. IDs are **`uuid` default `gen_random_uuid()`**. Every business table carries the standard audit columns (below). Spelling is **`superadmin`** everywhere.

This is the authoritative data model. Migrations in `supabase/migrations/*.sql` must match this. When schema and code disagree, fix the code.

---

## Conventions

### Standard columns (every business/transactional table)
```sql
id           uuid        primary key default gen_random_uuid(),
created_at   timestamptz not null default now(),
created_by   uuid        references auth.users(id) on delete restrict,
updated_at   timestamptz not null default now(),   -- touched by trigger
updated_by   uuid        references auth.users(id),
deleted_at   timestamptz,                          -- soft delete; null = live
status       text,                                 -- domain-specific enum (text + CHECK)
remarks      text
```
- **Soft delete** (`deleted_at`) for all business entities. Hard delete only for cache/temp.
- **UUID PKs** everywhere practical.
- **FKs** `ON DELETE RESTRICT` for anything money-adjacent; `ON DELETE CASCADE` only for owned child rows (e.g. cart items).
- Enums are **`text` + `CHECK` constraint** (or a lookup table), **never** Postgres `enum` types — they're painful to alter. (Exception noted where used.)
- `updated_at` maintained by a shared `set_updated_at()` trigger.

### Role helpers (SQL, `SECURITY DEFINER`, used in RLS policies)
```sql
has_role(uid uuid, role text) -> boolean      -- EXISTS in user_roles
is_superadmin(uid uuid)        -> boolean      -- has_role(uid,'superadmin')
is_organizer(uid uuid)         -> boolean      -- has_role(uid,'organizer')
owns_community(uid, cid)       -> boolean      -- organizer owns community
is_event_paid_participant(uid, eid) -> boolean -- registered + paid (gates room creds)
```

---

## 1. Identity domain

### `profiles` — public-safe identity (1:1 with `auth.users`)
| column | type | notes |
|---|---|---|
| id | uuid PK | **= `auth.users.id`** (not generated) |
| display_name | text | |
| avatar_path | text | public bucket |
| banner_path | text | public bucket |
| age | int | CHECK 13–100 |
| gender | text | CHECK in (male,female,other,undisclosed) |
| email | text | mirror of auth email (public-safe) |
| profile_completion_pct | int | **derived**, recomputed by trigger/function; 0–100 |
| + standard columns | | **no `role` column, ever** |

**RLS:** public `SELECT` (live rows only). `UPDATE` only `WHERE id = auth.uid()`. `INSERT` only via `handle_new_user` trigger.

### `profiles_private` — sensitive PII (owner/superadmin only)
| column | type | notes |
|---|---|---|
| user_id | uuid PK FK→profiles.id | |
| upi_id | text | payout target |
| phone | text | |
| gov_id_type | text | aadhaar/pan/dl/… |
| gov_id_doc_path | text | **private bucket** |
| kyc_status | text | CHECK pending/verified/rejected |

**RLS:** `SELECT`/`UPDATE` only `WHERE user_id = auth.uid() OR is_superadmin(auth.uid())`. **No public view may join this table.** Superadmin reads are written to `audit_log` (audited PII reveal).

### `user_roles` — the one authorization source
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→profiles.id | |
| role | text | CHECK in (player, organizer, superadmin) |
| granted_by | uuid FK→auth.users | |
| UNIQUE (user_id, role) | | |

**RLS:** `SELECT` own rows or superadmin. **`INSERT`/`UPDATE`/`DELETE` superadmin only** (organizer elevation is an admin action). `player` is implicit/default — still stored so checks are uniform.

### `games` — title lookup (FK, not enum)
`id, slug (free_fire|bgmi|pubg|…), name, icon_path, is_active`. **RLS:** public read; superadmin write.

### `player_game_profiles` — per-game identity
`id, user_id, game_id, in_game_id, ign, ranking, kill_ratio numeric, win_ratio numeric, skill_proof_path (private)`. UNIQUE (user_id, game_id). **RLS:** owner write; public read of non-sensitive cols.

### `player_documents` — uploads + review
`id, user_id, doc_type (gov_id|skill_proof|kill_ratio_proof|elite_pass_proof), file_path (private bucket), review_status (pending|approved|rejected), reviewed_by`. **RLS:** owner read/insert; superadmin/community-admin review.

### `player_stats` — aggregated, computed
`user_id PK, total_kills bigint, total_wins bigint, total_matches bigint, net_earnings_paise bigint`. **Feeds leaderboard + profile. Never hand-edited** — updated by result-lock + cron. **RLS:** public read.

---

## 2. Money / commerce engine

### `prize_structures` — per-event economics
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK→events | one per event |
| entry_fee_paise | bigint | 0 = free |
| rank_prizes_paise | jsonb | `{ "1":70000, "2":30000, "3":10000 }` (paise) |
| per_kill_paise | bigint | e.g. 1000 = ₹10 |
| kill_budget_cap_paise | bigint | e.g. 49000 = ₹490 |
| admin_cut_paise | bigint | platform take |
| organizer_profit_paise | bigint | |
| fill_policy | text | CHECK scale_down / guaranteed |
| kill_surplus_policy | text | CHECK to_organizer / to_admin / to_prize / destroy |

**Validation (engine, not just DB):** `Σ(rank_prizes) + kill_budget_cap + admin_cut + organizer_profit == max_slots × entry_fee`. The canonical 50×₹40 test must pass.

### `event_results` — final standings
`id, event_id, user_id, rank int, kills int, amount_paid_paise bigint, leaderboard_screenshot_path (private), status (provisional|published)`. **RLS:** public read when published; organizer/admin write.

### `payouts` — winner payout records
`id, event_id, user_id, upi_id, amount_paise, status (pending|paid|failed), utr text, approved_by, ledger_entry_id FK`. **RLS:** owner read own; organizer/admin manage. **Duplicate-payout guard:** UNIQUE (event_id, user_id) partial WHERE status='paid'.

### `webhook_events` — Razorpay idempotency
`id, razorpay_event_id text UNIQUE, payload jsonb, received_at, processed_at, processing_status`. The webhook handler **dedupes on `razorpay_event_id`**.

### `referral_codes` — consolidated discount/referral
`id, code text UNIQUE, kind (referral|discount), scope (community|event|store|global), scope_id uuid, discount_kind (pct|flat), discount_value int, max_uses, used_count, valid_from, valid_to, is_active`. **Atomic redemption via RPC** (no race on `used_count`).

---

## 3. Events

### `events` — the card + the page
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| community_id | uuid FK→communities | every event belongs to a community |
| game_id | uuid FK→games | |
| title | text | |
| slug | text UNIQUE | |
| banner_path | text | custom banner |
| description | text | |
| dos_and_donts | text | |
| rules | text | |
| registration_schema | jsonb | **dynamic registration fields** definition |
| entry_fee_paise | bigint | 0 = free |
| max_slots | int | |
| visibility | text | CHECK public/private |
| status | text | CHECK upcoming/ongoing/completed/archived |
| room_id | text | revealed only to paid players |
| room_password | text | revealed only to paid players |
| room_released_at | timestamptz | |
| starts_at, registration_closes_at | timestamptz | |

**RLS:** public read of public+published events; organizer writes own community's events. **`room_id`/`room_password` columns must not be selectable by the public** — enforce via a column-filtered view or a dedicated RPC `get_room_credentials(event_id)` gated on `is_event_paid_participant`.

### `registrations` — per-player registration + payment lifecycle
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK→events | |
| user_id | uuid FK→profiles | |
| status | text | CHECK slot_held/paid/confirmed/cancelled/refunded/waitlisted |
| slot_held_until | timestamptz | TTL reservation; swept by cron |
| form_data | jsonb | answers to `registration_schema` |
| razorpay_order_id | text | |
| ledger_entry_id | uuid FK | |
| UNIQUE (event_id, user_id) | | no duplicate registrations |

**RLS:** owner reads/creates own; organizer reads own event's. **Slot reservation is atomic** (count check + insert in one transaction / RPC) to prevent oversell.

---

## 4. Communities

### `communities`
`id, owner_id (organizer), name, slug UNIQUE, profile_pic_path, banner_path, about, location, address, rules, visibility (public/private), is_paid bool, requires_approval bool, membership_cost_paise bigint, invite_slug text UNIQUE, is_featured bool [admin-only], is_restricted bool [admin-only]`. **RLS:** public read public communities; owner writes own; `is_featured`/`is_restricted` writable by superadmin only.

### `community_members`
`id, community_id, user_id, status (pending/active/banned/left), role (member/elite), joined_via (direct/invite/paid)`. UNIQUE (community_id, user_id). **RLS:** member reads own membership; community owner manages members.

### `memberships` — paid membership records
`id, community_id, user_id, amount_paise, status, ledger_entry_id FK, period_start, period_end`. Feeds the community earning dashboard. (Open Q: recurring vs one-time.)

### `community_posts`
`id, community_id, author_id, body, event_id (nullable — "post about upcoming event"), pinned bool`. **RLS:** members read; author/owner write.

### `community_gallery`
`id, community_id, image_path, caption`. Organizer-managed.

### `elite_policies`
`id, community_id, requires_gov_id bool, min_kill_ratio numeric, rules text`. Governs elite approval (gov-ID + kill-ratio proof).

---

## 5. Community social (chat / groups / 1-v-1)

### `chat_channels`
`id, community_id (nullable for ad-hoc groups), kind (community/group/dm), name, created_by`.

### `chat_members`
`id, channel_id, user_id, role`. UNIQUE (channel_id, user_id). RLS gates message access.

### `chat_messages`
`id, channel_id, sender_id, body text, created_at`. **Supabase Realtime** on this table (deliberate). **RLS:** only channel members read/insert.

### `match_invites`
`id, from_user, to_user, game_id, status (invited/accepted/declined), proposed_at`. (Open Q: coordination only vs stakes.)

---

## 6. Leaderboard & sponsors

### `leaderboard_snapshots` — materialized rankings
`id, metric (kill_ratio/win_ratio/net_earnings), scope (event/community/global), scope_id uuid, period (daily/monthly/yearly), user_id, value numeric, rank int, snapshot_at`. **Refreshed by cron + on result-lock.** Read on the hot path (no live aggregation). **RLS:** public read.

### `sponsors`
`id, name, logo_path, details, community_id (nullable), published_by, is_active`. **RLS:** public read; admin/community-admin write.

### `sponsorship_requests`
`id, sponsor_name, contact, details, target_community_id (nullable), status (pending/approved/rejected/published), routed_to`. Form → routed to superadmin + targeted community admin → published as a `sponsors` row. Sponsorship money → `ledger_entries`.

---

## 7. Store + admin / governance

### Catalog
- `store_categories` — `id, name, slug, parent_id`
- `store_products` — `id, category_id, name, slug, description, mrp_paise, sale_price_paise, is_active`
- `store_variants` — `id, product_id, sku UNIQUE, name, price_paise`
- `store_product_images` — `id, product_id, image_path, sort_order`
- `store_inventory` — `id, variant_id, stock int, low_stock_threshold int` (low-stock flag = computed)

### Cart / orders / payments
- `store_carts` — `id, user_id` (server-side)
- `store_cart_items` — `id, cart_id, variant_id, qty` (CASCADE on cart)
- `store_orders` — `id, user_id, status, delivery_status (pending/shipped/delivered — manual), amount_paid_paise (derived from captured payments)`
- `store_order_items` — `id, order_id, variant_id, qty, unit_price_paise`
- `store_payment_schedule` — `id, order_id, due_paise, due_at, status` (partial-payment installments)
- `store_payments` — `id, order_id, schedule_id, razorpay_payment_id, amount_paise, status, ledger_entry_id`
- `store_reviews` — `id, product_id, user_id, rating int, body` — **verified-purchase only** (CHECK against a delivered order). UNIQUE (product_id, user_id).

**RLS:** catalog public read / superadmin write. Cart + orders + payments: owner reads own, superadmin manages all.

### Governance
- `platform_admins` — hidden-admin allowlist: `id, user_id, totp_secret, ip_allowlist text[], is_active`
- `admin_sessions` — hardened sessions: `id, admin_id, ip, expires_at, last_seen` (short timeouts)
- `announcements` — `id, scope (global/community/event), scope_id, title, body, active_from, active_to` → "Announcement from the Admin" banner
- `featured_placements` — `id, kind (event/community), target_id, reason (hype/deal), sort_order, active`
- `about_pages` — `id, content_json jsonb (Tiptap), gallery jsonb, company_details jsonb` — superadmin edited, public read
- `notifications` — `id, user_id, kind, title, body, link, read_at` — per-user feed (bell, Realtime). RLS: owner only.
- `audit_log` — **append-only**: `id, actor_id, action, target_table, target_id, before jsonb, after jsonb, ip, created_at`. No update/delete policy at all.
- `app_settings` — `key text PK, value jsonb` — fee defaults, fallback-gateway fee, membership defaults, maintenance mode, feature flags. Superadmin write; server reads.

---

## 8. The unified `ledger_entries` (the heart of the money system)

**Every rupee is one row here.** Written only via the `write_ledger_entry(...)` `SECURITY DEFINER` RPC — never a direct `INSERT` from app code.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| entry_type | text | CHECK **charge \| payout \| refund \| fee \| adjustment** |
| source_type | text | CHECK **event_entry \| membership \| sponsorship \| store \| prize \| platform_fee \| organizer_profit \| manual** — the dashboard category |
| direction | text | CHECK **in \| out \| internal** (internal = re-slice of already-counted money, excluded from gross) |
| amount_paise | bigint | **CHECK ≥ 0** |
| currency | text | default 'INR' |
| status | text | CHECK **pending \| captured \| settled \| failed \| reversed** |
| user_id | uuid FK | nullable, `ON DELETE RESTRICT` |
| community_id | uuid FK | nullable, RESTRICT |
| event_id | uuid FK | nullable, RESTRICT |
| registration_id | uuid FK | nullable, RESTRICT |
| store_order_id | uuid FK | nullable, RESTRICT |
| membership_id | uuid FK | nullable, RESTRICT |
| sponsor_id | uuid FK | nullable, RESTRICT |
| organizer_id | uuid FK | nullable, RESTRICT |
| razorpay_payment_id | text | **UNIQUE** on charge rows (idempotency) |
| related_entry_id | uuid FK→ledger_entries | links splits / refunds / payouts |
| fee_rate_applied_bps | int | basis points applied |
| meta | jsonb | |

### Dashboard queries (all from this one table)
```sql
-- Gross revenue
SELECT SUM(amount_paise) FROM ledger_entries
WHERE direction = 'in' AND status IN ('captured','settled');

-- Category fraction
SELECT source_type, SUM(amount_paise)
FROM ledger_entries
WHERE direction = 'in' AND status IN ('captured','settled')
GROUP BY source_type;            -- fraction = category / gross

-- Community-wise
SELECT community_id, SUM(amount_paise)
FROM ledger_entries
WHERE direction = 'in' AND status IN ('captured','settled')
GROUP BY community_id;
```

### Indexes (Phase 6, but plan now)
`(created_at)`, `(source_type, status)`, `(community_id)`, `(event_id)`, `(user_id)`, partial UNIQUE on `razorpay_payment_id`.

---

## 9. Storage buckets

| bucket | visibility | holds |
|---|---|---|
| `avatars` | public | profile avatars |
| `banners` | public | profile + event + community banners |
| `gov-id` | **private** | gov-ID docs (signed URL, short TTL) |
| `skill-proof` | **private** | proof-of-skill / kill-ratio proof |
| `leaderboard-screenshots` | **private** | result screenshots |
| `store-images` | public | product photos |
| `community-gallery` | public | gallery images |

All uploads transcoded to **WebP** (Phase 6 / before launch) to stay under free-tier storage.

---

## 10. Entity relationship (high level)

```
auth.users ─1:1─ profiles ─1:1─ profiles_private
   │                │
   │                ├─< user_roles            (player/organizer/superadmin)
   │                ├─< player_game_profiles >─ games
   │                ├─< player_documents
   │                └── player_stats (1:1, computed)
   │
organizer (role) ─< communities ─< community_members
                         │        ├─< memberships ───────┐
                         │        ├─< community_posts     │
                         │        ├─< community_gallery    │
                         │        ├─< chat_channels ─< chat_messages
                         │        └─< elite_policies        │
                         │                                  │
                         └─< events ─< registrations        │
                                  ├── prize_structures (1:1)│
                                  ├─< event_results          │
                                  └─< payouts ───────────────┤
                                                             │
store_* ───────────────────────────────────────────────────┤
sponsors / sponsorship_requests ───────────────────────────┤
                                                             ▼
                                                   ledger_entries  (one row per rupee)
                                                             │
                                          revenue dashboard = GROUP BY on this
```

---

*GRAVITY — Schema Reference · matches `supabase/migrations/`. Update both together.*
