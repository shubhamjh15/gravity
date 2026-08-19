#!/usr/bin/env node
/**
 * Grant a role to a user by email — the superadmin bootstrap.
 *
 * WHY THIS EXISTS: user_roles INSERT is superadmin-only by RLS (#2), and a
 * fresh database has no superadmins. That's deliberate — it means the role
 * can't be self-granted through the app — but it also means the FIRST
 * superadmin is impossible to create from inside the product. It has to come
 * from a direct database connection, which is exactly what this is.
 *
 * The account must already exist: Supabase Auth creates auth.users on first
 * Google login, so sign in once before running this.
 *
 * Usage:
 *   SUPABASE_DB_URL=... node scripts/promote.mjs you@example.com superadmin
 *   SUPABASE_DB_URL=... node scripts/promote.mjs you@example.com organizer
 *   SUPABASE_DB_URL=... node scripts/promote.mjs --list
 */
import pg from "pg";

const VALID_ROLES = ["player", "organizer", "superadmin"];

const args = process.argv.slice(2);
const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Set SUPABASE_DB_URL (Dashboard → Settings → Database → URI).");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  if (args[0] === "--list" || args.length === 0) {
    const { rows } = await client.query(`
      select u.email,
             coalesce(string_agg(r.role, ', ' order by r.role), '(none)') as roles,
             u.created_at::date as joined
      from auth.users u
      left join public.user_roles r on r.user_id = u.id
      group by u.email, u.created_at
      order by u.created_at
    `);
    if (rows.length === 0) {
      console.log("No accounts yet — sign in with Google once, then re-run.");
      return;
    }
    console.table(rows);
    return;
  }

  const [email, role = "superadmin"] = args;

  if (!VALID_ROLES.includes(role)) {
    console.error(`Role must be one of: ${VALID_ROLES.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const { rows: users } = await client.query(
    `select id, email from auth.users where lower(email) = lower($1)`,
    [email],
  );

  if (users.length === 0) {
    console.error(
      `No account for ${email}.\n` +
        `Supabase Auth creates the user on first login — sign in with Google once, then re-run.`,
    );
    process.exitCode = 1;
    return;
  }

  const user = users[0];

  await client.query("begin");
  try {
    await client.query(
      `insert into public.user_roles (user_id, role)
       values ($1, $2)
       on conflict (user_id, role) do nothing`,
      [user.id, role],
    );

    // platform_admins is the hidden-console allowlist; a superadmin needs a row
    // there too or the admin area stays shut.
    if (role === "superadmin") {
      await client.query(
        `insert into public.platform_admins (user_id)
         values ($1)
         on conflict do nothing`,
        [user.id],
      );
    }

    // Privileged grants are audited like any other (#11). actor_id is null:
    // this came from a direct DB connection, not from a signed-in admin.
    await client.query(
      `insert into public.audit_log (actor_id, action, target_table, target_id, after)
       values (null, 'bootstrap_grant_role', 'user_roles', $1, $2::jsonb)`,
      [user.id, JSON.stringify({ role, email: user.email, via: "scripts/promote.mjs" })],
    );

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }

  const { rows: now } = await client.query(
    `select role from public.user_roles where user_id = $1 order by role`,
    [user.id],
  );

  console.log(`✔ ${user.email} now holds: ${now.map((r) => r.role).join(", ")}`);
  if (role === "superadmin") {
    console.log("  Added to platform_admins — the /admin console will open.");
  }
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
