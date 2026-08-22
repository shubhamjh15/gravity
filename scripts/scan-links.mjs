#!/usr/bin/env node
/**
 * Dead-link scanner.
 *
 * Cross-references every internal href in the codebase against the routes that
 * actually exist under app/. Catches the class of bug where a nav item, footer
 * link or CTA points at a page nobody ever built — which renders fine, passes
 * typecheck, and only fails when a user clicks it.
 *
 * `typedRoutes` should catch these, but only for hrefs it can see statically;
 * anything cast with `as never` (which this codebase does for computed paths)
 * slips straight past it.
 *
 * Usage: node scripts/scan-links.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "scripts"]);
const STATIC_OK = [
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/games/",
  "/_next",
  "/file.svg",
];

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), out);
    } else {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

// ---- 1. routes that actually exist ----------------------------------------
const appFiles = await walk("app");
const routes = new Set(["/"]);

for (const file of appFiles) {
  const rel = file.split(path.sep).join("/");
  if (!/\/(page\.tsx|route\.ts)$/.test(rel)) continue;
  let r = rel.slice("app/".length).replace(/\/(page\.tsx|route\.ts)$/, "");
  r = r.replace(/\([^)]+\)\/?/g, ""); // route groups are not URL segments
  r = "/" + r.replace(/^\/+|\/+$/g, "");
  routes.add(r === "/" ? "/" : r);
}

// ---- 2. every internal href in the source ---------------------------------
const srcFiles = (await walk(".")).filter((f) => /\.(tsx|ts)$/.test(f));
const hrefs = new Map();

for (const file of srcFiles) {
  const src = await readFile(file, "utf8");
  const re = /href=\{?["'`](\/[^"'`}?#]*)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const href = m[1];
    if (!hrefs.has(href)) hrefs.set(href, new Set());
    hrefs.get(href).add(file.split(path.sep).join("/"));
  }
}

// ---- 3. match, allowing dynamic segments ----------------------------------
const dynamicRoutes = [...routes]
  .filter((r) => r.includes("["))
  .map((r) => new RegExp("^" + r.replace(/\[[^\]]+\]/g, "[^/]+") + "$"));

function resolves(href) {
  if (routes.has(href)) return true;
  return dynamicRoutes.some((re) => re.test(href));
}

const dead = [...hrefs.entries()]
  .filter(([h]) => !resolves(h) && !STATIC_OK.some((s) => h.startsWith(s)))
  .sort(([a], [b]) => a.localeCompare(b));

console.log(`routes: ${routes.size}   internal hrefs: ${hrefs.size}\n`);

if (dead.length === 0) {
  console.log("No dead links.");
} else {
  console.log(`DEAD LINKS (${dead.length}):`);
  for (const [href, files] of dead) {
    console.log(`\n  ${href}`);
    for (const f of [...files].sort()) console.log(`     <- ${f}`);
  }
  process.exitCode = 1;
}
