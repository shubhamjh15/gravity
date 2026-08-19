/**
 * Minimal, correct CSV serialisation for report downloads.
 *
 * Correctness notes, because hand-rolled CSV is usually subtly wrong:
 *  - RFC 4180 quoting: a field is quoted when it contains a comma, quote, CR or
 *    LF; embedded quotes are doubled.
 *  - CRLF line endings, which Excel expects.
 *  - A leading UTF-8 BOM so Excel reads ₹ and non-ASCII names correctly instead
 *    of mojibake.
 *  - Formula injection defence: a field starting with = + - @ (or tab/CR) is
 *    prefixed with a single quote. Without this, opening an export in Excel can
 *    execute a formula from user-supplied text — a real risk here because
 *    display names and remarks reach these files.
 */

const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function serialiseField(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (FORMULA_TRIGGER.test(text)) {
    text = `'${text}`;
  }

  if (NEEDS_QUOTING.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Build a CSV document from a header row and data rows. */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [
    headers.map(serialiseField).join(","),
    ...rows.map((row) => row.map(serialiseField).join(",")),
  ];
  // BOM + CRLF for Excel.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** A Response that downloads `filename` as CSV. */
export function csvResponse(filename: string, body: string): Response {
  // Strip anything that could break the header or escape the filename.
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      // Financial exports must never be cached by a shared proxy.
      "Cache-Control": "private, no-store",
    },
  });
}

/** `YYYY-MM-DD` stamp for report filenames. */
export function dateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
