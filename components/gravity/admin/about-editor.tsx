"use client";

/**
 * About page editor (super-admin). Tiptap rich-text -> saves the ProseMirror
 * JSON, which the public About page renders via lib/tiptap-render. Minimal
 * toolbar (headings, bold/italic, lists, quote).
 */
import { useTransition, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Save,
} from "lucide-react";
import { saveAbout } from "@/app/(admin)/admin/about/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AboutEditor({ initial }: { initial: unknown }) {
  const [pending, startTransition] = useTransition();

  const editor = useEditor({
    extensions: [StarterKit],
    content:
      initial && typeof initial === "object" && Object.keys(initial).length > 0
        ? (initial as object)
        : "<p>Tell the GRAVITY story…</p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[24rem] rounded-lg border border-line bg-surface-2/40 px-4 py-3 focus:outline-none prose-invert max-w-none",
      },
    },
  });

  function save() {
    if (!editor) return;
    const json = editor.getJSON();
    startTransition(async () => {
      const res = await saveAbout({ content_json: json });
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="size-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} variant="gradient">
          <Save className="size-4" /> {pending ? "Saving…" : "Save About page"}
        </Button>
      </div>
    </div>
  );
}

/** Toolbar button — declared at module scope (not during render). */
function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-md border transition-colors",
        active
          ? "border-crimson-500 bg-crimson-500/10 text-crimson-300"
          : "border-line text-text-muted hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}
