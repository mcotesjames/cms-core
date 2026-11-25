import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PanelField } from "@/components/admin/StudioShell";
import { allPages } from "@/lib/pages";
import { readField, resolveSections, SECTION_TYPES, type PageKey } from "@/lib/page-sections";
import {
  LINK_KINDS,
  MAIN_MENU_SOFT_LIMIT,
  MAX_FOOTER_COLUMNS,
  PAGE_NAMES,
  addColumn,
  blankTarget,
  columnAddress,
  findLink,
  linkAddress,
  move,
  newLink,
  parseMenuItem,
  resolveLink,
  setButton,
  updateLink,
  type FooterColumn,
  type LinkTarget,
  type MenuLink,
  type Menus,
} from "@/lib/menus";
import { sectionDef } from "@/lib/page-sections";

type Ctx = { site: Record<string, unknown> };

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const uid = () => crypto.randomUUID().slice(0, 8);

/**
 * Side panel for the main or footer menu, selected on the canvas. Three levels: the menu
 * (its links, or its columns), a footer column (heading and links), and a single link.
 */
export function MenuPanel(p: {
  which: "main" | "footer";
  menus: Menus;
  update: (m: Menus) => void;
  /** "menu:<id>" (a link) or "menucol:<id>" (a footer column) open in the panel. */
  item: string | null;
  /** Opens an item; scroll = also bring it into view on the canvas. */
  open: (address: string | null, scroll?: boolean) => void;
  onDone: () => void;
  ctx: Ctx;
}) {
  const { menus, update, open, ctx } = p;
  // Built-in pages and created pages (drafts marked: a link to one stays hidden until it's published).
  const pageOptions = allPages(ctx.site).map((pg) => ({
    key: pg.key,
    label: `${PAGE_NAMES[pg.key] ?? pg.title}${pg.published ? "" : " (draft)"}`,
  }));
  const it = parseMenuItem(p.item);
  const found = it?.kind === "link" ? findLink(menus, it.id) : null;
  const column = it?.kind === "column" ? (menus.footer.find((c) => c.id === it.id) ?? null) : null;
  const menuTitle = p.which === "main" ? "Main menu" : "Footer menu";

  const Header = ({ back, backLabel }: { back?: () => void; backLabel?: string }) => (
    <div className="flex items-center justify-between">
      {back ? (
        <Button variant="ghost" size="sm" onClick={back}>
          ← {backLabel}
        </Button>
      ) : (
        <h2 className="text-base">
          {menuTitle} <span className="text-xs text-muted-foreground">(site-wide)</span>
        </h2>
      )}
      <Button size="sm" variant="ghost" onClick={p.onDone}>
        Done
      </Button>
    </div>
  );

  const LinkRows = ({
    links,
    onMove,
    onAdd,
  }: {
    links: MenuLink[];
    onMove: (id: string, dir: -1 | 1) => void;
    onAdd: () => void;
  }) => (
    <section className="space-y-2">
      <ul className="space-y-1">
        {links.map((l, i) => {
          const r = resolveLink(l.target, ctx);
          return (
            <li key={l.id} className="flex items-center gap-1">
              <button
                type="button"
                className="block min-w-0 flex-1 truncate rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => open(linkAddress(l.id), true)}
              >
                {l.label || "Untitled"}
                {l.button && <span className="ml-2 text-xs text-muted-foreground">button</span>}
                {r.broken && <span className="ml-2 text-xs text-destructive">hidden</span>}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={`Move ${l.label} up`}
                disabled={i === 0}
                onClick={() => onMove(l.id, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={`Move ${l.label} down`}
                disabled={i === links.length - 1}
                onClick={() => onMove(l.id, 1)}
              >
                ↓
              </Button>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" size="sm" onClick={onAdd}>
        + Add link
      </Button>
    </section>
  );

  // ---- A single link
  if (found) {
    const { link, column: col } = found;
    const set = (fn: (l: MenuLink) => MenuLink) => update(updateLink(menus, link.id, fn));
    const setTarget = (t: LinkTarget) => set((l) => ({ ...l, target: t }));
    const r = resolveLink(link.target, ctx);
    const t = link.target;
    return (
      <>
        <Header
          back={() => open(col ? columnAddress(col.id) : null)}
          backLabel={col ? col.heading || "Column" : menuTitle}
        />
        <h2 className="text-base">{link.label || "Untitled"}</h2>
        {r.broken && (
          <p className="rounded-sm border border-destructive/50 p-2 text-xs text-destructive">
            Hidden on the site: {r.broken}
          </p>
        )}
        {r.pending && (
          <p className="text-xs text-muted-foreground">
            No address yet — shown as "coming soon" and not clickable.
          </p>
        )}
        <PanelField label="Label">
          <Input
            value={link.label}
            onChange={(e) => set((l) => ({ ...l, label: e.target.value }))}
          />
        </PanelField>
        <PanelField label="Links to">
          <select
            className={SELECT}
            value={t.kind}
            onChange={(e) => setTarget(blankTarget(e.target.value as LinkTarget["kind"]))}
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
            <select
              className={SELECT}
              value={t.page}
              onChange={(e) => setTarget({ kind: "page", page: e.target.value as PageKey })}
            >
              {pageOptions.map((pg) => (
                <option key={pg.key} value={pg.key}>
                  {pg.label}
                </option>
              ))}
            </select>
          </PanelField>
        )}
        {t.kind === "section" && (
          <>
            <PanelField label="Page">
              <select
                className={SELECT}
                value={t.page}
                onChange={(e) =>
                  setTarget({ kind: "section", page: e.target.value as PageKey, section: "" })
                }
              >
                {pageOptions.map((pg) => (
                  <option key={pg.key} value={pg.key}>
                    {pg.label}
                  </option>
                ))}
              </select>
            </PanelField>
            <PanelField label="Section">
              <select
                className={SELECT}
                value={t.section}
                onChange={(e) => setTarget({ ...t, section: e.target.value })}
              >
                <option value="">Choose a section…</option>
                {sectionChoices(t.page, ctx.site).map((s) => (
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
              onChange={(e) => setTarget({ kind: "url", url: e.target.value })}
            />
          </PanelField>
        )}
        {t.kind === "email" && (
          <PanelField label="Email address">
            <Input
              type="email"
              value={t.email}
              onChange={(e) => setTarget({ kind: "email", email: e.target.value })}
            />
          </PanelField>
        )}
        {!col && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={!!link.button}
              onCheckedChange={(on) =>
                update({ ...menus, main: setButton(menus.main, link.id, on === true) })
              }
            />
            Show as button <span className="text-xs text-muted-foreground">(one per menu)</span>
          </label>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            update(updateLink(menus, link.id, () => null));
            open(col ? columnAddress(col.id) : null);
          }}
        >
          Delete link
        </Button>
      </>
    );
  }

  // ---- A footer column
  if (column) {
    const setCol = (fn: (c: FooterColumn) => FooterColumn) =>
      update({ ...menus, footer: menus.footer.map((c) => (c.id === column.id ? fn(c) : c)) });
    return (
      <>
        <Header back={() => open(null)} backLabel={menuTitle} />
        <PanelField label="Column heading">
          <Input
            value={column.heading}
            onChange={(e) => setCol((c) => ({ ...c, heading: e.target.value }))}
          />
        </PanelField>
        <h3 className="text-sm">Links</h3>
        <LinkRows
          links={column.links}
          onMove={(id, dir) => {
            const n = move(column.links, id, dir);
            if (n) setCol((c) => ({ ...c, links: n }));
          }}
          onAdd={() => {
            const l = newLink(uid());
            setCol((c) => ({ ...c, links: [...c.links, l] }));
            open(linkAddress(l.id), true);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            update({ ...menus, footer: menus.footer.filter((c) => c.id !== column.id) });
            open(null);
          }}
        >
          Delete column
        </Button>
      </>
    );
  }

  // ---- The menu itself
  if (p.which === "main") {
    const plain = menus.main.filter((l) => !l.button).length;
    return (
      <>
        <Header />
        <p className="text-xs text-muted-foreground">
          Click a link on the page or below to edit it. Changes appear on every page once published.
        </p>
        <LinkRows
          links={menus.main}
          onMove={(id, dir) => {
            const n = move(menus.main, id, dir);
            if (n) update({ ...menus, main: n });
          }}
          onAdd={() => {
            const l = newLink(uid());
            update({ ...menus, main: [...menus.main, l] });
            open(linkAddress(l.id), true);
          }}
        />
        {plain > MAIN_MENU_SOFT_LIMIT && (
          <p className="text-xs text-destructive">
            More than {MAIN_MENU_SOFT_LIMIT} links may not fit in the menu on smaller screens.
          </p>
        )}
      </>
    );
  }
  return (
    <>
      <Header />
      <p className="text-xs text-muted-foreground">
        Up to {MAX_FOOTER_COLUMNS} columns. Click a column or link on the page or below to edit it.
        Changes appear on every page once published.
      </p>
      <ul className="space-y-1">
        {menus.footer.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1">
            <button
              type="button"
              className="block min-w-0 flex-1 truncate rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => open(columnAddress(c.id), true)}
            >
              {c.heading || "Untitled column"}{" "}
              <span className="text-xs text-muted-foreground">
                {c.links.length} link{c.links.length === 1 ? "" : "s"}
              </span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Move ${c.heading} left`}
              disabled={i === 0}
              onClick={() => {
                const n = move(menus.footer, c.id, -1);
                if (n) update({ ...menus, footer: n });
              }}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Move ${c.heading} right`}
              disabled={i === menus.footer.length - 1}
              onClick={() => {
                const n = move(menus.footer, c.id, 1);
                if (n) update({ ...menus, footer: n });
              }}
            >
              ↓
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="sm"
        disabled={menus.footer.length >= MAX_FOOTER_COLUMNS}
        onClick={() => {
          const id = uid();
          const n = addColumn(menus, id);
          if (n) {
            update(n);
            open(columnAddress(id), true);
          }
        }}
      >
        + Add column
      </Button>
      {menus.footer.length >= MAX_FOOTER_COLUMNS && (
        <p className="text-xs text-muted-foreground">
          The footer has the maximum of {MAX_FOOTER_COLUMNS} columns.
        </p>
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
