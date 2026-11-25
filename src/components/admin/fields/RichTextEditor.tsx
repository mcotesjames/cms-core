import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow } from "lucide-react";
import { safeHref, type RichDoc } from "@/lib/fields";
import { cn } from "@/lib/utils";

/**
 * Rich text field (spec: Core scope → Field types): a small fixed toolbar — bold, italic, link,
 * bulleted and numbered lists, subheadings (H2/H3) — over TipTap. Only those nodes and marks
 * exist in the schema, so pasted Word or web content is reduced to them (no fonts, colours or
 * stray HTML), and the value is stored as structured JSON, never HTML.
 */
export function RichTextEditor({
  value,
  onChange,
  label,
}: {
  value: RichDoc | null | undefined;
  onChange: (doc: RichDoc) => void;
  label: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        dropcursor: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => safeHref(url) !== null,
        },
      }),
    ],
    content: value && value.content?.length ? value : "",
    editorProps: {
      attributes: { class: "studio-rich", "aria-label": label, role: "textbox" },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichDoc),
  });

  // Follows outside changes (Discard, another tab) without fighting the cursor while typing.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = JSON.stringify(value ?? null);
    if (next !== JSON.stringify(editor.getJSON()))
      editor.commands.setContent(value && value.content?.length ? value : "", {
        emitUpdate: false,
      });
  }, [editor, value]);

  return (
    <div className="studio-rich-field">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      p: e.isActive("paragraph"),
    }),
  });
  const [linking, setLinking] = useState<string | null>(null);
  const chain = () => editor.chain().focus();
  const btn = (on: boolean, title: string, run: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={cn("studio-rich-btn", on && "is-on")}
    >
      {icon}
    </button>
  );
  const applyLink = () => {
    const raw = (linking ?? "").trim();
    // A bare email address becomes a mailto: link.
    const href = safeHref(/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(raw) ? `mailto:${raw}` : raw);
    if (!linking?.trim()) chain().extendMarkRange("link").unsetLink().run();
    else if (href) chain().extendMarkRange("link").setLink({ href }).run();
    setLinking(null);
  };
  return (
    <div className="studio-rich-toolbar" role="toolbar" aria-label="Formatting">
      {btn(s.p, "Paragraph", () => chain().setParagraph().run(), <Pilcrow />)}
      {btn(s.h2, "Subheading", () => chain().toggleHeading({ level: 2 }).run(), <Heading2 />)}
      {btn(s.h3, "Small subheading", () => chain().toggleHeading({ level: 3 }).run(), <Heading3 />)}
      <span className="studio-rich-sep" aria-hidden="true" />
      {btn(s.bold, "Bold", () => chain().toggleBold().run(), <Bold />)}
      {btn(s.italic, "Italic", () => chain().toggleItalic().run(), <Italic />)}
      {btn(
        s.link,
        "Link",
        () => setLinking((editor.getAttributes("link")["href"] as string | undefined) ?? ""),
        <Link2 />,
      )}
      <span className="studio-rich-sep" aria-hidden="true" />
      {btn(s.ul, "Bulleted list", () => chain().toggleBulletList().run(), <List />)}
      {btn(s.ol, "Numbered list", () => chain().toggleOrderedList().run(), <ListOrdered />)}
      {linking !== null && (
        <form
          className="studio-rich-link"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            value={linking}
            placeholder="https://…, /page or email"
            aria-label="Link address"
            onChange={(e) => setLinking(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setLinking(null);
            }}
          />
          <button type="submit">{linking.trim() ? "Apply" : "Remove"}</button>
        </form>
      )}
    </div>
  );
}
