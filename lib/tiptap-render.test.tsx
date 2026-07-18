import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TiptapContent } from "./tiptap-render";

/** The renderer must safely turn ProseMirror JSON into HTML. */
function html(doc: unknown): string {
  return renderToStaticMarkup(<TiptapContent doc={doc} />);
}

describe("TiptapContent", () => {
  it("renders nothing for invalid input", () => {
    expect(html(null)).toBe("");
    expect(html({})).toBe("");
    expect(html("string")).toBe("");
  });

  it("renders a paragraph", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    };
    expect(html(doc)).toContain("Hello");
    expect(html(doc)).toContain("<p");
  });

  it("renders headings at the right level", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      ],
    };
    expect(html(doc)).toContain("<h2");
    expect(html(doc)).toContain("Title");
  });

  it("applies bold + italic marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "bold" }, { type: "italic" }] }],
        },
      ],
    };
    const out = html(doc);
    expect(out).toContain("<strong");
    expect(out).toContain("<em");
  });

  it("renders bullet lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
          ],
        },
      ],
    };
    const out = html(doc);
    expect(out).toContain("<ul");
    expect(out).toContain("<li");
    expect(out).toContain("one");
  });

  it("renders links with safe attrs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "site", marks: [{ type: "link", attrs: { href: "https://x.com" } }] },
          ],
        },
      ],
    };
    const out = html(doc);
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain('rel="noreferrer"');
  });
});
