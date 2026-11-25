/**
 * The page switcher in the editor's top bar: jump between page editors and insight editors
 * without going back to the Studio. Pages are direct links; Content → Insights opens the
 * Insights list, and its › arrow lists the articles.
 *
 * Dots: orange = unpublished changes, purple = unresolved comments.
 */
import type { PageKey } from "./page-sections";
import { FIXED_PAGES } from "./pages";

export type SwitcherTarget = { kind: "page"; key: PageKey } | { kind: "post"; id: string };

/** The built-in pages (created pages are added from the page list). */
export const SWITCHER_PAGES: Array<{ key: PageKey; title: string }> = FIXED_PAGES;

/** Site-wide drafts (footer and settings, menus, list items) publish from any page editor. */
export const SITE_WIDE_DRAFTS = ["settings", "menus", "lists"];

export type SwitcherPost = {
  id: string;
  title: string;
  published: boolean;
  hasDraft: boolean;
  published_at: string | null;
};
export type Flags = { unpublished: boolean; comments: boolean };

/**
 * Dots for every page and insight. A page has unpublished changes when its own draft exists or a
 * site-wide one does (the page editor would publish it); an insight when it has a draft or has
 * never been published. Comments count when unresolved and left on that page or insight.
 */
export function switcherFlags(input: {
  drafts: string[];
  posts: SwitcherPost[];
  openCommentPlaces: string[];
  /** Every page (built-in and created); created pages not yet published count as unpublished. */
  pages?: Array<{ key: PageKey; published?: boolean }>;
}): { pages: Record<string, Flags>; posts: Record<string, Flags>; insights: Flags } {
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
  const posts = Object.fromEntries(
    input.posts.map((p) => [
      p.id,
      { unpublished: p.hasDraft || !p.published, comments: places.has(`post:${p.id}`) },
    ]),
  );
  const all = Object.values(posts);
  return {
    pages,
    posts,
    insights: {
      unpublished: all.some((f) => f.unpublished),
      comments: all.some((f) => f.comments),
    },
  };
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

export const isSame = (a: SwitcherTarget, b: SwitcherTarget) =>
  a.kind === b.kind &&
  (a.kind === "page" ? a.key === (b as typeof a).key : a.id === (b as typeof a).id);
