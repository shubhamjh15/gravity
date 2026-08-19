#!/usr/bin/env node
/**
 * Concatenate supabase/migrations/*.sql (in order) into one script that can be
 * pasted straight into the Supabase SQL Editor.
 *
 * `supabase db push` is the normal path — it tracks which migrations have run.
 * This bundle is the fallback for a first-time setup where the CLI isn't linked
 * (no DB password / access token to hand). It is NOT idempotent: run it once,
 * against a fresh database.
 *
 * Usage:  npm run bundle:sql [-- <outfile>]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const outFile = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "supabase", "bundle.generated.sql");

const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort(); // 0001…0022 sort lexicographically because they're zero-padded

if (files.length === 0) {
  console.error("No migrations found in", migrationsDir);
  process.exit(1);
}

const parts = [
  "-- ============================================================================",
  "-- GRAVITY — full schema bundle (generated; do not edit by hand)",
  `-- ${files.length} migrations: ${files[0]} … ${files[files.length - 1]}`,
  "--",
  "-- Paste into the Supabase SQL Editor and run ONCE against a fresh database.",
  "-- Regenerate with:  npm run bundle:sql",
  "-- ============================================================================",
  "",
];

for (const file of files) {
  const sql = await readFile(path.join(migrationsDir, file), "utf8");
  parts.push(
    "",
    `-- ▼▼▼ ${file} ${"▼".repeat(Math.max(0, 60 - file.length))}`,
    "",
    sql.trimEnd(),
    "",
  );
}

await writeFile(outFile, parts.join("\n") + "\n", "utf8");

const bytes = Buffer.byteLength(parts.join("\n"), "utf8");
console.log(`Bundled ${files.length} migrations → ${outFile}`);
console.log(`${(bytes / 1024).toFixed(1)} KB`);
