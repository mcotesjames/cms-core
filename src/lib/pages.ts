/**
 * Every page on the site: the four built-in pages, plus pages created in the Content Studio
 * ("+ New page"). Created pages are listed in the site_content row "pages"
 * ({ list: [{ key, title, slug, published }] }), and each has its own site_content row (keyed
 * `page_<letters>`) holding its hero, sections and SEO, with draft and publish like any page.
 * They're served at `/<slug>` by the generic page route, built from the shared section library.
 *
 * A created page is live only once it has been published. Deleting one removes it from the list
 * but keeps its content row, so nothing is lost.
 *
 * Built-in pages are managed the same way (Pages list → Edit / Settings / Duplicate), except that
 * their web addresses are fixed and they can't be deleted. Their names can be changed; renames are
 * kept in the same row as `names: { [key]: title }`.
 */
import { readField, resolveSections, SECTION_TYPES, type Doc } from "./page-sections";
import { startingSections, templateOf, type TemplateKey } from "./templates";
export type FixedPageKey = "home" | "insights" | "investments" | "publications";
export type CustomPageKey = `page_${string}`;
export type PageKey = FixedPageKey | CustomPageKey;

export type CustomPage = { key: CustomPageKey; title: string; slug: string; published: boolean };
export type PageInfo = {
  key: PageKey;
  title: string;
  path: string;
  custom: boolean;
  published: boolean;
  /** The page's live template, when the page rows were passed in (see `allPages`). */
  template: TemplateKey;
};

export const FIXED_PAGES: Array<{ key: FixedPageKey; title: string; path: string }> = [
  { key: "home", title: "Homepage", path: "/" },
  { key: "insights", title: "Insights page", path: "/insights" },
  { key: "investments", title: "Investments page", path: "/investments" },
  { key: "publications", title: "Publications page", path: "/publications" },
];
const FIXED_KEYS = new Set<string>(FIXED_PAGES.map((p) => p.key));

export const isFixedPage = (k: string): k is FixedPageKey => FIXED_KEYS.has(k);
export const isCustomPageKey = (k: string): k is CustomPageKey => /^page_[a-z]+$/.test(k);
export const isPageKey = (k: string): k is PageKey => isFixedPage(k) || isCustomPageKey(k);

/** Web addresses that already belong to the site or the Studio. */
export const RESERVED_SLUGS = [
  "insights",
  "investments",
  "publications",
  "admin",
  "studio",
  "sitemap.xml",
  "robots.txt",
  "api",
  "assets",
];

const isCustomPage = (v: unknown): v is CustomPage => {
  const o = v as CustomPage;
  return (
    !!o &&
    typeof o === "object" &&
    isCustomPageKey(String(o.key)) &&
    typeof o.title === "string" &&
    typeof o.slug === "string"
  );
};

/** The created pages, from site content (any keyed-by-row object that may hold `pages`). */
export function customPages(site: Record<string, unknown> | null | undefined): CustomPage[] {
  const list = (site?.["pages"] as { list?: unknown } | undefined)?.list;
  return Array.isArray(list)
    ? list.filter(isCustomPage).map((p) => ({ ...p, published: !!p.published }))
    : [];
}

/** Built-in pages' names as changed in their Settings (key → name). */
export function fixedPageNames(
  site: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const names = (site?.["pages"] as { names?: unknown } | undefined)?.names;
  if (!names || typeof names !== "object") return {};
  return Object.fromEntries(
    Object.entries(names as Record<string, unknown>).filter(
      ([k, v]) => isFixedPage(k) && typeof v === "string" && v.trim(),
    ),
  ) as Record<string, string>;
}

/** All pages, built-in first. */
export function allPages(site: Record<string, unknown> | null | undefined): PageInfo[] {
  const names = fixedPageNames(site);
  return [
    ...FIXED_PAGES.map((p) => ({
      ...p,
      title: names[p.key] ?? p.title,
      custom: false,
      published: true,
      template: "standard" as const,
    })),
    ...customPages(site).map((p) => ({
      key: p.key,
      title: p.title,
      path: `/${p.slug}`,
      custom: true,
      published: p.published,
      template: templateOf(p.key, site?.[p.key] as Doc | undefined),
    })),
  ];
}

export function findPage(
  site: Record<string, unknown> | null | undefined,
  key: string,
): PageInfo | undefined {
  return allPages(site).find((p) => p.key === key);
}

/** "About us & Team" → "about-us-team". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Why a web address can't be used, or null when it can. */
export function slugProblem(slug: string, pages: CustomPage[], ownKey?: string): string | null {
  if (!slug) return "Add a web address.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return "Use lowercase letters, numbers and single hyphens only.";
  if (RESERVED_SLUGS.includes(slug)) return "That address is already used by the site.";
  if (pages.some((p) => p.slug === slug && p.key !== ownKey))
    return "Another page already uses that address.";
  return null;
}

/** A new row key for a created page: "page_" plus letters (valid inside CMS field addresses). */
export function newPageKey(): CustomPageKey {
  const letters = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) =>
    String.fromCharCode(97 + (b % 26)),
  ).join("");
  return `page_${letters}`;
}

/** A web address based on `base` that no other page uses ("about-copy", "about-copy-2", …). */
export function uniqueSlug(base: string, pages: CustomPage[]): string {
  const root = slugify(base) || "page";
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!slugProblem(candidate, pages)) return candidate;
  }
}

/** Each built-in page's hero, as a created page's title and summary. */
function heroOf(key: PageKey, doc: Doc): { title: string; summary: string } {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (key === "home") return { title: s(doc["hero"]?.["headline"]), summary: "" };
  if (key === "insights")
    return { title: s(doc["intro"]?.["title"]), summary: s(doc["intro"]?.["note"]) };
  if (key === "investments") {
    const i = doc["intro"] ?? {};
    return {
      title: [s(i["title_line_1"]), s(i["title_line_2"])].filter(Boolean).join(" "),
      summary: s(i["summary"]),
    };
  }
  return { title: s(doc["intro"]?.["title"]), summary: s(doc["intro"]?.["summary"]) };
}

/**
 * The content for a copy of any page (built-in or created), as a created page: its hero becomes the
 * copy's title and summary, and every section is copied with its own text, including original
 * built-in sections, which become ordinary sections with their current text. Site-wide fields
 * (e.g. the investments disclaimer) stay shared, and list-fed sections keep showing the shared
 * lists. Search settings aren't copied: the copy starts automatic.
 */
export function duplicateDoc(site: Doc, source: PageKey, newId: () => string): Doc {
  const doc = (site[source] ?? {}) as Doc;
  const hero = heroOf(source, doc);
  const sections: string[] = [];
  const section_data: Record<string, Record<string, string>> = {};
  for (const inst of resolveSections(source, doc)) {
    const id = newId();
    sections.push(id);
    // Sections added in the Studio are copied whole, including values the panel manages
    // itself (e.g. an interactive's file name and previous version).
    const saved = doc["section_data"]?.[inst.id];
    const own: Record<string, string> =
      saved && typeof saved === "object" ? { ...saved, type: inst.type } : { type: inst.type };
    for (const f of SECTION_TYPES[inst.type].fields) {
      if (f.siteWide) {
        delete own[f.name];
        continue;
      }
      const addr = inst.fields[f.name];
      own[f.name] = addr ? readField(site, addr) : "";
    }
    section_data[id] = own;
  }
  // A copy of a built-in page is Standard; a created page's copy keeps its template.
  const template = templateOf(source, doc);
  return { intro: hero, ...(template !== "standard" && { template }), sections, section_data };
}

/**
 * The starting content of a created page: its hero title, an empty summary, the template and
 * that template's starting sections (none for Standard).
 */
export function newPageDoc(title: string, template: TemplateKey, newId: () => string): Doc {
  return { intro: { title, summary: "" }, template, ...startingSections(template, newId) };
}
