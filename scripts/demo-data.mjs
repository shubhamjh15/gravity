#!/usr/bin/env node
/**
 * Seed realistic demo content so the product can actually be evaluated.
 *
 * An empty catalogue makes every screen render its empty state, which reads as
 * "broken" even when nothing is. This fills the shelves.
 *
 * Two rules it follows deliberately:
 *
 *  1. Everything goes through the REAL paths. Prize structures satisfy the
 *     engine's invariant (rank prizes + kill cap + admin cut + organizer profit
 *     == max_slots x entry_fee), variants get inventory rows, and results are
 *     inserted as 'published' so migration 0016's triggers fire and populate
 *     player_stats + the leaderboard for real. Nothing is faked into place.
 *
 *  2. It is REMOVABLE. Every row carries a marker, and `--clear` deletes
 *     exactly what this script created and nothing else. Demo data in a
 *     pre-launch database is normal; demo data you cannot get rid of is not.
 *
 * Usage:
 *   SUPABASE_DB_URL=... node scripts/demo-data.mjs            seed
 *   SUPABASE_DB_URL=... node scripts/demo-data.mjs --clear    remove it all
 */
import pg from "pg";

const MARK = "[demo]"; // stored in `remarks` / meta so --clear is exact
const clearing = process.argv.includes("--clear");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Set SUPABASE_DB_URL.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const money = (rupees) => Math.round(rupees * 100); // paise

async function main() {
  await client.connect();

  // The demo content is owned by the first superadmin — it has to belong to a
  // real account for RLS-scoped screens (dashboard, finance) to show anything.
  const { rows: owners } = await client.query(`
    select u.id, u.email from auth.users u
    join public.user_roles r on r.user_id = u.id and r.role = 'superadmin'
    order by u.created_at limit 1
  `);
  if (owners.length === 0) {
    console.error(
      "No superadmin found. Sign in once, then: npm run db:promote <email> superadmin",
    );
    process.exitCode = 1;
    return;
  }
  const owner = owners[0];

  if (clearing) {
    await clear();
    return;
  }

  console.log(`seeding demo content owned by ${owner.email}\n`);

  const { rows: games } = await client.query(
    `select id, slug from public.games order by slug`,
  );
  const gameId = (slug) => games.find((g) => g.slug === slug)?.id ?? games[0]?.id;

  // ---- communities --------------------------------------------------------
  const communities = [
    {
      name: "Mumbai Fire Squad",
      slug: "mumbai-fire-squad",
      about:
        "Bombay's oldest Free Fire scrim group. Nightly customs, weekend cash cups, zero tolerance for hacking.",
      location: "Mumbai, Maharashtra",
      paid: true,
      cost: money(99),
    },
    {
      name: "Delhi BGMI Collective",
      slug: "delhi-bgmi-collective",
      about:
        "Competitive BGMI for the NCR. We run tier-based lobbies so new players aren't fed to Conquerors on night one.",
      location: "New Delhi",
      paid: false,
      cost: 0,
    },
    {
      name: "South Side Snipers",
      slug: "south-side-snipers",
      about:
        "Bangalore + Chennai. Tactical squads, VOD reviews after every cup, and a genuinely friendly Discord.",
      location: "Bengaluru, Karnataka",
      paid: true,
      cost: money(149),
    },
  ];

  const communityIds = {};
  for (const c of communities) {
    const { rows } = await client.query(
      `insert into public.communities
         (owner_id, name, slug, about, location, visibility, is_paid,
          membership_cost_paise, invite_slug, created_by, remarks)
       values ($1,$2,$3,$4,$5,'public',$6,$7,$8,$1,$9)
       on conflict (slug) do update set about = excluded.about
       returning id`,
      [owner.id, c.name, c.slug, c.about, c.location, c.paid, c.cost, `inv-${c.slug}`, MARK],
    );
    communityIds[c.slug] = rows[0].id;

    await client.query(
      `insert into public.community_members (community_id, user_id, status, role, joined_via)
       values ($1,$2,'active','moderator','direct')
       on conflict (community_id, user_id) do nothing`,
      [rows[0].id, owner.id],
    );
  }
  console.log(`  communities: ${communities.length}`);

  // ---- tournaments --------------------------------------------------------
  // Each split satisfies the engine: ranks + killCap + adminCut + orgProfit
  // must equal max_slots * entry_fee, or publishing would be refused.
  const events = [
    {
      title: "Friday Night Free Fire Showdown",
      slug: "friday-night-ff-showdown",
      game: "free_fire",
      community: "mumbai-fire-squad",
      fee: money(40),
      slots: 50, // pool 2000
      status: "upcoming",
      days: 3,
      ranks: { 1: money(700), 2: money(300), 3: money(100) },
      perKill: money(10),
      killCap: money(490),
      admin: money(110),
      profit: money(300),
      desc: "The canonical Friday cup. 50 slots, ₹40 entry, ₹1,100 in rank prizes plus ₹10 per kill.",
    },
    {
      title: "BGMI Sunday Scrims — Tier 1",
      slug: "bgmi-sunday-scrims-t1",
      game: "bgmi",
      community: "delhi-bgmi-collective",
      fee: money(60),
      slots: 25, // pool 1500
      status: "ongoing",
      days: 0,
      ranks: { 1: money(600), 2: money(250), 3: money(150) },
      perKill: money(15),
      killCap: money(300),
      admin: money(80),
      profit: money(120),
      desc: "Tier-1 lobby only. Three maps, points carry across all three.",
    },
    {
      title: "South Side Snipers Monthly Cup",
      slug: "south-side-monthly-cup",
      game: "free_fire",
      community: "south-side-snipers",
      fee: money(100),
      slots: 20, // pool 2000
      status: "completed",
      days: -6,
      ranks: { 1: money(900), 2: money(400), 3: money(200) },
      perKill: money(20),
      killCap: money(300),
      admin: money(100),
      profit: money(100),
      desc: "The one everyone turns up for. Bigger buy-in, bigger top prize.",
    },
    {
      title: "Rookie Ladder — Free Entry",
      slug: "rookie-ladder-free",
      game: "bgmi",
      community: "delhi-bgmi-collective",
      fee: 0,
      slots: 64,
      status: "upcoming",
      days: 6,
      ranks: {},
      perKill: 0,
      killCap: 0,
      admin: 0,
      profit: 0,
      desc: "No entry fee, no cash prize — pure ladder points. Built for players new to competitive lobbies.",
    },
  ];

  const eventIds = {};
  for (const e of events) {
    const starts = new Date(Date.now() + e.days * 86400000).toISOString();
    const { rows } = await client.query(
      `insert into public.events
         (organizer_id, community_id, game_id, title, slug, description, rules,
          entry_fee_paise, max_slots, visibility, status, starts_at,
          registration_closes_at, created_by, remarks)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'public',$10,$11,$12,$1,$13)
       on conflict (slug) do update set description = excluded.description
       returning id`,
      [
        owner.id,
        communityIds[e.community],
        gameId(e.game),
        e.title,
        e.slug,
        e.desc,
        "No emulators. No teaming. Screenshot your final placement. Disputes close 30 minutes after results post.",
        e.fee,
        e.slots,
        e.status,
        starts,
        new Date(Date.now() + (e.days - 1) * 86400000).toISOString(),
        MARK,
      ],
    );
    eventIds[e.slug] = rows[0].id;

    if (e.fee > 0) {
      await client.query(
        `insert into public.prize_structures
           (event_id, entry_fee_paise, rank_prizes_paise, per_kill_paise,
            kill_budget_cap_paise, admin_cut_paise, organizer_profit_paise,
            fill_policy, kill_surplus_policy)
         values ($1,$2,$3::jsonb,$4,$5,$6,$7,'scale_down','to_organizer')
         on conflict (event_id) do nothing`,
        [rows[0].id, e.fee, JSON.stringify(e.ranks), e.perKill, e.killCap, e.admin, e.profit],
      );
    }
  }
  console.log(`  tournaments: ${events.length}`);

  // ---- store: products WITH variants + stock ------------------------------
  const products = [
    {
      name: "GRAVITY Jersey 2026",
      slug: "gravity-jersey-2026",
      mrp: money(1899),
      sale: money(1299),
      partial: true,
      desc: "Sublimated competition jersey. Breathable mesh panels, tapered fit, your tag on the back.",
      variants: [
        ["GV-JRSY-26-S", "Size S", money(1299), 12],
        ["GV-JRSY-26-M", "Size M", money(1299), 24],
        ["GV-JRSY-26-L", "Size L", money(1299), 18],
        ["GV-JRSY-26-XL", "Size XL", money(1349), 4],
      ],
    },
    {
      name: "Crimson Mousepad — XL",
      slug: "crimson-mousepad-xl",
      mrp: money(1499),
      sale: money(899),
      partial: false,
      desc: "900x400mm stitched-edge cloth pad. Low friction, holds its shape.",
      variants: [["GV-PAD-XL", "900 x 400mm", money(899), 40]],
    },
    {
      name: "Ember Hoodie",
      slug: "ember-hoodie",
      mrp: money(2799),
      sale: money(2199),
      partial: true,
      desc: "Heavyweight 380gsm fleece with an embroidered wordmark. Runs true to size.",
      variants: [
        ["GV-HOOD-M", "Size M", money(2199), 8],
        ["GV-HOOD-L", "Size L", money(2199), 6],
        ["GV-HOOD-XL", "Size XL", money(2249), 2],
      ],
    },
  ];

  let variantCount = 0;
  for (const p of products) {
    const { rows } = await client.query(
      `insert into public.store_products
         (name, slug, description, mrp_paise, sale_price_paise, is_active, allow_partial)
       values ($1,$2,$3,$4,$5,true,$6)
       on conflict (slug) do update set description = excluded.description
       returning id`,
      [p.name, p.slug, p.desc, p.mrp, p.sale, p.partial],
    );

    for (const [sku, name, price, stock] of p.variants) {
      const { rows: v } = await client.query(
        `insert into public.store_variants (product_id, sku, name, price_paise)
         values ($1,$2,$3,$4)
         on conflict (sku) do update set price_paise = excluded.price_paise
         returning id`,
        [rows[0].id, sku, name, price],
      );
      await client.query(
        `insert into public.store_inventory (variant_id, stock, low_stock_threshold)
         values ($1,$2,5)
         on conflict (variant_id) do update set stock = excluded.stock`,
        [v[0].id, stock],
      );
      variantCount += 1;
    }
  }
  console.log(`  products: ${products.length} (${variantCount} variants, all stocked)`);

  // ---- sponsors -----------------------------------------------------------
  const sponsors = [
    ["Redline Energy", "Fuel for the last circle. Official drink of the Friday cup."],
    ["NexusFiber Broadband", "Low-ping fibre across Mumbai, Delhi and Bengaluru."],
    ["Apex Peripherals", "Mice, pads and keyboards built for claw grip."],
  ];
  for (const [name, details] of sponsors) {
    await client.query(
      `insert into public.sponsors (name, details, published_by, is_active)
       values ($1,$2,$3,true)
       on conflict do nothing`,
      [`${name}`, `${details} ${MARK}`, owner.id],
    );
  }
  console.log(`  sponsors: ${sponsors.length}`);

  // ---- a finished tournament with published results ------------------------
  // Inserted as 'published' on purpose: migration 0016's triggers then compute
  // player_stats and rebuild the leaderboard for real, rather than us writing
  // those tables by hand.
  const finishedId = eventIds["south-side-monthly-cup"];
  const { rows: players } = await client.query(
    `select id from public.profiles order by created_at limit 2`,
  );

  if (finishedId && players.length > 0) {
    const placements = [
      { rank: 1, kills: 11, amount: money(900) },
      { rank: 2, kills: 7, amount: money(400) },
    ];
    for (let i = 0; i < Math.min(players.length, placements.length); i++) {
      const p = placements[i];
      await client.query(
        `insert into public.registrations (event_id, user_id, status, form_data)
         values ($1,$2,'confirmed','{}'::jsonb)
         on conflict (event_id, user_id) do nothing`,
        [finishedId, players[i].id],
      );
      await client.query(
        `insert into public.event_results
           (event_id, user_id, rank, kills, amount_paid_paise, status)
         values ($1,$2,$3,$4,$5,'published')
         on conflict (event_id, user_id) do update
           set rank = excluded.rank, kills = excluded.kills, status = 'published'`,
        [finishedId, players[i].id, p.rank, p.kills, p.amount],
      );
    }
    console.log(`  published results: ${Math.min(players.length, 2)} (triggers stats + leaderboard)`);
  }

  const { rows: lb } = await client.query(
    `select count(*)::int n from public.leaderboard_snapshots`,
  );
  console.log(`\n  leaderboard rows now: ${lb[0].n}`);
  console.log("\nDone. Remove it all with: node scripts/demo-data.mjs --clear");
}

async function clear() {
  console.log("removing demo content…");
  // Order matters: children before parents, FKs are RESTRICT on money paths.
  const steps = [
    [`delete from public.event_results where event_id in
        (select id from public.events where remarks = $1)`, "results"],
    [`delete from public.registrations where event_id in
        (select id from public.events where remarks = $1)`, "registrations"],
    [`delete from public.prize_structures where event_id in
        (select id from public.events where remarks = $1)`, "prize structures"],
    [`delete from public.events where remarks = $1`, "tournaments"],
    [`delete from public.community_members where community_id in
        (select id from public.communities where remarks = $1)`, "memberships"],
    [`delete from public.communities where remarks = $1`, "communities"],
    [`delete from public.sponsors where details like '%' || $1`, "sponsors"],
  ];

  for (const [sql, label] of steps) {
    const res = await client.query(sql, [MARK]);
    console.log(`  ${label}: ${res.rowCount}`);
  }

  // Store rows carry no remarks column, so they're matched by their demo slugs.
  const slugs = ["gravity-jersey-2026", "crimson-mousepad-xl", "ember-hoodie"];
  const { rows: prods } = await client.query(
    `select id from public.store_products where slug = any($1)`,
    [slugs],
  );
  if (prods.length) {
    const ids = prods.map((p) => p.id);
    await client.query(
      `delete from public.store_inventory where variant_id in
         (select id from public.store_variants where product_id = any($1))`,
      [ids],
    );
    await client.query(`delete from public.store_variants where product_id = any($1)`, [ids]);
    await client.query(`delete from public.store_products where id = any($1)`, [ids]);
    console.log(`  products: ${prods.length}`);
  }

  // Recompute what the triggers had derived from the now-deleted results.
  await client.query(
    `select public.recompute_player_stats(user_id) from public.player_stats`,
  );
  await client.query(`select public.refresh_leaderboard()`);
  console.log("\nDone. Stats and leaderboard recomputed.");
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
