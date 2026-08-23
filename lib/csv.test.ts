import { describe, it, expect } from "vitest";
import { toCsv, csvResponse, dateStamp } from "@/lib/csv";

/**
 * CSV export tests. The interesting cases are the ones that bite in production:
 * quoting, and formula injection from user-supplied names.
 */
describe("toCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    // Strip the BOM before comparing.
    expect(csv.replace(/^﻿/, "")).toBe("a,b\r\n1,2\r\n");
  });

  it("starts with a UTF-8 BOM so Excel renders ₹ correctly", () => {
    expect(toCsv(["amount"], [["₹1,200.00"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("quotes fields containing a comma", () => {
    expect(toCsv(["name"], [["Sharma, Rahul"]])).toContain('"Sharma, Rahul"');
  });

  it("doubles embedded quotes (RFC 4180)", () => {
    expect(toCsv(["name"], [['He said "go"']])).toContain('"He said ""go"""');
  });

  it("quotes fields containing newlines rather than breaking the row", () => {
    const csv = toCsv(["remarks"], [["line one\nline two"]]);
    expect(csv).toContain('"line one\nline two"');
    // Header + one record + trailing CRLF => exactly two CRLFs.
    expect(csv.split("\r\n").length).toBe(3);
  });

  it("renders null and undefined as empty fields, not the strings", () => {
    expect(toCsv(["a", "b"], [[null, undefined]]).replace(/^﻿/, "")).toBe(
      "a,b\r\n,\r\n",
    );
  });

  it("does not quote ordinary values", () => {
    expect(toCsv(["n"], [[42]]).replace(/^﻿/, "")).toBe("n\r\n42\r\n");
  });

  // --- Formula injection -------------------------------------------------
  // A display name is user-supplied and lands in these exports. Without the
  // guard, opening the file in Excel executes it.
  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd", "\rcmd"])(
    "neutralises a field starting with %j",
    (dangerous) => {
      const field = toCsv(["name"], [[dangerous]])
        .replace(/^﻿/, "")
        .split("\r\n")[1];
      // Prefixed with a single quote, so Excel treats it as text.
      expect(field.startsWith("'") || field.startsWith("\"'")).toBe(true);
    },
  );

  it("neutralises the classic =cmd|' /C calc'!A0 payload", () => {
    const csv = toCsv(["name"], [["=cmd|' /C calc'!A0"]]);
    expect(csv).not.toMatch(/(^|,)=cmd/);
  });

  it("leaves a legitimate negative amount readable after escaping", () => {
    const field = toCsv(["amt"], [["-500"]])
      .replace(/^﻿/, "")
      .split("\r\n")[1];
    expect(field).toContain("-500");
  });
});

describe("csvResponse", () => {
  it("sets a download disposition and the csv content type", () => {
    const res = csvResponse("report.csv", "a\r\n");
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="report.csv"',
    );
  });

  it("never caches a financial export in a shared proxy", () => {
    const res = csvResponse("report.csv", "a\r\n");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("sanitises a filename that would break the header", () => {
    const res = csvResponse('evil"; drop\r\nX-Injected: 1', "a");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).not.toContain('"; drop');
    expect(disposition).not.toContain("\r");
  });
});

describe("dateStamp", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(dateStamp(new Date("2026-08-19T10:30:00Z"))).toBe("2026-08-19");
  });
});
