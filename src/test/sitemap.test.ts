import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/seo";
import { buildSitemap } from "@/lib/sitemap";

const pagesRow = {
  key: "pages",
  content: {
    list: [
      { key: "page_about", title: "About", slug: "about", published: true },
      { key: "page_draft", title: "Draft", slug: "unpublished", published: false },
    ],
  },
};

describe("sitemap", () => {
  it("is a valid urlset that always holds the homepage", () => {
    const body = buildSitemap([]);
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
    expect(body).toContain(`<url><loc>${SITE_URL}/</loc></url>`);
    expect(body.trimEnd().endsWith("</urlset>")).toBe(true);
  });

  it("includes published created pages and leaves unpublished ones out", () => {
    const body = buildSitemap([pagesRow]);
    expect(body).toContain(`<loc>${SITE_URL}/about</loc>`);
    expect(body).not.toContain("/unpublished");
    expect(body.match(/<url>/g)).toHaveLength(2);
  });

  it("excludes pages hidden from search", () => {
    const body = buildSitemap([
      pagesRow,
      { key: "page_about", content: { seo: { noindex: true } } },
      { key: "home", content: { seo: { noindex: true } } },
    ]);
    expect(body).not.toContain("<loc>");
    expect(buildSitemap([{ key: "home", content: { seo: { noindex: "yes" } } }])).toContain(
      `<loc>${SITE_URL}/</loc>`,
    );
  });

  it("omits lastmod because a draft save is not a live page change", () => {
    expect(buildSitemap([pagesRow, { key: "home", content: {} }])).not.toContain("<lastmod>");
  });
});
