/**
 * Site menus edited in the Content Studio: the main menu (header pill, also the mobile menu)
 * and the footer menu (up to three columns of links). Stored in the site_content row "menus"
 * (live content plus draft). Until that row has content, the menus are built from DEFAULT links.
 *
 * Links point at things rather than URLs (a page, a section of a page, an external link, an
 * email), so renaming or reordering doesn't break them. A link whose target has gone (unpublished
 * page, deleted section) is hidden on the live site and flagged in the editor.
 */
import { sectionOrder, type PageKey } from "./page-sections";
import { findPage } from "./pages";
import { site as siteConfig } from "./site";

export type LinkTarget =
  | { kind: "page"; page: PageKey }
  | { kind: "section"; page: PageKey; section: string }
  | { kind: "url"; url: string }
  | { kind: "email"; email: string };

export type MenuLink = { id: string; label: string; target: LinkTarget; button?: boolean };
export type FooterColumn = { id: string; heading: string; links: MenuLink[] };
export type Menus = { main: MenuLink[]; footer: FooterColumn[] };

/** Footer menu column limit (site.config.ts `menus.footerColumns`). */
export const MAX_FOOTER_COLUMNS = siteConfig.menus?.footerColumns ?? 3;
/** Above this many ordinary links the main menu may not fit on smaller screens (`menus.mainMax`). */
export const MAIN_MENU_SOFT_LIMIT = siteConfig.menus?.mainMax ?? 5;

/** Names for the built-in pages in the link editor (created pages use their own names). */
export const PAGE_NAMES: Record<string, string> = { home: "Homepage" };

/** Where a page link goes, or why it can't: created pages must exist and be published. */
function pageHref(
  site: Record<string, unknown>,
  key: string,
): { path: string; broken: string | null } {
  const page = findPage(site, key);
  if (!page) return { path: "", broken: "That page no longer exists." };
  if (!page.published) return { path: page.path, broken: "That page isn't published yet." };
  return { path: page.path, broken: null };
}

export const LINK_KINDS: Array<{ kind: LinkTarget["kind"]; label: string }> = [
  { kind: "page", label: "Page" },
  { kind: "section", label: "Section of a page" },
  { kind: "url", label: "External link" },
  { kind: "email", label: "Email" },
];

/**
 * The menus before they're first edited: the site's own defaults (site.config.ts
 * `menus.defaults`), or Home in the main menu and a Contact column in the footer.
 */
export function defaultMenus(settings?: { contact_email?: string } | null): Menus {
  const own = siteConfig.menus?.defaults;
  if (own) return own(settings);
  const email = settings?.contact_email ?? "";
  return {
    main: [{ id: "m-home", label: "Home", target: { kind: "page", page: "home" } }],
    footer: [
      {
        id: "c-contact",
        heading: "Contact",
        links: [{ id: "f-email", label: email, target: { kind: "email", email } }],
      },
    ],
  };
}

const isMenus = (m: unknown): m is Menus =>
  !!m &&
  typeof m === "object" &&
  Array.isArray((m as Menus).main) &&
  Array.isArray((m as Menus).footer);

/** Stored menus if they've been edited, otherwise the defaults. */
export function resolveMenus(stored: unknown, settings?: { contact_email?: string } | null): Menus {
  return isMenus(stored) ? stored : defaultMenus(settings);
}

/** The anchor id each page section gets, so section links survive reordering. */
export const sectionAnchor = (id: string) => `section-${id}`;

export type ResolvedLink = {
  href: string;
  /** Internal page: use the router. */
  internal: boolean;
  /** Opens in a new tab with the external-link arrow. */
  external: boolean;
  /** An external link with no address yet: shown as "coming soon", not clickable. */
  pending: boolean;
  /** Why the link can't work right now; hidden on the live site, flagged in the editor. */
  broken: string | null;
};

type Ctx = {
  /** Site content keyed by page (to check a section is still on its page). */
  site: Record<string, unknown>;
};

export function resolveLink(target: LinkTarget, ctx: Ctx): ResolvedLink {
  const ok = { internal: false, external: false, pending: false, broken: null };
  switch (target.kind) {
    case "page": {
      const { path, broken } = pageHref(ctx.site, target.page);
      return { ...ok, href: path, internal: true, broken };
    }
    case "section": {
      const doc = ctx.site[target.page] as Record<string, unknown> | undefined;
      const onPage = sectionOrder(target.page, doc).includes(target.section);
      const page = pageHref(ctx.site, target.page);
      const href = `${page.path || "/"}#${sectionAnchor(target.section)}`;
      if (page.broken) return { ...ok, href, broken: page.broken };
      return onPage
        ? { ...ok, href }
        : { ...ok, href, broken: "That section is no longer on the page." };
    }
    case "url":
      return target.url.trim()
        ? { ...ok, href: target.url.trim(), external: true }
        : { ...ok, href: "", external: true, pending: true };
    case "email":
      return target.email.trim()
        ? { ...ok, href: `mailto:${target.email.trim()}` }
        : { ...ok, href: "", broken: "Add an email address." };
  }
}

/** A sensible empty target when the author switches a link to another kind. */
export function blankTarget(kind: LinkTarget["kind"]): LinkTarget {
  switch (kind) {
    case "page":
      return { kind, page: "home" };
    case "section":
      return { kind, page: "home", section: "" };
    case "url":
      return { kind, url: "" };
    case "email":
      return { kind, email: "" };
  }
}

export const newLink = (id: string): MenuLink => ({
  id,
  label: "New link",
  target: { kind: "page", page: "home" },
});
export const newColumn = (id: string): FooterColumn => ({ id, heading: "New column", links: [] });

/** Adds a footer column, or returns null at the column limit. */
export function addColumn(menus: Menus, id: string): Menus | null {
  if (menus.footer.length >= MAX_FOOTER_COLUMNS) return null;
  return { ...menus, footer: [...menus.footer, newColumn(id)] };
}

/** Marks one main-menu link as the button (only one can be), or clears it. */
export function setButton(links: MenuLink[], id: string, on: boolean): MenuLink[] {
  return links.map((l) => (l.id === id ? { ...l, button: on } : on ? { ...l, button: false } : l));
}

export function move<T extends { id: string }>(arr: T[], id: string, dir: -1 | 1): T[] | null {
  const i = arr.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return null;
  const next = [...arr];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Item addresses used between the editor and the canvas. */
export const linkAddress = (id: string) => `menu:${id}`;
export const columnAddress = (id: string) => `menucol:${id}`;
export function parseMenuItem(
  address: string | null | undefined,
): { kind: "link" | "column"; id: string } | null {
  const m = address?.match(/^(menu|menucol):(.+)$/);
  return m ? { kind: m[1] === "menu" ? "link" : "column", id: m[2]! } : null;
}

/** Finds a link anywhere in the menus, with the footer column it sits in (if any). */
export function findLink(
  menus: Menus,
  id: string,
): { link: MenuLink; column: FooterColumn | null } | null {
  const main = menus.main.find((l) => l.id === id);
  if (main) return { link: main, column: null };
  for (const c of menus.footer) {
    const l = c.links.find((x) => x.id === id);
    if (l) return { link: l, column: c };
  }
  return null;
}

/** Replaces one link wherever it is. */
export function updateLink(menus: Menus, id: string, fn: (l: MenuLink) => MenuLink | null): Menus {
  const apply = (links: MenuLink[]) =>
    links.flatMap((l) => (l.id === id ? (fn(l) ? [fn(l)!] : []) : [l]));
  return {
    main: apply(menus.main),
    footer: menus.footer.map((c) => ({ ...c, links: apply(c.links) })),
  };
}
