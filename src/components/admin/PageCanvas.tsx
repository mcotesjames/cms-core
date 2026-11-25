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
import { FieldsEditor, type FieldCtx } from "@/components/admin/fields/FieldInput";
import { ItemPanel } from "@/components/admin/ItemPanel";
import { useReferenceOptions } from "@/components/admin/useRecords";
import { itemAddress, parseItemAddress } from "@/lib/group-items";
import type { FieldDef } from "@/lib/fields";
import { MenuPanel } from "@/components/admin/MenuPanel";
import { useCanvasComments } from "@/components/admin/useCanvasComments";
import { usePages } from "@/components/admin/usePages";
import { Link } from "@tanstack/react-router";
import { pageAnchor } from "@/lib/comments";
import { useQuery } from "@tanstack/react-query";
import { siteContentQuery } from "@/lib/site-content";
import { parseMenuItem, resolveMenus, type Menus } from "@/lib/menus";
import { getPath, setPath, useSiteDraft } from "@/components/admin/useSiteDraft";
import { uploadMedia } from "@/lib/media";
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
import { sectionDef, sectionDefaults } from "@/lib/page-sections";
import { templateDef } from "@/lib/templates";

/** A field in the side panel: its declaration and its CMS address ("key:path"). */
type F = { def: FieldDef; field: string };
type Block = {
  title: string;
  fields: F[];
  removable: boolean;
  menu?: "main" | "footer" | undefined;
};

/** Every page's pinned hero (title + intro): editable, can have sections added after it, never moved or deleted. */
const heroBlock = (key: PageKey): Block => ({
  title: "Hero",
  removable: false,
  fields: [
    { field: `${key}:intro.title`, def: { name: "title", label: "Title", type: "text" } },
    { field: `${key}:intro.summary`, def: { name: "summary", label: "Intro", type: "longText" } },
  ],
});
const FOOTER: Block = {
  title: "Footer (site-wide)",
  removable: false,
  fields: [
    { field: "settings:footer_heading", def: { name: "heading", label: "Heading", type: "text" } },
    {
      field: "settings:footer_tagline",
      def: { name: "tagline", label: "Tagline", type: "longText" },
    },
  ],
};

const BANNER: Block = {
  title: "Announcement (site-wide)",
  removable: false,
  fields: [
    {
      field: "settings:banner.on",
      def: { name: "on", label: "Show the announcement", type: "boolean" },
    },
    {
      field: "settings:banner.text",
      def: { name: "text", label: "Text", type: "text", maxLength: 140 },
    },
    {
      field: "settings:banner.link",
      def: { name: "link", label: "Links to (optional)", type: "link" },
    },
    {
      field: "settings:banner.starts",
      def: {
        name: "starts",
        label: "Starts",
        help: "Optional. Site time.",
        type: "date",
        time: true,
      },
    },
    {
      field: "settings:banner.ends",
      def: { name: "ends", label: "Ends", help: "Optional. Site time.", type: "date", time: true },
    },
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
  const referenceOptions = useReferenceOptions();
  const settingsDraft = useSiteDraft("settings");
  /** Site-wide menus (main + footer), edited on the canvas like everything else. */
  const menusDraft = useSiteDraft("menus");
  const liveSite = (useQuery(siteContentQuery).data ?? {}) as Record<string, unknown>;
  const frame = useRef<HTMLIFrameElement>(null);
  const [panel, setPanel] = useState(true);
  /** A section address on the canvas: "home:hero", "home:<section id>" or "settings:footer". */
  const [selected, setSelected] = useState<string | null>(null);
  /** The menu link or column open in the panel ("menu:<id>"), inside the selected menu. */
  const [item, setItem] = useState<string | null>(null);
  /** Scroll the canvas to the item on the next selection change (when it was picked or added in the panel). */
  const scrollNext = useRef(false);
  /** Set while choosing a section to add: the id it goes after, or null for straight after the hero. */
  const [inserting, setInserting] = useState<{ after: string | null } | null>(null);
  const [imageField, setImageField] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
    });
  };
  useEffect(send, [key, pageDraft.doc, settingsDraft.doc, menusDraft.doc]);
  useEffect(() => {
    toFrame({ type: "studio-selected", section: selected, item, scroll: scrollNext.current });
    scrollNext.current = false;
  }, [selected, item]);

  /** Selects a section (and optionally a menu link or column in it); clearing the section clears the item. */
  const select = (section: string | null, it: string | null = null) => {
    setSelected(section);
    setItem(section ? it : null);
  };

  /** The section id inside a "key:id" address on this page, or null for anything else. */
  const sectionId = (address: string | null) =>
    address?.startsWith(`${key}:`) ? address.slice(key.length + 1) : null;

  const describe = (address: string | null): Block | null => {
    if (!address) return null;
    if (address === `${key}:hero`) return heroBlock(key);
    if (address === "settings:footer") return FOOTER;
    if (address === "settings:banner") return BANNER;
    if (address === "menus:main")
      return { title: "Main menu", removable: false, fields: [], menu: "main" };
    if (address === "menus:footer")
      return { title: "Footer menu", removable: false, fields: [], menu: "footer" };
    const id = sectionId(address);
    const inst = id ? resolveSection(key, pageDraft.doc, id) : null;
    if (!inst) return null;
    const def = sectionDef(inst.type);
    return {
      title: def.label,
      // Sections the page's template requires can be moved but not deleted.
      removable: !isRequired(key, pageDraft.doc, inst.id),
      fields: def.fields.map((f) => ({ def: f, field: inst.fields[f.name]! })),
    };
  };

  const setField = (field: string, value: unknown) => {
    const f = parseField(field);
    const d = f && drafts[f.key];
    if (!f || !d?.doc) return;
    if (JSON.stringify(getPath(d.doc, f.path) ?? "") !== JSON.stringify(value ?? ""))
      d.update(setPath(d.doc, f.path, value));
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
    const own = (pageDraft.doc["section_data"] ?? {}) as Record<string, Record<string, unknown>>;
    const untouched = resolveSections(key, pageDraft.doc).every((s) => {
      if (!isRequired(key, pageDraft.doc, s.id)) return false;
      const start: Record<string, unknown> = { type: s.type, ...sectionDefaults(s.type) };
      const data = own[s.id] ?? {};
      const names = new Set([...Object.keys(start), ...Object.keys(data)]);
      const same = (a: unknown, b: unknown) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
      return [...names].every((n) => same(data[n], start[n]));
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
        const gi = parseItemAddress(m.item);
        if (gi && gi.page === key) select(`${key}:${gi.section}`, m.item!);
        else select(b ? m.section : null, b?.menu && parseMenuItem(m.item) ? m.item! : null);
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
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  if (!pageDraft.doc || !settingsDraft.doc || !menusDraft.doc || (!page && !pagesReg.ready))
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
  const dirty = pageDraft.hasDraft || settingsDraft.hasDraft || menusDraft.hasDraft;
  const saving = [pageDraft, settingsDraft, menusDraft].some((d) => d.save === "saving");
  const menus = resolveMenus(menusDraft.doc, settingsDraft.doc);
  const updateMenus = (m: Menus) => menusDraft.update(m as unknown as Record<string, unknown>);
  const menuCtx = {
    site: { ...liveSite, [key]: pageDraft.doc, settings: settingsDraft.doc },
  };
  const block = describe(selected);
  // A repeating item of the selected section, opened in its own panel view.
  const openItem =
    selected && item && parseItemAddress(item)?.section === sectionId(selected) ? item : null;
  const valueOf = (field: string): unknown => {
    const f = parseField(field)!;
    return getPath(drafts[f.key]!.doc!, f.path);
  };
  const fieldCtx: FieldCtx = { site: menuCtx.site, referenceOptions };

  const publish = async () => {
    // Search settings are saved live from the page's Settings; publishing keeps them.
    if (pageDraft.hasDraft || unpublishedPage) await pageDraft.publish({ keep: ["seo"] });
    if (settingsDraft.hasDraft) await settingsDraft.publish();
    if (menusDraft.hasDraft) await menusDraft.publish();
    // A created page goes live the first time it's published.
    if (unpublishedPage && (await pagesReg.update(key, { published: true })))
      toast.success(`The page is now live at ${SITE_HOST}${page.path}`);
  };
  const discard = async () => {
    if (!confirm("Discard unpublished changes?")) return;
    if (pageDraft.hasDraft) await pageDraft.discard(false);
    if (settingsDraft.hasDraft) await settingsDraft.discard(false);
    if (menusDraft.hasDraft) await menusDraft.discard(false);
    setItem(null);
  };
  const template = templateOf(key, pageDraft.doc);
  const pageSections = resolveSections(key, pageDraft.doc);
  /** "2 Text sections, Image": what a template switch would clear. */
  const clearing = (() => {
    const counts = new Map<SectionType, number>();
    for (const s of pageSections) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
    return [...counts]
      .map(([t, n]) => (n > 1 ? `${n} ${sectionDef(t).label} sections` : sectionDef(t).label))
      .join(", ");
  })();

  return (
    <StudioShell
      back={{ to: "/admin", label: "Studio" }}
      title={page.title}
      status={unpublishedPage ? "Not published yet" : dirty ? "Unpublished changes" : "Live"}
      live={!dirty && !unpublishedPage}
      tone={unpublishedPage ? "draft" : dirty ? "changes" : "live"}
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
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          />
          <AlertDialog
            open={pendingTemplate != null}
            onOpenChange={(o) => !o && setPendingTemplate(null)}
          >
            {pendingTemplate && (
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Switch to {templateDef(pendingTemplate).label}?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        This clears the page's {pageSections.length}{" "}
                        {pageSections.length === 1 ? "section" : "sections"}
                        {clearing && ` (${clearing})`} and starts it
                        {templateDef(pendingTemplate).required.length
                          ? ` with ${templateDef(pendingTemplate)
                              .required.map((t) => `an ${sectionDef(t).label}`)
                              .join(" and ")} section`
                          : " empty"}
                        .{" "}
                        {templateDef(pendingTemplate).hero
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
                {sectionDef(t).label}
              </Button>
            ))}
          </div>
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
      ) : block && selected && openItem ? (
        <ItemPanel
          sectionLabel={block.title}
          address={openItem}
          doc={pageDraft.doc}
          ctx={fieldCtx}
          update={(d) => pageDraft.update(d)}
          setField={setField}
          onOpen={(addr) => {
            scrollNext.current = true;
            setItem(addr);
          }}
          onBack={() => setItem(null)}
        />
      ) : block && selected ? (
        <>
          <PanelHeading title={block.title} onDone={() => select(null)} />
          <FieldsEditor
            defs={block.fields.map((f) => f.def)}
            values={Object.fromEntries(block.fields.map((f) => [f.def.name, valueOf(f.field)]))}
            onChange={(name, v) => {
              const f = block.fields.find((x) => x.def.name === name);
              if (f) setField(f.field, v);
            }}
            ctx={fieldCtx}
            onOpenItem={(name, id) => {
              const f = block.fields.find((x) => x.def.name === name);
              if (!f) return;
              scrollNext.current = true;
              setItem(itemAddress(f.field, id));
            }}
          />
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
                      {templateDef(t).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="block text-xs text-muted-foreground">
                {templateDef(template).description} Switching clears the page's sections.
              </span>
            </PanelField>
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
            The footer and menus are site-wide: editing them here changes every page.
          </p>
        </>
      )}
    </StudioShell>
  );
}
