/**
 * The one place every page's SEO comes from: title, description, canonical address, social
 * sharing tags (Open Graph / Twitter), robots, and structured data. Every public route builds
 * its head with `seoHead(resolveSeo(...))`, so a new page gets complete tags automatically.
 *
 * Each page (and insight) can override its search title, description and share image, or hide
 * itself from search engines (`seo` on the page row / insight). Anything left empty is automatic:
 * built-in pages fall back to their original hand-written tags, created pages to their hero, and
 * insights to their title, standfirst and cover. Site-wide settings (site name, title ending,
 * default share image) live in Settings → SEO.
 */
import type { PageKey } from "./pages";

/** The site's real address: canonical links and the sitemap always point here. */
export const SITE_URL = "https://mcotesjames.com";
/** The address without its scheme, as shown to editors ("mcotesjames.com/about"). */
export const SITE_HOST = new URL(SITE_URL).host;
/** The site's name: the default for Settings → SEO → Site name and the title ending. */
export const SITE_NAME = "MCJames";
export const TITLE_LIMIT = 60;
export const DESCRIPTION_LIMIT = 155;

export type SeoFields = { title?: string; description?: string; image?: string; noindex?: boolean };
export type SeoSettings = { site_name?: string; title_suffix?: string; default_image?: string };

/** The tags each built-in page had before SEO was editable: kept as its automatic values. */
export const FIXED_PAGE_SEO: Record<string, { title: string; description: string }> = {
  home: {
    title: `${SITE_NAME} — Visual CMS`,
    description: "An editorial site built on the MCJames Visual CMS.",
  },
  insights: {
    title: "Insights",
    description: "Articles, essays and notes.",
  },
  investments: {
    title: "Investments",
    description: "Selected investments, filterable by sector and stage.",
  },
  publications: {
    title: "Publications",
    description: "Research and published work, hosted by the institutions that published it.",
  },
};

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export const readSeoFields = (v: unknown): SeoFields => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    title: clean(o["title"]),
    description: clean(o["description"]),
    image: clean(o["image"]),
    noindex: o["noindex"] === true,
  };
};
export const readSeoSettings = (settings: unknown): SeoSettings => {
  const o = ((settings as Record<string, unknown> | undefined)?.["seo"] ?? {}) as Record<
    string,
    unknown
  >;
  return {
    site_name: clean(o["site_name"]),
    title_suffix: clean(o["title_suffix"]),
    default_image: clean(o["default_image"]),
  };
};

export const siteName = (s: SeoSettings) => s.site_name || SITE_NAME;
/** " — <site name>" unless Settings says otherwise. */
export const titleSuffix = (s: SeoSettings) =>
  s.title_suffix ? ` ${s.title_suffix.replace(/^\s+/, "")}` : ` — ${siteName(s)}`;

export type ResolvedSeo = {
  /** The full title shown in the tab and in search results. */
  title: string;
  /** The page part of the title (what the search title field holds). */
  pageTitle: string;
  description: string;
  image: string;
  url: string;
  noindex: boolean;
  type: "website" | "article";
  /** Which values are typed in (custom) rather than automatic. */
  custom: { title: boolean; description: boolean; image: boolean };
  auto: { title: string; description: string; image: string };
};

/**
 * Works out a page's SEO. `auto` is what the page itself provides when nothing is typed in; the
 * homepage's title is used as typed (no ending added), every other page gets the site ending.
 */
export function resolveSeo(input: {
  fields: SeoFields;
  auto: { title: string; description: string; image?: string | undefined };
  settings: SeoSettings;
  path: string;
  home?: boolean;
  type?: "website" | "article";
}): ResolvedSeo {
  const { settings } = input;
  // Blank or whitespace-only values are automatic, however the fields arrive (raw from the editor).
  const fields = readSeoFields(input.fields);
  const auto = {
    title: input.auto.title,
    description: input.auto.description,
    image: input.auto.image || settings.default_image || "",
  };
  const pageTitle = fields.title || auto.title;
  const title = input.home ? pageTitle : `${pageTitle}${titleSuffix(settings)}`;
  return {
    title,
    pageTitle,
    description: fields.description || auto.description,
    image: fields.image || auto.image,
    url: `${SITE_URL}${input.path === "/" ? "/" : input.path}`,
    noindex: !!fields.noindex,
    type: input.type ?? "website",
    custom: { title: !!fields.title, description: !!fields.description, image: !!fields.image },
    auto,
  };
}

/** SEO for a page (built-in or created) from site content keyed by page row. */
export function pageSeo(
  site: Record<string, unknown>,
  key: PageKey,
  info: { title: string; path: string },
): ResolvedSeo {
  const doc = (site[key] ?? {}) as Record<string, unknown>;
  const fixed = FIXED_PAGE_SEO[key];
  const intro = (doc["intro"] ?? {}) as Record<string, unknown>;
  return resolveSeo({
    fields: readSeoFields(doc["seo"]),
    auto: fixed ?? {
      title: clean(intro["title"]) || info.title,
      description: clean(intro["summary"]),
    },
    settings: readSeoSettings(site["settings"]),
    path: info.path,
    home: key === "home",
  });
}

/** SEO for an insight: its title, standfirst and cover unless overridden. */
export function insightSeo(
  post: {
    title: string;
    excerpt: string | null;
    cover_url: string | null;
    slug: string;
    seo?: unknown;
  },
  settings: unknown,
): ResolvedSeo {
  return resolveSeo({
    fields: readSeoFields(post.seo),
    auto: { title: post.title, description: clean(post.excerpt), image: clean(post.cover_url) },
    settings: readSeoSettings(settings),
    path: `/insights/${post.slug}`,
    type: "article",
  });
}

/** The <head> tags for a resolved page: title, description, canonical, social, robots, structured data. */
export function seoHead(
  seo: ResolvedSeo,
  extra: { jsonLd?: Record<string, unknown> | undefined } = {},
) {
  const meta: Array<Record<string, string>> = [
    { title: seo.title },
    { name: "description", content: seo.description },
    { property: "og:title", content: seo.title },
    { property: "og:description", content: seo.description },
    { property: "og:type", content: seo.type },
    { property: "og:url", content: seo.url },
    { name: "twitter:card", content: seo.image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: seo.title },
    { name: "twitter:description", content: seo.description },
  ];
  if (seo.image.startsWith("https://"))
    meta.push(
      { property: "og:image", content: seo.image },
      { name: "twitter:image", content: seo.image },
    );
  if (seo.noindex) meta.push({ name: "robots", content: "noindex" });
  const scripts = extra.jsonLd
    ? [{ type: "application/ld+json", children: JSON.stringify(extra.jsonLd) }]
    : [];
  return { meta, links: [{ rel: "canonical", href: seo.url }], scripts };
}

/** Structured data for the homepage: the organisation. */
export const organisationLd = (settings: SeoSettings) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName(settings),
  url: SITE_URL,
});

/** Structured data for an insight. */
export const articleLd = (
  seo: ResolvedSeo,
  post: { published_at: string | null; author: string | null },
  settings: SeoSettings,
) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: seo.pageTitle,
  description: seo.description,
  ...(seo.image ? { image: [seo.image] } : {}),
  ...(post.published_at ? { datePublished: post.published_at } : {}),
  ...(post.author ? { author: { "@type": "Person", name: post.author } } : {}),
  publisher: { "@type": "Organization", name: siteName(settings), url: SITE_URL },
  mainEntityOfPage: seo.url,
});

/** Google cuts titles and descriptions off around these lengths; the panel warns past them. */
export const tooLong = (text: string, limit: number) => text.length > limit;
