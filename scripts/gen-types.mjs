#!/usr/bin/env node
/**
 * Generate `lib/supabase/types.ts` by introspecting the live database.
 *
 * Why not `supabase gen types typescript`? That command shells out to Docker to
 * stand up a shadow database, and Docker isn't installed on every machine. This
 * reads the catalog over the same connection `db.mjs` uses, so type generation
 * has no dependency beyond a connection string.
 *
 * The output shape matches what @supabase/supabase-js expects (Tables / Views /
 * Functions / Enums / CompositeTypes with Row, Insert, Update), so it is a drop-in
 * replacement for the official generator's file.
 *
 * Usage:  SUPABASE_DB_URL=... node scripts/gen-types.mjs [outfile]
 */
import { writeFile } from "node:fs/promises";
import pg from "pg";

const outFile = process.argv[2] ?? "lib/supabase/types.ts";
const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Set SUPABASE_DB_URL (Dashboard → Settings → Database → URI).");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

/**
 * Postgres type → TypeScript.
 *
 * bigint/numeric map to `number`, not `string`: PostgREST serialises them as
 * JSON numbers, and money is integer paise well inside the safe-integer range
 * (lib/money documents that ceiling). Anything unrecognised falls back to
 * `unknown` rather than `any`, so a new type surfaces as a compile error
 * instead of silently disabling checking.
 */
function tsType(udtName, isArray) {
  const base = (() => {
    switch (udtName) {
      case "bool":
        return "boolean";
      case "int2":
      case "int4":
      case "int8":
      case "float4":
      case "float8":
      case "numeric":
        return "number";
      case "json":
      case "jsonb":
        return "Json";
      case "text":
      case "varchar":
      case "bpchar":
      case "citext":
      case "uuid":
      case "date":
      case "time":
      case "timetz":
      case "timestamp":
      case "timestamptz":
      case "interval":
      case "inet":
      case "cidr":
      case "macaddr":
      case "bytea":
      case "name":
        return "string";
      default:
        return null; // resolved as an enum, or falls back below
    }
  })();
  return base ? (isArray ? `${base}[]` : base) : null;
}

function quoteKey(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

async function main() {
  await client.connect();

  // ---- enums ----------------------------------------------------------------
  const { rows: enumRows } = await client.query(`
    select t.typname as name, e.enumlabel as label
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder
  `);
  const enums = new Map();
  for (const r of enumRows) {
    if (!enums.has(r.name)) enums.set(r.name, []);
    enums.get(r.name).push(r.label);
  }

  const resolve = (udtName, isArray) => {
    const mapped = tsType(udtName, isArray);
    if (mapped) return mapped;
    if (enums.has(udtName)) {
      const union = enums.get(udtName).map((l) => JSON.stringify(l)).join(" | ");
      return isArray ? `(${union})[]` : union;
    }
    return isArray ? "unknown[]" : "unknown";
  };

  // ---- columns for tables and views ----------------------------------------
  const { rows: colRows } = await client.query(`
    select
      c.table_name,
      c.column_name,
      c.is_nullable,
      c.column_default,
      c.is_identity,
      c.data_type,
      c.udt_name,
      t.table_type,
      c.is_generated
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
    order by c.table_name, c.ordinal_position
  `);

  const tables = new Map();
  for (const r of colRows) {
    const key = r.table_name;
    if (!tables.has(key)) {
      tables.set(key, { kind: r.table_type, columns: [] });
    }
    const isArray = r.data_type === "ARRAY";
    // information_schema reports arrays with a leading underscore on udt_name.
    const udt = isArray ? r.udt_name.replace(/^_/, "") : r.udt_name;
    tables.get(key).columns.push({
      name: r.column_name,
      type: resolve(udt, isArray),
      nullable: r.is_nullable === "YES",
      hasDefault: r.column_default !== null || r.is_identity === "YES",
      generated: r.is_generated === "ALWAYS",
    });
  }

  // ---- functions (RPC) ------------------------------------------------------
  const { rows: fnRows } = await client.query(`
    select
      p.proname as name,
      pg_get_function_arguments(p.oid) as args,
      pg_get_function_result(p.oid)    as result,
      p.prokind
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f')
      -- skip trigger functions: they're never callable over RPC
      and pg_get_function_result(p.oid) <> 'trigger'
    order by p.proname
  `);

  const sqlTypeToTs = (raw) => {
    const cleaned = raw.trim().toLowerCase().replace(/\[\]$/, "");
    const isArray = raw.trim().endsWith("[]");
    const alias = {
      "character varying": "varchar",
      "timestamp with time zone": "timestamptz",
      "timestamp without time zone": "timestamp",
      "double precision": "float8",
      integer: "int4",
      bigint: "int8",
      smallint: "int2",
      boolean: "bool",
      real: "float4",
    };
    return resolve(alias[cleaned] ?? cleaned, isArray);
  };

  const functions = new Map();
  for (const fn of fnRows) {
    // Only named IN/INOUT params can be passed by supabase-js.
    const args = {};
    if (fn.args.trim() !== "") {
      for (const part of splitArgs(fn.args)) {
        const m = part
          .trim()
          .match(/^(?:(IN|OUT|INOUT|VARIADIC)\s+)?(\w+)\s+(.+?)(\s+DEFAULT\s+.*)?$/i);
        if (!m) continue;
        const [, mode, argName, argType, defaultClause] = m;
        if (mode && mode.toUpperCase() === "OUT") continue;
        // A parameter with a DEFAULT is optional at the call site. Marking them
        // all required would force every caller to pass p_ip, p_currency and
        // friends on functions deliberately designed with sensible defaults.
        args[argName] = {
          type: sqlTypeToTs(argType),
          optional: Boolean(defaultClause),
        };
      }
    }

    // `TABLE(...)` and `SETOF x` return arrays of rows.
    let returns;
    const result = fn.result.trim();
    if (/^TABLE\(/i.test(result)) {
      const inner = result.slice(result.indexOf("(") + 1, result.lastIndexOf(")"));
      const fields = splitArgs(inner)
        .map((f) => {
          const m = f.trim().match(/^(\w+)\s+(.+)$/);
          return m ? `${quoteKey(m[1])}: ${sqlTypeToTs(m[2])}` : null;
        })
        .filter(Boolean);
      returns = `{ ${fields.join("; ")} }[]`;
    } else if (/^SETOF\s+/i.test(result)) {
      returns = `${sqlTypeToTs(result.replace(/^SETOF\s+/i, ""))}[]`;
    } else if (result.toLowerCase() === "void") {
      returns = "undefined";
    } else {
      returns = sqlTypeToTs(result);
    }

    // Overloads: keep the first signature rather than emitting a duplicate key.
    if (!functions.has(fn.name)) functions.set(fn.name, { args, returns });
  }

  // ---- emit -----------------------------------------------------------------
  const emitTable = (name, def) => {
    const isView = def.kind === "VIEW";
    const row = def.columns
      .map((c) => `          ${quoteKey(c.name)}: ${c.type}${c.nullable ? " | null" : ""};`)
      .join("\n");

    // A column is optional on INSERT when the DB can supply it (default,
    // identity, generated) or it accepts null.
    const insert = def.columns
      .filter((c) => !c.generated)
      .map((c) => {
        const optional = c.hasDefault || c.nullable;
        return `          ${quoteKey(c.name)}${optional ? "?" : ""}: ${c.type}${c.nullable ? " | null" : ""};`;
      })
      .join("\n");

    const update = def.columns
      .filter((c) => !c.generated)
      .map((c) => `          ${quoteKey(c.name)}?: ${c.type}${c.nullable ? " | null" : ""};`)
      .join("\n");

    // Views aren't insertable/updatable through PostgREST here, but supabase-js
    // requires the keys to exist — mirror the row shape as fully optional.
    return [
      `      ${quoteKey(name)}: {`,
      `        Row: {`,
      row,
      `        };`,
      `        Insert: {`,
      isView ? update : insert,
      `        };`,
      `        Update: {`,
      update,
      `        };`,
      `        Relationships: [];`,
      `      };`,
    ].join("\n");
  };

  const tableEntries = [...tables.entries()].filter(([, d]) => d.kind === "BASE TABLE");
  const viewEntries = [...tables.entries()].filter(([, d]) => d.kind === "VIEW");

  const fnEntries = [...functions.entries()].map(
    ([name, { args, returns }]) =>
      [
        `      ${quoteKey(name)}: {`,
        `        Args: {`,
        Object.entries(args)
          .map(
            ([k, v]) =>
              `          ${quoteKey(k)}${v.optional ? "?" : ""}: ${v.type};`,
          )
          .join("\n") || "          [key: string]: never;",
        `        };`,
        `        Returns: ${returns};`,
        `      };`,
      ].join("\n"),
  );

  const enumEntries = [...enums.entries()].map(
    ([name, labels]) =>
      `      ${quoteKey(name)}: ${labels.map((l) => JSON.stringify(l)).join(" | ")};`,
  );

  const header = `/**
 * Supabase database types — GENERATED. Do not edit by hand.
 *
 * Regenerate after any migration:
 *   npm run db:types
 *
 * Produced by scripts/gen-types.mjs, which introspects the live catalog over a
 * plain Postgres connection. (The official \`supabase gen types\` shells out to
 * Docker; this keeps type generation dependency-free.)
 *
 * Generated from ${tableEntries.length} tables, ${viewEntries.length} views, ${fnEntries.length} functions.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
${tableEntries.map(([n, d]) => emitTable(n, d)).join("\n")}
    };
    Views: {
${viewEntries.length ? viewEntries.map(([n, d]) => emitTable(n, d)).join("\n") : "      [key: string]: never;"}
    };
    Functions: {
${fnEntries.join("\n")}
    };
    Enums: {
${enumEntries.length ? enumEntries.join("\n") : "      [key: string]: never;"}
    };
    CompositeTypes: {
      [key: string]: never;
    };
  };
};
`;

  await writeFile(outFile, header, "utf8");
  console.log(
    `Wrote ${outFile} — ${tableEntries.length} tables, ${viewEntries.length} views, ${fnEntries.length} functions, ${enums.size} enums`,
  );
}

/** Split a Postgres argument list on top-level commas (types can contain them). */
function splitArgs(input) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current);
  return out;
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
