/**
 * The page switcher in the editor's top bar: jump between page editors without going back to the
 * Studio. Dots: orange = unpublished changes, purple = unresolved comments.
 */
import type { PageKey } from "./page-sections";
import { FIXED_PAGES } from "./pages";

export type SwitcherTarget = { kind: "page"; key: PageKey };

/** The built-in pages (created pages are added from the page list). */
export const SWITCHER_PAGES: Array<{ key: PageKey; title: string }> = FIXED_PAGES;

/** Site-wide drafts (footer and settings, menus) publish from any page editor. */
export const SITE_WIDE_DRAFTS = ["settings", "menus"];

export type Flags = { unpublished: boolean; comments: boolean };

/**
 * Dots for every page. A page has unpublished changes when its own draft exists or a site-wide one
 * does (the page editor would publish it), or when it has never been published. Comments count
 * when unresolved and left on that page.
 */
export function switcherFlags(input: {
  drafts: string[];
  openCommentPlaces: string[];
  /** Every page (built-in and created); created pages not yet published count as unpublished. */
  pages?: Array<{ key: PageKey; published?: boolean }>;
}): { pages: Record<string, Flags> } {
  const siteWide = input.drafts.some((k) => SITE_WIDE_DRAFTS.includes(k));
  const places = new Set(input.openCommentPlaces);
  const pages = Object.fromEntries(
    (input.pages ?? SWITCHER_PAGES).map((p) => [
      p.key,
      {
        unpublished:
          siteWide || input.drafts.includes(p.key) || ("published" in p && p.published === false),
        comments: places.has(`page:${p.key}`),
      },
    ]),
  ) as Record<string, Flags>;
  return { pages };
}

/** Case-insensitive match on every word typed. */
export function matches(title: string, query: string): boolean {
  const t = title.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w));
}

export const isSame = (a: SwitcherTarget, b: SwitcherTarget) => a.key === b.key;
