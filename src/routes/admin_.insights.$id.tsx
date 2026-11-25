import { createFileRoute, Link } from "@tanstack/react-router";
import {
  discardPostDraft,
  getStudioPost,
  publishPost,
  savePostDraft,
  unpublishPost,
} from "@/data/entries";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminGate, adminHead } from "@/components/admin/AdminGate";
import { StudioShell, PanelHeading, PanelField as Field } from "@/components/admin/StudioShell";
import { type ArticleModule, type ModuleType, parseModules } from "@/lib/modules";
import { htmlToBlocks, markdownToBlocks, newBlock } from "@/lib/blocks-convert";
import { uploadMedia } from "@/lib/media";
import { articleProblems, type PostDoc } from "@/lib/article-doc";
import { moveSection, type StudioMessage } from "@/lib/studio-mode";
import { commentSearch, postAnchor } from "@/lib/comments";
import { useCanvasComments } from "@/components/admin/useCanvasComments";
import type { SeoFields } from "@/lib/seo";

export const Route = createFileRoute("/admin_/insights/$id")({
  ssr: false,
  head: () => adminHead("Edit insight"),
  validateSearch: commentSearch,
  component: EditorRoute,
});

/** Keyed by insight, so switching to another insight (page switcher) starts a fresh editor. */
function EditorRoute() {
  const { id } = Route.useParams();
  return (
    <AdminGate>
      <Editor key={id} />
    </AdminGate>
  );
}

const BLOCK_LABELS: Record<ModuleType, string> = {
  rich_text: "Text",
  pull_quote: "Quote",
  media: "Image",
  video: "Video",
  stat_callout: "Stat",
  divider: "Divider",
};
const INSERTABLE: ModuleType[] = [
  "rich_text",
  "media",
  "pull_quote",
  "video",
  "stat_callout",
  "divider",
];

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <select
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {(Object.keys(options) as T[]).map((k) => (
        <option key={k} value={k}>
          {options[k]}
        </option>
      ))}
    </select>
  );
}

function Upload({
  onUrl,
  label,
  accept = "image/*",
}: {
  onUrl: (u: string) => void;
  label: string;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="studio-drop">
      <span>{busy ? "Uploading…" : label}</span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onUrl(await uploadMedia(f));
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

/** All CMS fields of one article block. */
function BlockFields({
  b,
  set,
  onPasteBlocks,
}: {
  b: ArticleModule;
  set: (b: ArticleModule) => void;
  onPasteBlocks: (bs: ArticleModule[]) => void;
}) {
  const t = (k: string, label: string, multi = false) => (
    <Field label={label}>
      {multi ? (
        <Textarea
          rows={4}
          value={(b as any)[k] ?? ""}
          onChange={(e) => set({ ...b, [k]: e.target.value } as ArticleModule)}
        />
      ) : (
        <Input
          value={(b as any)[k] ?? ""}
          onChange={(e) => set({ ...b, [k]: e.target.value } as ArticleModule)}
        />
      )}
    </Field>
  );
  switch (b.type) {
    case "rich_text":
      return (
        <>
          <Field label="Text">
            <Textarea
              rows={14}
              value={b.body}
              placeholder="Start writing, or paste from Google Docs…"
              onChange={(e) => set({ ...b, body: e.target.value })}
              onPaste={(e) => {
                const html = e.clipboardData.getData("text/html");
                const bs = html ? htmlToBlocks(html) : [];
                if (bs.length) {
                  e.preventDefault();
                  onPasteBlocks(bs);
                }
              }}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Use ## for a heading, **bold**, *italic*, [link](https://…) and - for lists. Paste from
            Google Docs to keep formatting.
          </p>
        </>
      );
    case "pull_quote":
      return (
        <>
          {t("quote", "Quote", true)}
          {t("attribution", "Attribution")}
          <Field label="Width">
            <Select
              value={b.width ?? "column"}
              options={{ column: "Text column", wide: "Wide" }}
              onChange={(v) => set({ ...b, width: v })}
            />
          </Field>
        </>
      );
    case "media":
      return (
        <>
          <Field label="Layout">
            <Select
              value={b.layout}
              options={{
                contained: "Contained",
                full_width: "Full width",
                two_up: "Two side by side",
              }}
              onChange={(v) => set({ ...b, layout: v })}
            />
          </Field>
          {b.url && <img src={b.url} alt="" className="max-h-40 rounded-sm object-cover" />}
          <Upload
            label={b.url ? "Replace image" : "Upload image"}
            onUrl={(u) => set({ ...b, url: u })}
          />
          {t("alt", "Alt text (describes the image)")}
          {t("caption", "Caption")}
          {b.layout === "two_up" && (
            <>
              <Upload
                label={b.secondary_url ? "Replace second image" : "Upload second image"}
                onUrl={(u) => set({ ...b, secondary_url: u })}
              />
              {t("secondary_alt", "Second image alt text")}
            </>
          )}
        </>
      );
    case "video":
      return (
        <>
          <Field label="Source">
            <Select
              value={b.provider}
              options={{ vimeo: "Vimeo link", native: "Uploaded video" }}
              onChange={(v) => set({ ...b, provider: v })}
            />
          </Field>
          {b.provider === "vimeo" ? (
            t("url", "Vimeo link")
          ) : (
            <Upload
              label={b.url ? "Replace video" : "Upload video"}
              accept="video/*"
              onUrl={(u) => set({ ...b, url: u })}
            />
          )}
          {t("caption", "Caption")}
        </>
      );
    case "stat_callout":
      return (
        <>
          {t("value", "Value")}
          {t("label", "Label")}
          {t("footnote", "Footnote")}
          <Field label="Width">
            <Select
              value={b.width ?? "column"}
              options={{ column: "Text column", wide: "Wide" }}
              onChange={(v) => set({ ...b, width: v })}
            />
          </Field>
        </>
      );
    case "divider":
      return (
        <Field label="Style">
          <Select
            value={b.style}
            options={{ line: "Line", space: "Space" }}
            onChange={(v) => set({ ...b, style: v })}
          />
        </Field>
      );
  }
}

function Editor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const frame = useRef<HTMLIFrameElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<PostDoc | null>(null);
  const [live, setLive] = useState({ published: false, hasDraft: false });
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  /** "details", "cover", or a block id. */
  const [sel, setSel] = useState<string | null>(null);
  const [insertAfter, setInsertAfter] = useState<string | null>(null);
  const [imageField, setImageField] = useState<string | null>(null);
  const [panel, setPanel] = useState(true);
  const [converted, setConverted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { comment, device, mode } = Route.useSearch();
  const comments = useCanvasComments({
    frame,
    here: postAnchor(id),
    hereLabel: "the article as a whole",
    focus: comment,
    initial: { device, commenting: mode === "comment" },
  });
  useEffect(() => {
    if (!comments.on) return;
    setSel(null);
    setInsertAfter(null);
    setPanel(true);
  }, [comments.on]);

  useEffect(() => {
    getStudioPost({ data: { id } }).then((p) => {
      if (!p) {
        toast.error("Insight not found");
        return;
      }
      const base: PostDoc = {
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        cover_url: p.cover_url,
        author: p.author,
        published_at: p.published_at,
        modules: parseModules(p.modules),
        seo: (p.seo as SeoFields | null) ?? null,
      };
      const d = (p.draft as unknown as PostDoc | null) ?? base;
      d.modules = parseModules(d.modules);
      if (!d.modules.length && p.body.trim()) {
        d.modules = markdownToBlocks(p.body);
        setConverted(true);
      }
      if (!d.modules.length || d.modules[0]!.type !== "rich_text")
        d.modules = [newBlock("rich_text"), ...d.modules];
      setDoc(d);
      setLive({ published: p.published, hasDraft: p.draft != null });
    });
  }, [id]);

  const update = useCallback(
    (next: PostDoc) => {
      setDoc(next);
      setLive((l) => ({ ...l, hasDraft: true }));
      setSave("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          await savePostDraft({ data: { id, draft: next as unknown as Record<string, unknown> } });
          setSave("saved");
        } catch (e) {
          setSave("error");
          toast.error((e as Error).message);
        }
      }, 1000);
    },
    [id],
  );

  const toFrame = (m: StudioMessage) =>
    frame.current?.contentWindow?.postMessage(m, window.location.origin);
  useEffect(() => {
    if (doc) toFrame({ type: "studio-article", post: doc });
  }, [doc]);
  useEffect(() => {
    toFrame({ type: "studio-selected", section: sel ? `post:${sel}` : null });
  }, [sel]);

  const mods = doc?.modules ?? [];
  const setMods = (m: ArticleModule[]) => doc && update({ ...doc, modules: m });
  const setBlock = (b: ArticleModule) => setMods(mods.map((m) => (m.id === b.id ? b : m)));
  const insert = (afterId: string, blocks: ArticleModule[]) => {
    const at = mods.findIndex((m) => m.id === afterId) + 1 || mods.length;
    setMods([...mods.slice(0, at), ...blocks, ...mods.slice(at)]);
    setInsertAfter(null);
    setSel(blocks[0]!.id);
    setPanel(true);
  };
  /** "post:title" / "post:excerpt" / "post:cover_url" / "post:block.<id>.<prop>" */
  const setField = (field: string, value: string) => {
    if (!doc || !field.startsWith("post:")) return;
    const path = field.slice(5);
    if (path.startsWith("block.")) {
      const [, bid, prop] = path.split(".");
      const b = mods.find((m) => m.id === bid);
      if (b && (b as any)[prop!] !== value) setBlock({ ...b, [prop!]: value } as ArticleModule);
    } else if ((doc as any)[path] !== value) update({ ...doc, [path]: value });
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent<StudioMessage>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow || !doc)
        return;
      const m = e.data;
      if (comments.handle(m)) return;
      const target = (s: string | null) => (s?.startsWith("post:") ? s.slice(5) : null);
      if (m.type === "studio-ready") {
        comments.sync();
        toFrame({ type: "studio-article", post: doc });
        toFrame({ type: "studio-selected", section: sel ? `post:${sel}` : null });
      }
      if (m.type === "studio-edit") setField(m.field, m.value);
      if (m.type === "studio-select") {
        setSel(target(m.section));
        setInsertAfter(null);
        if (m.section) setPanel(true);
      }
      if (m.type === "studio-move") {
        const bid = target(m.section)!;
        const order = moveSection(
          mods.slice(1).map((x) => x.id),
          bid,
          m.dir,
        );
        if (order) setMods([mods[0]!, ...order.map((x) => mods.find((y) => y.id === x)!)]);
      }
      if (m.type === "studio-insert") {
        setInsertAfter(target(m.section));
        setSel(null);
        setPanel(true);
      }
      if (m.type === "studio-image") {
        setImageField(m.field);
        fileInput.current?.click();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  if (!doc) return <p className="p-10 text-muted-foreground">Loading…</p>;
  const problems = articleProblems(doc);
  const selIndex = mods.findIndex((m) => m.id === sel);
  const block = selIndex >= 0 ? mods[selIndex]! : null;

  const publish = async () => {
    if (problems.length) {
      toast.error(problems[0]);
      return;
    }
    clearTimeout(timer.current);
    // Author, date, web address and search settings belong to the insight's Settings, which save
    // them live: publishing only adds the content edited here, so it can never undo a setting.
    let published_at: string;
    try {
      ({ published_at } = await publishPost({
        data: {
          id,
          title: doc.title,
          excerpt: doc.excerpt,
          cover_url: doc.cover_url,
          modules: doc.modules,
        },
      }));
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setDoc({ ...doc, published_at });
    setLive({ published: true, hasDraft: false });
    setSave("idle");
    setConverted(false);
    qc.invalidateQueries();
    toast.success(live.published ? "Live article updated" : "Published");
  };
  const unpublish = async () => {
    if (!confirm("Take this article off the live site?")) return;
    try {
      await unpublishPost({ data: { id } });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setLive((l) => ({ ...l, published: false }));
    qc.invalidateQueries();
  };
  const discard = async () => {
    if (!confirm("Discard unpublished changes?")) return;
    clearTimeout(timer.current);
    try {
      await discardPostDraft({ data: { id } });
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // With nothing selected: how to edit, what's missing before publishing, and where the
  // insight's settings live (author, date, web address, search & sharing: Insights → Settings).
  const articleHint = (
    <>
      <p className="text-sm text-muted-foreground">
        Click a block or any outlined text on the page to edit it. Hover a block to move it up or
        down, or + to add one below. Changes save as a draft until you publish.
      </p>
      {problems.length > 0 && (
        <div className="rounded-sm border border-border p-3 text-sm">
          <p className="mb-1 font-medium">Before publishing</p>
          <ul className="list-disc pl-4 text-muted-foreground">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Author, publish date, web address and search settings are in{" "}
        <Link
          to="/admin/insight-settings/$id"
          params={{ id }}
          className="underline underline-offset-2 hover:text-foreground"
        >
          this insight's Settings
        </Link>
        .
      </p>
    </>
  );
  const status = !live.published ? "Draft" : live.hasDraft ? "Live · unpublished changes" : "Live";

  return (
    <StudioShell
      back={{ to: "/admin", label: "Insights" }}
      title={doc.title || "Untitled"}
      status={status}
      live={live.published && !live.hasDraft}
      saving={save === "saving"}
      dirty={live.hasDraft}
      canDiscard={live.hasDraft && live.published}
      onDiscard={discard}
      publishLabel={live.published ? "Update" : "Publish"}
      publishDisabled={live.published && !live.hasDraft && !converted}
      onPublish={publish}
      extra={
        live.published && (
          <Button size="sm" variant="ghost" onClick={unpublish}>
            Unpublish
          </Button>
        )
      }
      notice={
        converted && (
          <p className="studio-notice">
            This article was converted from its original text into blocks. Check it, then Update to
            confirm — the original text is kept until then.
          </p>
        )
      }
      frameRef={frame}
      src="/studio/article?studio=1"
      panel={panel}
      setPanel={setPanel}
      onEscape={() => {
        if (comments.on) return comments.back();
        setSel(null);
        setInsertAfter(null);
      }}
      device={comments.device}
      setDevice={comments.setDevice}
      comments={{ on: comments.on, toggle: comments.toggle, forMe: comments.forMe }}
      switcher={{ kind: "post", id }}
      outside={
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            const field = imageField;
            e.target.value = "";
            if (!f || !field) return;
            try {
              setField(field, await uploadMedia(f));
              toast.success("Image added to draft");
            } catch (err: any) {
              toast.error(err.message);
            }
          }}
        />
      }
    >
      {comments.on ? (
        comments.panel
      ) : insertAfter ? (
        <>
          <PanelHeading title="Add a block" onDone={() => setInsertAfter(null)} />
          <div className="grid grid-cols-2 gap-2">
            {INSERTABLE.map((t) => (
              <Button key={t} variant="outline" onClick={() => insert(insertAfter, [newBlock(t)])}>
                {BLOCK_LABELS[t]}
              </Button>
            ))}
          </div>
        </>
      ) : sel === "details" ? (
        articleHint
      ) : sel === "cover" ? (
        <>
          <PanelHeading title="Cover image (required)" onDone={() => setSel(null)} />
          {doc.cover_url && (
            <img src={doc.cover_url} alt="" className="max-h-40 rounded-sm object-cover" />
          )}
          <Upload
            label={doc.cover_url ? "Replace cover" : "Upload cover"}
            onUrl={(u) => update({ ...doc, cover_url: u })}
          />
        </>
      ) : block ? (
        <>
          <PanelHeading
            title={selIndex === 0 ? "First paragraph (required)" : BLOCK_LABELS[block.type]}
            onDone={() => setSel(null)}
          />
          <BlockFields
            b={block}
            set={setBlock}
            onPasteBlocks={(bs) => {
              const [first, ...rest] = bs;
              if (block.type === "rich_text" && first?.type === "rich_text") {
                const merged = {
                  ...block,
                  body: [block.body.trim(), first.body].filter(Boolean).join("\n\n"),
                };
                setMods([...mods.slice(0, selIndex), merged, ...rest, ...mods.slice(selIndex + 1)]);
              } else setMods([...mods.slice(0, selIndex + 1), ...bs, ...mods.slice(selIndex + 1)]);
            }}
          />
          {selIndex > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMods(mods.filter((m) => m.id !== block.id));
                setSel(null);
              }}
            >
              Delete block
            </Button>
          )}
        </>
      ) : (
        articleHint
      )}
    </StudioShell>
  );
}
