#!/usr/bin/env node
/**
 * Small psql-less database helper — psql isn't installed on every machine, and
 * `supabase db push` only applies migrations, not seeds, against a remote
 * project.
 *
 * Reads the connection string from SUPABASE_DB_URL (or --db-url). Never hardcode
 * a password here; this file is committed.
 *
 * Usage:
 *   node scripts/db.mjs seed [file]   apply a .sql file (default supabase/seed.sql)
 *   node scripts/db.mjs status        summarise tables / policies / RPCs
 *   node scripts/db.mjs sql "<query>" run one statement and print the rows
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

const argv = process.argv.slice(2);
const command = argv[0] ?? "status";

const flagIndex = argv.indexOf("--db-url");
const connectionString =
  (flagIndex !== -1 ? argv[flagIndex + 1] : undefined) ??
  process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error(
    "No connection string. Set SUPABASE_DB_URL or pass --db-url.\n" +
      "Find it in: Supabase Dashboard → Project Settings → Database → Connection string (URI).",
  );
  process.exit(1);
}

// Supabase terminates TLS with its own CA; verifying it needs the cert bundle,
// which isn't worth shipping for a local admin script.
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  if (command === "seed") {
    const file = argv[1]?.startsWith("--") ? undefined : argv[1];
    const path = file ?? "supabase/seed.sql";
    const sql = await readFile(path, "utf8");
    await client.query(sql);
    console.log(`Applied ${path}`);
    await status();
    return;
  }

  if (command === "sql") {
    const query = argv[1];
    if (!query) throw new Error('Pass a statement: node scripts/db.mjs sql "select 1"');
    const res = await client.query(query);
    console.table(res.rows);
    return;
  }

  await status();
}

async function status() {
  const q = async (sql) => (await client.query(sql)).rows;

  const [tables] = await q(
    `select count(*)::int n from pg_tables where schemaname = 'public'`,
  );
  const [policies] = await q(
    `select count(*)::int n from pg_policies where schemaname = 'public'`,
  );
  const [functions] = await q(
    `select count(*)::int n from pg_proc p
     join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'`,
  );
  const noRls = await q(
    `select tablename from pg_tables t
     where schemaname = 'public'
       and not exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity
       )
     order by tablename`,
  );
  const games = await q(`select slug from public.games order by slug`);
  const settings = await q(`select key from public.app_settings order by key`);

  console.log(
    `tables: ${tables.n}  ·  RLS policies: ${policies.n}  ·  functions: ${functions.n}`,
  );
  console.log(`games seeded: ${games.map((g) => g.slug).join(", ") || "(none)"}`);
  console.log(
    `settings seeded: ${settings.map((s) => s.key).join(", ") || "(none)"}`,
  );

  // NON-NEGOTIABLE #4: every table carries RLS. Loud, because a table that
  // slips through is invisible until it leaks.
  if (noRls.length > 0) {
    console.error(
      `\n⚠ TABLES WITHOUT RLS (#4 violation): ${noRls.map((r) => r.tablename).join(", ")}`,
    );
    process.exitCode = 1;
  } else {
    console.log("RLS: enabled on every public table ✓");
  }
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
