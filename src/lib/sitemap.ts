import { allPages } from "./pages";
import { SITE_URL, readSeoFields } from "./seo";

export type SitemapPageRow = { key: string; content: unknown };
export type SitemapPost = {
  slug: string;
  published: boolean;
  published_at: string | null;
  seo: unknown;
};

/** Read every public row, without accepting a truncated or failed source. */
export async function readSitemapRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Invalid sitemap page size");
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Sitemap source returned no data");
    rows.push(...result.data);
    if (result.data.length < pageSize) return rows;
  }
}

const xml = (value: string) =>
  value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });

export function buildSitemap(rows: SitemapPageRow[], posts: SitemapPost[]): string {
  const site = Object.fromEntries(rows.map((row) => [row.key, row.content]));
  const urls = new Map<string, string | null>();
  for (const page of allPages(site)) {
    const doc = site[page.key] as Record<string, unknown> | undefined;
    if (page.published && !readSeoFields(doc?.["seo"]).noindex) {
      // updated_at also changes on draft saves, so it isn't a live content timestamp.
      urls.set(`${SITE_URL}${page.path}`, null);
    }
  }
  for (const post of posts) {
    if (post.published && !readSeoFields(post.seo).noindex) {
      urls.set(`${SITE_URL}/insights/${post.slug}`, post.published_at);
    }
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...urls]
      .map(
        ([loc, lastmod]) =>
          `  <url><loc>${xml(loc)}</loc>${lastmod ? `<lastmod>${xml(lastmod.slice(0, 10))}</lastmod>` : ""}</url>`,
      )
      .join("\n") +
    `\n</urlset>\n`
  );
}
