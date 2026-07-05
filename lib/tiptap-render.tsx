import type { ReactNode } from "react";

/**
 * Minimal Tiptap/ProseMirror JSON -> React renderer for the public About page.
 * Supports the common node/mark set the admin editor produces (doc, paragraph,
 * heading, bullet/ordered list, listItem, blockquote, hr, hardBreak, text +
 * bold/italic/underline/strike/link marks). Unknown nodes are skipped safely.
 */
type TiptapMark = { type: string; attrs?: Record<string, unknown> };
type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};

function renderText(node: TiptapNode, key: number): ReactNode {
  let el: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        el = <strong key={`b${key}`}>{el}</strong>;
        break;
      case "italic":
        el = <em key={`i${key}`}>{el}</em>;
        break;
      case "underline":
        el = <u key={`u${key}`}>{el}</u>;
        break;
      case "strike":
        el = <s key={`s${key}`}>{el}</s>;
        break;
      case "code":
        el = <code key={`c${key}`}>{el}</code>;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "#");
        el = (
          <a key={`l${key}`} href={href} target="_blank" rel="noreferrer" className="text-crimson-300 underline">
            {el}
          </a>
        );
        break;
      }
    }
  }
  return <span key={key}>{el}</span>;
}

function renderNode(node: TiptapNode, key: number): ReactNode {
  const children = (node.content ?? []).map((c, i) => renderNode(c, i));
  switch (node.type) {
    case "doc":
      return <div key={key}>{children}</div>;
    case "paragraph":
      return <p key={key} className="my-3 leading-relaxed text-text-muted">{children}</p>;
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const cls = "mt-8 mb-3 font-display tracking-tight";
      if (level === 1) return <h1 key={key} className={`${cls} text-4xl`}>{children}</h1>;
      if (level === 3) return <h3 key={key} className={`${cls} text-xl`}>{children}</h3>;
      return <h2 key={key} className={`${cls} text-2xl`}>{children}</h2>;
    }
    case "bulletList":
      return <ul key={key} className="my-3 list-disc space-y-1 pl-6 text-text-muted">{children}</ul>;
    case "orderedList":
      return <ol key={key} className="my-3 list-decimal space-y-1 pl-6 text-text-muted">{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key} className="my-4 border-l-2 border-crimson-500 pl-4 text-text-muted italic">{children}</blockquote>;
    case "horizontalRule":
      return <hr key={key} className="my-6 border-line" />;
    case "hardBreak":
      return <br key={key} />;
    case "text":
      return renderText(node, key);
    default:
      return <div key={key}>{children}</div>;
  }
}

export function TiptapContent({ doc }: { doc: unknown }) {
  if (!doc || typeof doc !== "object" || !("type" in doc)) {
    return null;
  }
  return <>{renderNode(doc as TiptapNode, 0)}</>;
}
