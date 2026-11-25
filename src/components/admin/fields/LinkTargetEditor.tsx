import { Input } from "@/components/ui/input";
import { PanelField } from "@/components/admin/StudioShell";
import { allPages } from "@/lib/pages";
import { readField, resolveSections, sectionDef, type PageKey } from "@/lib/page-sections";
import { LINK_KINDS, PAGE_NAMES, blankTarget, type LinkTarget } from "@/lib/menus";

export const SELECT =
  "h-10 w-full rounded-lg border border-input bg-[var(--st-card-inset)] px-3 text-sm";

/**
 * Picks where a link goes: a page, a section of a page, a web address or an email. Shared by
 * menus and link fields, so every link in the Studio points at things, not raw paths.
 */
export function LinkTargetEditor({
  value,
  onChange,
  site,
  label = "Links to",
}: {
  value: LinkTarget;
  onChange: (t: LinkTarget) => void;
  /** Site content (live merged with drafts) for the page and section lists. */
  site: Record<string, unknown>;
  label?: string;
}) {
  const t = value;
  // Built-in and created pages; drafts marked (a link to one stays hidden until it's published).
  const pageOptions = allPages(site).map((pg) => ({
    key: pg.key,
    label: `${PAGE_NAMES[pg.key] ?? pg.title}${pg.published ? "" : " (draft)"}`,
  }));
  const pages = (val: string, set: (k: PageKey) => void) => (
    <select className={SELECT} value={val} onChange={(e) => set(e.target.value as PageKey)}>
      {pageOptions.map((pg) => (
        <option key={pg.key} value={pg.key}>
          {pg.label}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <PanelField label={label}>
        <select
          className={SELECT}
          value={t.kind}
          onChange={(e) => onChange(blankTarget(e.target.value as LinkTarget["kind"]))}
        >
          {LINK_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </PanelField>
      {t.kind === "page" && (
        <PanelField label="Page">
          {pages(t.page, (page) => onChange({ kind: "page", page }))}
        </PanelField>
      )}
      {t.kind === "section" && (
        <>
          <PanelField label="Page">
            {pages(t.page, (page) => onChange({ kind: "section", page, section: "" }))}
          </PanelField>
          <PanelField label="Section">
            <select
              className={SELECT}
              value={t.section}
              onChange={(e) => onChange({ ...t, section: e.target.value })}
            >
              <option value="">Choose a section…</option>
              {sectionChoices(t.page, site).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </PanelField>
        </>
      )}
      {t.kind === "url" && (
        <PanelField label="Web address (opens in a new tab)">
          <Input
            value={t.url}
            placeholder="https://…"
            onChange={(e) => onChange({ kind: "url", url: e.target.value })}
          />
        </PanelField>
      )}
      {t.kind === "email" && (
        <PanelField label="Email address">
          <Input
            type="email"
            value={t.email}
            onChange={(e) => onChange({ kind: "email", email: e.target.value })}
          />
        </PanelField>
      )}
    </>
  );
}

/** Sections a link can point to on a page, labelled by type (with a snippet for text sections). */
function sectionChoices(page: PageKey, site: Record<string, unknown>) {
  return resolveSections(page, site[page] as Record<string, unknown> | undefined).map((s) => {
    const text = s.fields["text"] ? readField(site, s.fields["text"]) : "";
    const snippet = text ? ` — “${text.slice(0, 32)}${text.length > 32 ? "…" : ""}”` : "";
    return { id: s.id, label: `${sectionDef(s.type).label}${snippet}` };
  });
}
