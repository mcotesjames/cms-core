import { SITE_HOST } from "@/lib/seo";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { StudioShell, PanelHeading, PanelField } from "@/components/admin/StudioShell";
import { FieldInput } from "@/components/admin/TableEditor";
import { useListDrafts } from "@/components/admin/useListDrafts";
import { MenuPanel } from "@/components/admin/MenuPanel";
import { useCanvasComments } from "@/components/admin/useCanvasComments";
import { usePages } from "@/components/admin/usePages";
import { Link } from "@tanstack/react-router";
import { pageAnchor } from "@/lib/comments";
import { useQuery } from "@tanstack/react-query";
import { postsQuery } from "@/lib/content";
import { siteContentQuery } from "@/lib/site-content";
import { parseMenuItem, resolveMenus, type Menus } from "@/lib/menus";
import { getPath, setPath, useSiteDraft } from "@/components/admin/useSiteDraft";
import { uploadMedia } from "@/lib/media";
import { interactiveFileProblem, previewInteractive } from "@/lib/interactive";
import {
  TEMPLATES,
  TEMPLATE_ORDER,
  switchTemplate,
  templateOf,
  type TemplateKey,
} from "@/lib/templates";
import { moveSection, parseField, type StudioMessage } from "@/lib/studio-mode";
import {
  SECTION_TYPES,
  availableTypes,
  insertSection,
  isPageKey,
  isRequired,
  resolveSections,
  newSectionId,
  removeSection,
  resolveSection,
  sectionOrder,
  type PageKey,
  type SectionType,
} from "@/lib/page-sections";
import {
  LISTS,
  itemAddress,
  moveItem,
  newItem,
  parseItem,
  type ListName,
  type ListRow,
} from "@/lib/list-drafts";

type F = {
  field: string;
  label: string;
  multi?: boolean | undefined;
  image?: boolean | undefined;
  file?: { accept: string } | undefined;
  options?: Array<{ value: string; label: string }> | undefined;
};
type Block = {
  title: string;
  fields: F[];
  list?: ListName | undefined;
  source?: string | undefined;
  removable: boolean;
  menu?: "main" | "footer" | undefined;
};

/** Each page's pinned hero: editable, can have sections added after it, never moved or deleted. */
const HEROES: Partial<Record<PageKey, Block>> = {
  home: {
    title: "Hero",
    removable: false,
    fields: [
      { field: "home:hero.headline", label: "Headline", multi: true },
      { field: "home:hero.cta_label", label: "Button label" },
    ],
  },
  insights: {
    title: "Hero",
    removable: false,
    fields: [
      { field: "insights:intro.title", label: "Title" },
      { field: "insights:intro.note", label: "Note", multi: true },
    ],
  },
  investments: {
    title: "Hero",
    removable: false,
    fields: [
      { field: "investments:intro.eyebrow", label: "Eyebrow" },
      { field: "investments:intro.title_line_1", label: "Title line 1" },
      { field: "investments:intro.title_line_2", label: "Title line 2" },
      { field: "investments:intro.summary", label: "Summary", multi: true },
    ],
  },
  publications: {
    title: "Hero",
    removable: false,
    fields: [
      { field: "publications:intro.eyebrow", label: "Eyebrow" },
      { field: "publications:intro.title", label: "Title" },
      { field: "publications:intro.summary", label: "Summary", multi: true },
    ],
  },
};
/** A created page's hero: title and summary. */
const customHero = (key: PageKey): Block => ({
  title: "Hero",
  removable: false,
  fields: [
    { field: `${key}:intro.title`, label: "Title" },
    { field: `${key}:intro.summary`, label: "Summary", multi: true },
  ],
});
const FOOTER: Block = {
  title: "Footer (site-wide)",
  removable: false,
  fields: [
    { field: "settings:footer_heading", label: "Heading" },
    { field: "settings:footer_tagline", label: "Tagline", multi: true },
  ],
};

/**
 * `focusComment` opens comment mode on that thread (linked from the Feedback list); `initial`
 * carries the device view and comment mode over from the page switcher.
 */
export function PageCanvas({
  pageKey,
  focusComment,
  initial,
}: {
  pageKey: PageKey;
  focusComment?: string | undefined;
  initial?:
    { device?: "tablet" | "mobile" | undefined; commenting?: boolean | undefined } | undefined;
}) {
  const key = pageKey;
  const pagesReg = usePages();
  /** The page's name and address (built-in, or from the list of created pages). */
  const page = pagesReg.all.find((p) => p.key === key);
  const pageDraft = useSiteDraft(key);
  const settingsDraft = useSiteDraft("settings");
  /** Site-wide menus (main + footer), edited on the canvas like everything else. */
  const menusDraft = useSiteDraft("menus");
  const livePosts = useQuery(postsQuery).data ?? [];
  const liveSite = (useQuery(siteContentQuery).data ?? {}) as Record<string, unknown>;
  const frame = useRef<HTMLIFrameElement>(null);
  const [panel, setPanel] = useState(true);
  /** A section address on the canvas: "home:hero", "home:<section id>" or "settings:footer". */
  const [selected, setSelected] = useState<string | null>(null);
  /** The list item open in the panel ("pillars:<id>"), inside the selected section. */
  const [item, setItem] = useState<string | null>(null);
  /** Scroll the canvas to the item on the next selection change (when it was picked or added in the panel). */
  const scrollNext = useRef(false);
  const lists = useListDrafts();
  /** Set while choosing a section to add: the id it goes after, or null for straight after the hero. */
  const [inserting, setInserting] = useState<{ after: string | null } | null>(null);
  const [imageField, setImageField] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /** The file field (e.g. an interactive's HTML file) the second file input uploads to. */
  const [fileField, setFileField] = useState<F | null>(null);
  const docInput = useRef<HTMLInputElement>(null);
  /** A template switch waiting for the user to confirm clearing the page's sections. */
  const [pendingTemplate, setPendingTemplate] = useState<TemplateKey | null>(null);
  const comments = useCanvasComments({
    frame,
    here: pageAnchor(key),
    hereLabel: "the page as a whole",
    focus: focusComment,
    initial,
  });
  // Comment mode pauses editing: nothing stays selected, and the panel shows the comments.
  useEffect(() => {
    if (!comments.on) return;
    select(null);
    setInserting(null);
    setPanel(true);
  }, [comments.on]);
  const drafts = { [key]: pageDraft, settings: settingsDraft, menus: menusDraft } as Record<
    string,
    ReturnType<typeof useSiteDraft>
  >;

  const toFrame = (m: StudioMessage) =>
    frame.current?.contentWindow?.postMessage(m, window.location.origin);
  // Keep the canvas showing the current drafts.
  const send = () => {
    if (!pageDraft.doc || !settingsDraft.doc || !menusDraft.doc) return;
    toFrame({
      type: "studio-content",
      content: { [key]: pageDraft.doc, settings: settingsDraft.doc, menus: menusDraft.doc },
      lists: lists.ready ? lists.lists : undefined,
    });
  };
  useEffect(send, [pageDraft.doc, settingsDraft.doc, menusDraft.doc, lists.list]);
  useEffect(() => {
    toFrame({ type: "studio-selected", section: selected, item, scroll: scrollNext.current });
    scrollNext.current = false;
  }, [selected, item]);

  /** Selects a section (and optionally one of its list items); clearing the section clears the item. */
  const select = (section: string | null, it: string | null = null) => {
    setSelected(section);
    setItem(section ? it : null);
  };

  /** The section id inside a "key:id" address on this page, or null for anything else. */
  const sectionId = (address: string | null) =>
    address?.startsWith(`${key}:`) ? address.slice(key.length + 1) : null;

  const describe = (address: string | null): Block | null => {
    if (!address) return null;
    if (address === `${key}:hero`) return HEROES[key] ?? customHero(key);
    if (address === "settings:footer") return FOOTER;
    if (address === "menus:main")
      return { title: "Main menu", removable: false, fields: [], menu: "main" };
    if (address === "menus:footer")
      return { title: "Footer menu", removable: false, fields: [], menu: "footer" };
    const id = sectionId(address);
    const inst = id ? resolveSection(key, pageDraft.doc, id) : null;
    if (!inst) return null;
    const def = SECTION_TYPES[inst.type];
    return {
      title: def.label,
      // Sections the page's template requires can be moved but not deleted.
      removable: !isRequired(key, pageDraft.doc, inst.id),
      list: def.list,
      source: def.source,
      fields: def.fields.map((f) => ({
        field: inst.fields[f.name]!,
        label: f.label,
        multi: f.multi,
        image: f.image,
        file: f.file,
        options: f.options,
      })),
    };
  };

  const setField = (field: string, value: string) => {
    const f = parseField(field);
    const d = f && drafts[f.key];
    if (!f || !d?.doc) return;
    if ((getPath(d.doc, f.path) ?? "") !== value) d.update(setPath(d.doc, f.path, value));
  };

  // List items (pillars, cards, hotspots): edited as a draft, shown on the canvas straight away.
  const openItem = parseItem(item);
  const updateItem = (k: string, v: unknown) => {
    if (!openItem) return;
    lists.update(
      openItem.list,
      lists.list(openItem.list).map((r) => (r.id === openItem.id ? { ...r, [k]: v } : r)),
    );
  };
  const pickItem = (list: ListName, id: string) => {
    scrollNext.current = true;
    setItem(itemAddress(list, id));
  };
  const addItem = (list: ListName) => {
    const row = newItem(list, crypto.randomUUID());
    lists.update(list, [...lists.list(list), row]);
    pickItem(list, row.id);
  };
  const deleteItem = () => {
    if (!openItem) return;
    lists.update(
      openItem.list,
      lists.list(openItem.list).filter((r) => r.id !== openItem.id),
    );
    setItem(null);
  };
  const moveListItem = (list: ListName, id: string, dir: -1 | 1) => {
    const next = moveItem(lists.list(list), id, dir);
    if (next) lists.update(list, next);
  };

  const addSection = (type: SectionType) => {
    if (!pageDraft.doc || !inserting) return;
    const r = insertSection(key, pageDraft.doc, inserting.after, type, newSectionId());
    if (!r) return;
    pageDraft.update(r.doc);
    setInserting(null);
    select(`${key}:${r.id}`);
  };
  const deleteSection = (address: string) => {
    const id = sectionId(address);
    if (!id || !pageDraft.doc || isRequired(key, pageDraft.doc, id)) return;
    pageDraft.update(removeSection(key, pageDraft.doc, id));
    select(null);
  };

  /** A sibling value of a file field in the same section ("…section_data.<id>.file_name"). */
  const sibling = (field: string, name: string) => field.replace(/\.[^.]+$/, `.${name}`);
  /** Uploads a new version of a file field; the current one becomes the previous version. */
  const uploadFile = async (f: File, field: F) => {
    const problem = interactiveFileProblem(f);
    if (problem) {
      toast.error(problem);
      return;
    }
    const addr = parseField(field.field);
    const d = addr && drafts[addr.key];
    if (!addr || !d?.doc) return;
    try {
      const url = await uploadMedia(f, { contentType: "text/html" });
      const doc = d.doc;
      const p = addr.path;
      const at = (name: string) => sibling(p, name);
      let next = setPath(doc, at("previous_url"), (getPath(doc, p) as string) ?? "");
      next = setPath(next, at("previous_name"), (getPath(doc, at("file_name")) as string) ?? "");
      next = setPath(next, p, url);
      next = setPath(next, at("file_name"), f.name);
      d.update(next);
      toast.success("New version uploaded to draft — publish to go live");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  /** Swaps the current and previous versions of a file field, so restoring can be undone. */
  const restoreFile = (field: F) => {
    const addr = parseField(field.field);
    const d = addr && drafts[addr.key];
    if (!addr || !d?.doc) return;
    const doc = d.doc;
    const p = addr.path;
    const at = (name: string) => sibling(p, name);
    const get = (path: string) => (getPath(doc, path) as string) ?? "";
    let next = setPath(doc, p, get(at("previous_url")));
    next = setPath(next, at("file_name"), get(at("previous_name")));
    next = setPath(next, at("previous_url"), get(p));
    next = setPath(next, at("previous_name"), get(at("file_name")));
    d.update(next);
    toast.success("Previous version restored in draft — publish to go live");
  };

  /** Clears the page's sections and starts it on another template (a draft edit). */
  const applyTemplate = (to: TemplateKey) => {
    if (!pageDraft.doc) return;
    const next = switchTemplate(pageDraft.doc, to, newSectionId);
    pageDraft.update(next);
    setPendingTemplate(null);
    const first = (next["sections"] as string[])[0];
    select(first ? `${key}:${first}` : null);
  };
  /** Asks before switching when that would clear anything beyond the untouched starting sections. */
  const chooseTemplate = (to: TemplateKey) => {
    if (!pageDraft.doc || to === templateOf(key, pageDraft.doc)) return;
    const own = (pageDraft.doc["section_data"] ?? {}) as Record<string, Record<string, string>>;
    const untouched = resolveSections(key, pageDraft.doc).every((s) => {
      if (!isRequired(key, pageDraft.doc, s.id)) return false;
      const start: Record<string, string> = { type: s.type, ...SECTION_TYPES[s.type].defaults };
      const data = own[s.id] ?? {};
      const names = new Set([...Object.keys(start), ...Object.keys(data)]);
      return [...names].every((n) => (data[n] ?? "") === (start[n] ?? ""));
    });
    if (untouched) applyTemplate(to);
    else setPendingTemplate(to);
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent<StudioMessage>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data;
      if (comments.handle(m)) return;
      if (m.type === "studio-ready") {
        comments.sync();
        send();
        toFrame({ type: "studio-selected", section: selected, item });
      }
      if (m.type === "studio-edit") setField(m.field, m.value);
      if (m.type === "studio-select") {
        const b = describe(m.section);
        const it = parseItem(m.item);
        const menuItem = b?.menu && parseMenuItem(m.item) ? m.item! : null;
        select(b ? m.section : null, menuItem ?? (b && it && it.list === b.list ? m.item! : null));
        setInserting(null);
        if (m.section || m.field) setPanel(true);
      }
      if (m.type === "studio-move" && pageDraft.doc) {
        const id = sectionId(m.section);
        const n = id ? moveSection(sectionOrder(key, pageDraft.doc), id, m.dir) : null;
        if (n) pageDraft.update({ ...pageDraft.doc, sections: n });
      }
      if (m.type === "studio-insert") {
        const id = sectionId(m.section);
        setInserting({ after: id === "hero" ? null : id });
        select(null);
        setPanel(true);
      }
      if (m.type === "studio-image") {
        setImageField(m.field);
        fileInput.current?.click();
      }
      if (m.type === "studio-place") {
        const it = parseItem(m.item);
        if (it?.list === "hotspots")
          lists.update(
            "hotspots",
            lists.list("hotspots").map((r) => (r.id === it.id ? { ...r, x: m.x, y: m.y } : r)),
          );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  if (
    !pageDraft.doc ||
    !settingsDraft.doc ||
    !menusDraft.doc ||
    !lists.ready ||
    (!page && !pagesReg.ready)
  )
    return <p className="p-10 text-muted-foreground">Loading…</p>;
  if (!page)
    return (
      <p className="p-10 text-muted-foreground">
        This page no longer exists.{" "}
        <a className="underline" href="/admin">
          Back to the Studio
        </a>
      </p>
    );
  const unpublishedPage = page.custom && !page.published;
  const dirty =
    pageDraft.hasDraft || settingsDraft.hasDraft || menusDraft.hasDraft || lists.hasDraft;
  const saving =
    [pageDraft, settingsDraft, menusDraft].some((d) => d.save === "saving") ||
    lists.save === "saving";
  const menus = resolveMenus(menusDraft.doc, settingsDraft.doc);
  const updateMenus = (m: Menus) => menusDraft.update(m as unknown as Record<string, unknown>);
  const menuCtx = {
    posts: livePosts,
    site: { ...liveSite, [key]: pageDraft.doc, settings: settingsDraft.doc },
  };
  const block = describe(selected);
  const valueOf = (field: string) => {
    const f = parseField(field)!;
    return (getPath(drafts[f.key]!.doc!, f.path) as string) ?? "";
  };

  const publish = async () => {
    const onlyLists = !pageDraft.hasDraft && !settingsDraft.hasDraft && !menusDraft.hasDraft;
    if (lists.hasDraft && !(await lists.publish())) return;
    // Search settings are saved live from the page's Settings; publishing keeps them.
    if (pageDraft.hasDraft || unpublishedPage) await pageDraft.publish({ keep: ["seo"] });
    if (settingsDraft.hasDraft) await settingsDraft.publish();
    if (menusDraft.hasDraft) await menusDraft.publish();
    // A created page goes live the first time it's published.
    if (unpublishedPage && (await pagesReg.update(key, { published: true })))
      toast.success(`The page is now live at ${SITE_HOST}${page.path}`);
    else if (onlyLists) toast.success("Published to the live site");
  };
  const discard = async () => {
    if (!confirm("Discard unpublished changes?")) return;
    if (pageDraft.hasDraft) await pageDraft.discard(false);
    if (settingsDraft.hasDraft) await settingsDraft.discard(false);
    if (menusDraft.hasDraft) await menusDraft.discard(false);
    if (lists.hasDraft) await lists.discard();
    setItem(null);
  };
  const listDef = block?.list ? LISTS[block.list] : null;
  const template = templateOf(key, pageDraft.doc);
  const pageSections = resolveSections(key, pageDraft.doc);
  /** "2 Statements, Insights feed, Biography": what a template switch would clear. */
  const clearing = (() => {
    const counts = new Map<SectionType, number>();
    for (const s of pageSections) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
    const plural: Partial<Record<SectionType, string>> = {
      statement: "Statements",
      footnote: "Small print sections",
    };
    return [...counts]
      .map(([t, n]) =>
        n > 1
          ? `${n} ${plural[t] ?? `${SECTION_TYPES[t].label} sections`}`
          : SECTION_TYPES[t].label,
      )
      .join(", ");
  })();
  const missingInteractive =
    template === "interactive" &&
    !pageSections.some((s) => s.type === "interactive" && valueOf(s.fields["html_url"]!));
  const openRow: ListRow | undefined = openItem
    ? lists.list(openItem.list).find((r) => r.id === openItem.id)
    : undefined;

  return (
    <StudioShell
      back={{ to: "/admin", label: "Studio" }}
      title={page.title}
      status={unpublishedPage ? "Not published yet" : dirty ? "Unpublished changes" : "Live"}
      live={!dirty && !unpublishedPage}
      saving={saving}
      dirty={dirty}
      canDiscard={dirty}
      onDiscard={discard}
      publishLabel="Publish"
      publishDisabled={!dirty && !unpublishedPage}
      onPublish={publish}
      frameRef={frame}
      src={`${page.path}?studio=1`}
      panel={panel}
      setPanel={setPanel}
      onEscape={() => {
        if (comments.on) return comments.back();
        select(null);
        setInserting(null);
      }}
      device={comments.device}
      setDevice={comments.setDevice}
      comments={{ on: comments.on, toggle: comments.toggle, forMe: comments.forMe }}
      switcher={{ kind: "page", key }}
      outside={
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              const field = imageField ? parseField(imageField) : null;
              e.target.value = "";
              const d = field && drafts[field.key];
              if (!f || !field || !d?.doc) return;
              try {
                d.update(setPath(d.doc, field.path, await uploadMedia(f)));
                toast.success("Image replaced in draft");
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          />
          <input
            ref={docInput}
            type="file"
            accept={fileField?.file?.accept ?? ""}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && fileField) await uploadFile(f, fileField);
            }}
          />
          <AlertDialog
            open={pendingTemplate != null}
            onOpenChange={(o) => !o && setPendingTemplate(null)}
          >
            {pendingTemplate && (
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Switch to {TEMPLATES[pendingTemplate].label}?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        This clears the page's {pageSections.length}{" "}
                        {pageSections.length === 1 ? "section" : "sections"}
                        {clearing && ` (${clearing})`} and starts it
                        {TEMPLATES[pendingTemplate].required.length
                          ? ` with ${TEMPLATES[pendingTemplate].required
                              .map((t) => `an ${SECTION_TYPES[t].label}`)
                              .join(" and ")} section`
                          : " empty"}
                        .{" "}
                        {TEMPLATES[pendingTemplate].hero
                          ? "The hero, page name, address and search settings stay."
                          : "The page name, address and search settings stay. This template has no hero; its title and summary are kept and come back if you switch back."}
                      </p>
                      <p>
                        You can undo this with Discard until you publish. After publishing, the
                        cleared sections can't be recovered.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={() => applyTemplate(pendingTemplate)}
                  >
                    Switch and clear sections
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            )}
          </AlertDialog>
        </>
      }
    >
      {comments.on ? (
        comments.panel
      ) : inserting ? (
        <>
          <PanelHeading title="Add a section" onDone={() => setInserting(null)} />
          <div className="grid gap-2">
            {availableTypes(key, pageDraft.doc).map((t) => (
              <Button
                key={t}
                variant="outline"
                className="justify-start"
                onClick={() => addSection(t)}
              >
                {SECTION_TYPES[t].label}
              </Button>
            ))}
          </div>
          {template === "standard" && (
            <p className="text-xs text-muted-foreground">
              Sections that show a shared list (pillars, cards, biography, insights, investments,
              publications) can appear once per page.
            </p>
          )}
        </>
      ) : block && selected && block.menu ? (
        <MenuPanel
          which={block.menu}
          menus={menus}
          update={updateMenus}
          item={item}
          ctx={menuCtx}
          onDone={() => select(null)}
          open={(address, scroll) => {
            if (scroll) scrollNext.current = true;
            setItem(address);
          }}
        />
      ) : block && selected && listDef && openItem && openRow ? (
        <>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setItem(null)}>
              ← {listDef.title}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => select(null)}>
              Done
            </Button>
          </div>
          <h2 className="text-base">{String(openRow[listDef.titleKey] || "Untitled")}</h2>
          {openItem.list === "hotspots" && (
            <p className="text-xs text-muted-foreground">
              Click anywhere on the biography to place this hotspot there.
            </p>
          )}
          {listDef.fields.map((f) => (
            <PanelField key={f.key} label={f.label}>
              <FieldInput
                f={f}
                value={openRow[f.key]}
                onChange={(v) => updateItem(f.key, f.type === "number" ? Number(v) : v)}
              />
            </PanelField>
          ))}
          <Button variant="outline" size="sm" onClick={deleteItem}>
            Delete {listDef.singular}
          </Button>
        </>
      ) : block && selected ? (
        <>
          <PanelHeading title={block.title} onDone={() => select(null)} />
          {block.fields.map((f) =>
            f.file ? (
              <FileFieldControl
                key={f.field}
                f={f}
                url={valueOf(f.field)}
                name={valueOf(sibling(f.field, "file_name"))}
                previousUrl={valueOf(sibling(f.field, "previous_url"))}
                previousName={valueOf(sibling(f.field, "previous_name"))}
                onUpload={() => {
                  setFileField(f);
                  // Let the input pick up this field's accept list before opening.
                  requestAnimationFrame(() => docInput.current?.click());
                }}
                onRestore={() => restoreFile(f)}
              />
            ) : (
              <PanelField key={f.field} label={f.label}>
                {f.options ? (
                  <Select value={valueOf(f.field)} onValueChange={(v) => setField(f.field, v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.image ? (
                  <div className="space-y-2">
                    {valueOf(f.field) && (
                      <img
                        src={valueOf(f.field)}
                        alt=""
                        className="max-h-40 rounded-sm object-cover"
                      />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageField(f.field);
                        fileInput.current?.click();
                      }}
                    >
                      Replace image
                    </Button>
                  </div>
                ) : f.multi ? (
                  <Textarea
                    rows={4}
                    value={valueOf(f.field)}
                    onChange={(e) => setField(f.field, e.target.value)}
                  />
                ) : (
                  <Input
                    value={valueOf(f.field)}
                    onChange={(e) => setField(f.field, e.target.value)}
                  />
                )}
              </PanelField>
            ),
          )}
          {block.source && (
            <p className="text-xs text-muted-foreground">Items come from {block.source}.</p>
          )}
          {block.list && listDef && (
            <section className="space-y-2">
              <h3 className="text-sm">{listDef.title}</h3>
              <ul className="space-y-1">
                {lists.list(block.list).map((r, i, all) => (
                  <li key={r.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className="block min-w-0 flex-1 truncate rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => pickItem(block.list!, r.id)}
                    >
                      {String(r[listDef.titleKey] || "Untitled")}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Move ${String(r[listDef.titleKey] || listDef.singular)} up`}
                      disabled={i === 0}
                      onClick={() => moveListItem(block.list!, r.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Move ${String(r[listDef.titleKey] || listDef.singular)} down`}
                      disabled={i === all.length - 1}
                      onClick={() => moveListItem(block.list!, r.id, 1)}
                    >
                      ↓
                    </Button>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" onClick={() => addItem(block.list!)}>
                + Add {listDef.singular}
              </Button>
            </section>
          )}
          {block.removable && (
            <Button variant="outline" size="sm" onClick={() => deleteSection(selected)}>
              Delete section
            </Button>
          )}
        </>
      ) : (
        <>
          {page.custom && (
            <PanelField label="Template">
              <Select value={template} onValueChange={(v) => chooseTemplate(v as TemplateKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TEMPLATES[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="block text-xs text-muted-foreground">
                {TEMPLATES[template].description} Switching clears the page's sections.
              </span>
            </PanelField>
          )}
          {missingInteractive && (
            <p className="text-sm">Upload the HTML file in the Interactive section.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Click anything on the page to edit it. Hover a section to move it or add one below.
            Changes save as a draft until you publish.
          </p>
          <p className="text-xs text-muted-foreground">
            Name, web address and search settings are in{" "}
            <Link
              to="/admin/page-settings/$key"
              params={{ key }}
              className="underline underline-offset-2 hover:text-foreground"
            >
              this page's Settings
            </Link>
            .
          </p>
          <p className="text-xs text-muted-foreground">
            Footer text and the investments disclaimer are site-wide: editing them here changes
            every page.
          </p>
        </>
      )}
    </StudioShell>
  );
}

/** An uploaded file (not an image): its name, a new version, the previous version and a preview. */
function FileFieldControl({
  f,
  url,
  name,
  previousUrl,
  previousName,
  onUpload,
  onRestore,
}: {
  f: F;
  url: string;
  name: string;
  previousUrl: string;
  previousName: string;
  onUpload: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {f.label}
      </span>
      <p className="truncate text-sm" title={name || undefined}>
        {url ? name || "Uploaded file" : "No file uploaded"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onUpload}>
          {url ? "Upload new version" : "Upload file"}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              previewInteractive(url).catch((e: Error) =>
                toast.error(`Couldn't open the preview: ${e.message}`),
              )
            }
          >
            Preview in new tab
          </Button>
        )}
      </div>
      {previousUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto whitespace-normal p-0 text-left text-xs underline underline-offset-2"
          onClick={onRestore}
        >
          Restore previous version ({previousName || "previous file"})
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        HTML file, up to 5 MB. Uploads go to the draft.
      </p>
    </div>
  );
}
