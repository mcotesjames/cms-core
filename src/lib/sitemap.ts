import { allPages } from "./pages";
import { SITE_URL, readSeoFields } from "./seo";

export type SitemapPageRow = { key: string; content: unknown };

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

/** Every published page not hidden from search engines. */
export function buildSitemap(rows: SitemapPageRow[]): string {
  const site = Object.fromEntries(rows.map((row) => [row.key, row.content]));
  const urls: string[] = [];
  for (const page of allPages(site)) {
    const doc = site[page.key] as Record<string, unknown> | undefined;
    if (page.published && !readSeoFields(doc?.["seo"]).noindex) {
      // No <lastmod>: updated_at also changes on draft saves, so it isn't a live timestamp.
      urls.push(`${SITE_URL}${page.path}`);
    }
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((loc) => `  <url><loc>${xml(loc)}</loc></url>`).join("\n") +
    `\n</urlset>\n`
  );
}

/** robots.txt: everything public is crawlable; the Studio and server functions aren't. */
export function buildRobots(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /studio",
    "Disallow: /_serverFn",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}
