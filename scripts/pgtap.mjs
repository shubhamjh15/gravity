#!/usr/bin/env node
/**
 * Run the pgTAP suites in supabase/tests/database against a real database.
 *
 * `supabase test db` is the usual runner, but it needs Docker to stand up a
 * local stack. This executes the same files over a plain connection, so the
 * security tests can run against the actual project.
 *
 * SAFETY: every suite is wrapped in `begin … rollback`, so nothing it creates
 * survives. This script additionally forces a rollback of its own even when a
 * suite throws, and refuses to run if a file doesn't contain a rollback.
 *
 * The suites use psql's `\i` to include the helper file; psql meta-commands
 * don't exist over a normal connection, so those lines are replaced with the
 * helper's contents here.
 *
 * Usage:  SUPABASE_DB_URL=... node scripts/pgtap.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const TESTS_DIR = "supabase/tests/database";
const HELPERS = path.join(TESTS_DIR, "00_helpers.sql");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Set SUPABASE_DB_URL.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

function parseTap(output) {
  const lines = output.split("\n").map((l) => l.trim());
  const failures = lines.filter((l) => /^not ok\b/.test(l));
  const passes = lines.filter((l) => /^ok\b/.test(l));
  const diagnostics = lines.filter((l) => l.startsWith("#"));
  return { failures, passes, diagnostics };
}

async function main() {
  await client.connect();

  // pgTAP ships with Supabase but isn't enabled by default.
  await client.query("create extension if not exists pgtap with schema extensions");
  console.log("pgtap ready\n");

  const helpers = await readFile(HELPERS, "utf8");
  const files = (await readdir(TESTS_DIR))
    .filter((f) => f.endsWith(".test.sql"))
    .sort();

  let totalPass = 0;
  let totalFail = 0;

  for (const file of files) {
    const raw = await readFile(path.join(TESTS_DIR, file), "utf8");

    if (!/rollback\s*;/i.test(raw)) {
      console.error(`REFUSING to run ${file}: no rollback — it would persist.`);
      process.exitCode = 1;
      continue;
    }

    // Inline the helpers in place of the psql \i include. Done line-by-line
    // rather than with a regex: the files are CRLF here, and an anchored
    // pattern silently matched nothing, which sent the raw `\i` to Postgres.
    const sql = raw
      .split(/\r?\n/)
      .map((line) => (line.trim().startsWith("\\i") ? helpers : line))
      .join("\n");

    process.stdout.write(`── ${file}\n`);
    try {
      const res = await client.query(sql);
      // pgTAP emits its TAP stream as rows from the plan/assertion functions.
      const rows = (Array.isArray(res) ? res : [res])
        .flatMap((r) => r?.rows ?? [])
        .map((r) => Object.values(r)[0])
        .filter((v) => typeof v === "string");

      const { failures, passes, diagnostics } = parseTap(rows.join("\n"));
      totalPass += passes.length;
      totalFail += failures.length;

      for (const p of passes) console.log(`   ✓ ${p.replace(/^ok\s+\d+\s*-?\s*/, "")}`);
      for (const f of failures) console.log(`   ✗ ${f.replace(/^not ok\s+\d+\s*-?\s*/, "")}`);
      for (const d of diagnostics) {
        if (!/^#\s*(Looks like|Failed)/i.test(d)) continue;
        console.log(`   ${d}`);
      }
    } catch (err) {
      totalFail += 1;
      console.log(`   ✗ suite error: ${err.message}`);
    } finally {
      // The file's own rollback normally handles this; this is the backstop for
      // a suite that threw before reaching it.
      await client.query("rollback").catch(() => {});
    }
    console.log("");
  }

  console.log(`${totalPass} passed, ${totalFail} failed`);
  if (totalFail > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
