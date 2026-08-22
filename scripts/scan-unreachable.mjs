#!/usr/bin/env node
/**
 * Unreachable-feature scanner.
 *
 * Finds work that exists but nothing can reach — the exact failure mode behind
 * every "there's no way to do X" in this project so far: product images had a
 * table and no upload, referral codes had an RPC nobody called, match invites
 * had actions with no UI, organizer applications had no page at all.
 *
 * Reports two things:
 *   1. Exported server actions never imported anywhere else (dead write paths).
 *   2. public tables no source file mentions (schema with no product surface).
 *
 * Neither is automatically a bug — some things are called dynamically, and some
 * tables are pure infrastructure — so this prints a review list, not failures.
 *
 * Usage: node scripts/scan-unreachable.mjs [--db]
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), out);
    } else out.push(path.join(dir, entry.name));
  }
  return out;
}

const files = (await walk(".")).filter((f) => /\.(tsx|ts)$/.test(f));
const sources = new Map();
for (const f of files) {
  sources.set(f.split(path.sep).join("/"), await readFile(f, "utf8"));
}

// ---- 1. exported server actions with no importer --------------------------
const actions = [];
for (const [file, src] of sources) {
  if (!/^["']use server["']/m.test(src)) continue;
  const re = /export\s+async\s+function\s+(\w+)/g;
  let m;
  while ((m = re.exec(src)) !== null) actions.push({ file, name: m[1] });
}

const orphanActions = actions.filter(({ file, name }) => {
  for (const [other, src] of sources) {
    if (other === file) continue;
    // Imported by name, or referenced as a bound action.
    if (new RegExp(`\\b${name}\\b`).test(src)) return false;
  }
  return true;
});

console.log(`server actions: ${actions.length}`);
if (orphanActions.length === 0) {
  console.log("  every action is referenced somewhere\n");
} else {
  console.log(`  NEVER IMPORTED (${orphanActions.length}):`);
  for (const a of orphanActions) console.log(`    ${a.name.padEnd(28)} ${a.file}`);
  console.log("");
}

// ---- 2. tables the app never mentions --------------------------------------
if (process.argv.includes("--db")) {
  const pg = (await import("pg")).default;
  const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  await client.end();

  const allSrc = [...sources.values()].join("\n");
  const unused = rows
    .map((r) => r.tablename)
    .filter((t) => !allSrc.includes(`"${t}"`) && !allSrc.includes(`'${t}'`));

  console.log(`public tables: ${rows.length}`);
  if (unused.length === 0) {
    console.log("  every table is referenced by the app");
  } else {
    console.log(`  NOT REFERENCED BY ANY SOURCE FILE (${unused.length}):`);
    for (const t of unused) console.log(`    ${t}`);
  }
}
